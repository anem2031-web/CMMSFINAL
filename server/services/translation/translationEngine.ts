/**
 * ============================================================
 * CMMS Central Translation Engine
 * ============================================================
 * Enterprise-level translation engine with:
 * - Async Translation Job Queue with retry mechanism
 * - LLM-powered translation (Arabic, English, Urdu)
 * - Smart Re-Translation (only changed fields)
 * - Manual Override protection (approved translations preserved)
 * - Fallback Logic (original text when translation fails)
 * - In-memory cache with TTL
 * - Version tracking for all changes
 * - Audit logging for all operations
 * ============================================================
 */

import { eq, and, desc, sql, inArray, ne, getTableColumns } from "drizzle-orm";
import { isObserverReadScope } from "../../_core/authz/observer-read-scope";
import { drizzle } from "drizzle-orm/mysql2";
import {
  entityTranslations, translationJobs, translationVersions,
  type SupportedLanguage, supportedLanguages, auditLogs,
  tickets, assets, pmWorkOrders, purchaseOrderItems,
  preventivePlans, pmExecutionResults, pmExecutionSessions, pmChecklistItems,
  centerCategories, assetCategories, users, sections,
} from "../../../drizzle/schema";
import { invokeLLM } from "../../_core/llm";
import { getDb } from "../../_core/db";
import crypto from "crypto";
import { splitTranslationBatches, translateJobBatch } from "./translationBatch";
import { automaticTranslationScope, loadNotificationRecipientRole } from "./notificationTranslationScope";
import { isAutomaticTranslationEnabled, canProcessTranslationJob, TRANSLATION_RETRY_BATCH_SIZE } from "./translationPolicy";

// ============================================================
// TYPES
// ============================================================
export interface TranslatableField {
  fieldName: string;
  text: string;
}

export interface TranslationRequest {
  entityType: string;
  entityId: number;
  fields: TranslatableField[];
  sourceLanguage: SupportedLanguage;
  targetLanguages?: SupportedLanguage[];
  userId?: number;
}

export interface TranslationResult {
  entityType: string;
  entityId: number;
  fieldName: string;
  languageCode: SupportedLanguage;
  translatedText: string | null;
  status: string;
  versionNumber: number;
}

// Entity field mapping - defines which fields are translatable for each entity type
export const ENTITY_FIELD_MAP: Record<string, string[]> = {
  // Ticket root + workflow child entities. Direct columns are used where they
  // already exist; the rest live safely in entity_translations.
  TICKET: [
    "title", "description", "repairNotes", "inspectionNotes",
    "inspectionReturnReason", "justification", "triageNotes",
    "materialsUsed", "maintenanceRoutingNote",
  ],
  TICKET_ITEM: [
    "title", "description", "routingNote", "justification",
    "repairNotes", "materialsUsed",
  ],
  TICKET_TASK: ["title", "description"],
  TICKET_STATUS_HISTORY: ["notes"],
  TICKET_DEPARTMENT: ["routingNote", "organizationalTitle"],
  INSPECTION_RESULT: [
    "rootCause", "findings", "recommendedAction", "inspectionNotes", "returnReason",
  ],

  // Purchase workflow content.
  PO: ["notes", "accountingNotes", "managementNotes", "rejectionReason"],
  PO_ITEM: [
    "itemName", "description", "notes", "delegateChangeReason",
    "managementRejectionReason", "itemRevisionNote", "purchaseCancelReason",
    "returnReason",
  ],
  PO_BATCH: ["accountingNotes", "managementNotes", "rejectionReason"],
  PO_PACKAGE: ["notes"],
  PO_COMMENT: ["note"],
  PO_ITEM_HISTORY: ["note"],
  EXTERNAL_MAINTENANCE_JOB: [
    "assetName", "assetBeforeCondition", "warehouseNotes",
    "gateExitNotes", "gateEntryNotes", "returnCondition",
    "warehouseReturnNotes", "handoverNotes",
  ],
  DELIVERY_DOCUMENT: ["itemName", "notes"],
  RETURN_DOCUMENT: ["itemName", "reason"],

  // Inventory / shared entities.
  INVENTORY: ["itemName", "description"],
  SITE: ["name"],
  SECTION: ["name"],
  ASSET: ["name", "description", "notes"],
  CENTER_CATEGORY: ["name"],
  ASSET_CATEGORY: ["name"],
  USER: ["name"],
  NOTIFICATION: ["title", "message"],

  // Legacy PM translation entities.
  PM_PLAN: ["title", "description"],
  PM_WORK_ORDER: ["title", "technicianNotes"],
  PM_RESULT: ["fixNotes"],
  PM_SESSION: ["generalNotes"],
  PM_CHECKLIST: ["text"],

  // PM V2 entities.
  PMV2_SPECIALTY: ["name", "description"],
  PMV2_CHECKLIST: ["name", "description"],
  PMV2_CHECKLIST_ITEM: ["title"],
  PMV2_PROGRAM: ["title"],
  PMV2_TASK_ITEM: ["titleSnapshot"],
  PMV2_ITEM_ACTION: ["note"],
  TICKET_TEAM_ACTION: ["note"],
  PMV2_MATERIAL_REQUEST_ITEM: ["itemNameSnapshot"],
  PMV2_DAILY_REPORT_REVIEW: ["note"],
};

// ============================================================
// CACHE (In-memory with TTL)
// ============================================================
interface CacheEntry {
  value: string;
  expiresAt: number;
}

class TranslationCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 30 * 60 * 1000; // 30 minutes

  private key(entityType: string, entityId: number, fieldName: string, lang: SupportedLanguage): string {
    return `${entityType}:${entityId}:${fieldName}:${lang}`;
  }

  get(entityType: string, entityId: number, fieldName: string, lang: SupportedLanguage): string | null {
    const k = this.key(entityType, entityId, fieldName, lang);
    const entry = this.cache.get(k);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(k);
      return null;
    }
    return entry.value;
  }

  set(entityType: string, entityId: number, fieldName: string, lang: SupportedLanguage, value: string): void {
    const k = this.key(entityType, entityId, fieldName, lang);
    this.cache.set(k, { value, expiresAt: Date.now() + this.TTL });
  }

  invalidate(entityType: string, entityId: number, fieldName?: string): void {
    const prefix = fieldName
      ? `${entityType}:${entityId}:${fieldName}:`
      : `${entityType}:${entityId}:`;
    const keys = Array.from(this.cache.keys());
    for (const k of keys) {
      if (k.startsWith(prefix)) this.cache.delete(k);
    }
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export const translationCache = new TranslationCache();

// ============================================================
// TEXT HASH (for Smart Re-Translation)
// ============================================================
function textHash(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

// ============================================================
// LLM TRANSLATION
// ============================================================
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  ar: "Arabic",
  en: "English",
  ur: "Urdu",
};

// ============================================================
// PERSISTED MASTER-DATA NAME TRANSLATIONS
// ============================================================

type NamedTranslationRecord = {
  id: number;
  name?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  nameUr?: string | null;
};

const MASTER_NAME_BATCH_SIZE = 30;
const MASTER_LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  ar: "Arabic",
  en: "English",
  ur: "Urdu",
};

function detectNameLanguage(text: string): SupportedLanguage {
  if (!text?.trim()) return "ar";
  const urduSpecific = /[\u06A9\u06AF\u06BA\u06BE\u06C1\u06CC\u06D2]/;
  if (urduSpecific.test(text)) return "ur";
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  return "en";
}

function extractJsonObject(content: unknown): Record<string, unknown> {
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as Record<string, unknown>;
  }
  if (typeof content !== "string") return {};
  const cleaned = content.replace(/```json\s*|```/g, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    console.error("[TranslationEngine] Failed to parse master-name translation batch:", cleaned.slice(0, 500));
    return {};
  }
}

async function translateMasterNameBatch(
  entityType: string,
  rows: Array<{ id: number; text: string }>,
  targetLanguage: SupportedLanguage,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (!rows.length) return result;

  const modeInstruction = entityType === "USER"
    ? "These values are personal display names. Transliterate each name naturally into the target writing system. Do NOT translate the semantic meaning of a person's name."
    : "Translate each value as a professional CMMS master-data display label. Preserve codes, model numbers, acronyms, serial-like tokens and identifiers exactly where appropriate.";

  const payload = Object.fromEntries(rows.map((row) => [String(row.id), row.text]));
  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `You localize CMMS master-data names into ${MASTER_LANGUAGE_NAMES[targetLanguage]}. ${modeInstruction}\nIf a value is already naturally written in the target language, keep it unchanged. Return ONLY one JSON object whose keys exactly match the supplied numeric IDs and whose values are translated/transliterated strings.`,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    });
    const parsed = extractJsonObject(response.choices?.[0]?.message?.content);
    for (const row of rows) {
      const value = parsed[String(row.id)];
      if (typeof value === "string" && value.trim()) result.set(row.id, value.trim());
    }
  } catch (error) {
    console.error(`[TranslationEngine] Master-name batch translation failed for ${entityType}/${targetLanguage}:`, error);
  }
  return result;
}

/**
 * Persist a completed automatic translation in entity_translations.
 * Approved/manual values always win and are never overwritten here.
 */
export async function storeCompletedEntityTranslation(
  entityType: string,
  entityId: number,
  fieldName: string,
  languageCode: SupportedLanguage,
  translatedText: string,
): Promise<string | null> {
  const db = await getDb();
  const text = translatedText?.trim();
  if (!db || !text) return null;

  const [existing] = await db.select().from(entityTranslations).where(
    and(
      eq(entityTranslations.entityType, entityType),
      eq(entityTranslations.entityId, entityId),
      eq(entityTranslations.fieldName, fieldName),
      eq(entityTranslations.languageCode, languageCode),
    ),
  ).limit(1);

  if (existing?.translationStatus === "approved" && existing.translatedText?.trim()) {
    const approvedText = existing.translatedText.trim();
    translationCache.set(entityType, entityId, fieldName, languageCode, approvedText);
    return approvedText;
  }
  if (existing?.translatedText?.trim() === text && existing.translationStatus === "completed") {
    translationCache.set(entityType, entityId, fieldName, languageCode, text);
    return text;
  }

  if (existing) {
    const nextVersion = Math.max(1, existing.versionNumber || 1) + 1;
    await db.insert(translationVersions).values({
      entityTranslationId: existing.id,
      versionNumber: nextVersion,
      translatedText: text,
      translationStatus: "completed",
      changeReason: "auto_translate",
    });
    await db.update(entityTranslations).set({
      translatedText: text,
      translationStatus: "completed",
      versionNumber: nextVersion,
      lastAttemptAt: new Date(),
      errorMessage: null,
    }).where(eq(entityTranslations.id, existing.id));
  } else {
    const [inserted] = await db.insert(entityTranslations).values({
      entityType,
      entityId,
      fieldName,
      languageCode,
      translatedText: text,
      translationStatus: "completed",
      versionNumber: 1,
      lastAttemptAt: new Date(),
    });
    if (inserted?.insertId) {
      await db.insert(translationVersions).values({
        entityTranslationId: inserted.insertId,
        versionNumber: 1,
        translatedText: text,
        translationStatus: "completed",
        changeReason: "auto_translate",
      });
    }
  }

  translationCache.set(entityType, entityId, fieldName, languageCode, text);
  return text;
}

/**
 * Read persisted master-data name translations and generate only the missing
 * values. Missing names are translated in small batches, saved once in
 * entity_translations, then reused on every later request.
 *
 * Sites/Sections may still have legacy nameEn/nameUr columns. Those values are
 * imported into entity_translations on first read instead of paying for an
 * external translation again.
 */
export async function ensureStoredNameTranslations(
  entityType: string,
  records: NamedTranslationRecord[],
  languageCode: SupportedLanguage,
  options?: { translateMissing?: boolean },
): Promise<Map<number, string>> {
  const output = new Map<number, string>();
  const unique = new Map<number, NamedTranslationRecord>();
  for (const record of records) {
    const id = Number(record.id);
    const name = record.name?.trim();
    if (Number.isInteger(id) && id > 0 && name) unique.set(id, { ...record, id, name });
  }
  if (!unique.size) return output;

  const ids = [...unique.keys()];
  const existing = await getBatchTranslations(entityType, ids, languageCode, ["name"]);
  const needsExternal: Array<{ id: number; text: string }> = [];

  for (const [id, record] of unique) {
    const persisted = existing[id]?.name?.text?.trim();
    if (persisted) {
      output.set(id, persisted);
      continue;
    }

    const legacy = languageCode === "en"
      ? record.nameEn?.trim()
      : languageCode === "ur"
        ? record.nameUr?.trim()
        : languageCode === "ar"
          ? record.nameAr?.trim()
          : undefined;
    if (legacy) {
      if (options?.translateMissing === false) {
        output.set(id, legacy);
      } else {
        const stored = await storeCompletedEntityTranslation(entityType, id, "name", languageCode, legacy);
        output.set(id, stored || legacy);
      }
      continue;
    }

    const source = record.name!.trim();
    if (detectNameLanguage(source) === languageCode) {
      output.set(id, source);
      continue;
    }
    if (options?.translateMissing !== false) needsExternal.push({ id, text: source });
  }

  for (let offset = 0; offset < needsExternal.length; offset += MASTER_NAME_BATCH_SIZE) {
    const chunk = needsExternal.slice(offset, offset + MASTER_NAME_BATCH_SIZE);
    const translated = await translateMasterNameBatch(entityType, chunk, languageCode);
    for (const row of chunk) {
      const translatedText = translated.get(row.id);
      if (!translatedText) continue;
      const stored = await storeCompletedEntityTranslation(entityType, row.id, "name", languageCode, translatedText);
      if (stored) output.set(row.id, stored);
    }
  }

  return output;
}

// ============================================================
// CORE ENGINE FUNCTIONS
// ============================================================

/**
 * Queue translation jobs for an entity (async, non-blocking)
 * Creates pending jobs and translation records
 */
export async function queueTranslation(request: TranslationRequest, maintenanceOptions?: { deferProcessing: boolean }): Promise<number[]> {
  if (isObserverReadScope()) return [];
  const db = await getDb();
  if (!db) {
    console.error("[TranslationEngine] Failed to get database connection for queueTranslation. Job aborted.");
    return [];
  }

  const recipientRole = await loadNotificationRecipientRole(db, request.entityType, request.entityId);
  if (!isAutomaticTranslationEnabled(request.entityType, recipientRole)) return [];

  const targetLangs = request.targetLanguages ||
    supportedLanguages.filter(l => l !== request.sourceLanguage);

  const jobIds: number[] = [];

  for (const field of request.fields) {
    if (!field.text || field.text.trim() === "") continue;

    const hash = textHash(field.text);

    for (const targetLang of targetLangs) {
      // Check if approved translation exists (Manual Override protection)
      const existing = await db.select().from(entityTranslations).where(
        and(
          eq(entityTranslations.entityType, request.entityType),
          eq(entityTranslations.entityId, request.entityId),
          eq(entityTranslations.fieldName, field.fieldName),
          eq(entityTranslations.languageCode, targetLang)
        )
      ).limit(1);

      if (existing[0]?.translationStatus === "approved") {
        // Skip approved translations - Manual Override protection
        continue;
      }

      // Smart Re-Translation: check if text actually changed
      const existingJob = await db.select().from(translationJobs).where(
        and(
          eq(translationJobs.entityType, request.entityType),
          eq(translationJobs.entityId, request.entityId),
          eq(translationJobs.fieldName, field.fieldName),
          eq(translationJobs.targetLanguage, targetLang),
          eq(translationJobs.previousTextHash, hash),
          ...(existing[0]?.translationJobId ? [eq(translationJobs.id, existing[0].translationJobId)] : []),
          inArray(translationJobs.status, ["pending", "processing", "completed"])
        )
      ).limit(1);

      if (existingJob[0]) {
        // Text hasn't changed, skip re-translation
        continue;
      }

      // The source value changed (or has never been translated). Never let a
      // stale in-memory label survive while the replacement translation is
      // pending; list/dropdown reads must fall back to the persisted/current
      // source and then pick up the new stored translation.
      translationCache.invalidate(request.entityType, request.entityId, field.fieldName);

      // Create translation job
      const [jobResult] = await db.insert(translationJobs).values({
        entityType: request.entityType,
        entityId: request.entityId,
        fieldName: field.fieldName,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: targetLang,
        sourceText: field.text,
        status: "pending",
        previousTextHash: hash,
      });

      const jobId = jobResult.insertId;
      jobIds.push(jobId);

      // Create or update entity_translations record
      if (existing[0]) {
        await db.update(entityTranslations).set({
          translationStatus: "pending",
          translationJobId: jobId,
          errorMessage: null,
        }).where(eq(entityTranslations.id, existing[0].id));
      } else {
        await db.insert(entityTranslations).values({
          entityType: request.entityType,
          entityId: request.entityId,
          fieldName: field.fieldName,
          languageCode: targetLang,
          translationStatus: "pending",
          translationJobId: jobId,
          versionNumber: 1,
        });
      }
    }
  }

  // Process jobs asynchronously (fire and forget)
  if (jobIds.length > 0 && !maintenanceOptions?.deferProcessing) {
    processTranslationJobs(jobIds).catch(err =>
      console.error("[TranslationEngine] Background job processing error for jobIds:", jobIds, err)
    );
  }

  return jobIds;
}

/**
 * كتابة الترجمة في الأعمدة المباشرة بعد اكتمال الـ Engine
 * حتى تظهر الترجمة في القوائم والبحث والتقارير
 */
async function writeBackToDirectColumn(
  db: any,
  entityType: string,
  entityId: number,
  fieldName: string,
  language: SupportedLanguage,
  translatedText: string,
  sourceText?: string,
): Promise<void> {
  try {
    // ✅ إصلاح: schema.ts الجديد (المسحوب من القاعدة) يسمّي كل حقل مترجَم
    // بصيغة camelCase كاملة (مثال: itemNameAr) بدل الصيغة القديمة بشرطة سفلية
    // (itemName_ar). كان هذا السطر يبني الاسم القديم دائماً، فتفشل كل عمليات
    // حفظ الترجمة صامتة منذ استبدال ملف الـSchema (المفتاح غير المعروف يُتجاهل
    // بصمت من drizzle .set()، بدون أي خطأ ظاهر).
    const langSuffix = language.charAt(0).toUpperCase() + language.slice(1);
    const columnName = `${fieldName}${langSuffix}`;

    if (entityType === "TICKET") {
      const validColumns = [
        "titleAr", "titleEn", "titleUr",
        "descriptionAr", "descriptionEn", "descriptionUr",
        "repairNotesAr", "repairNotesEn", "repairNotesUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(tickets)
        .set({ [columnName]: translatedText })
        .where(eq(tickets.id, entityId));

    } else if (entityType === "SECTION") {
      if (fieldName !== "name" || !sourceText || !["en", "ur"].includes(language)) return;
      await db.update(sections)
        .set({ [columnName]: translatedText })
        .where(and(eq(sections.id, entityId), eq(sections.name, sourceText)));

    } else if (entityType === "ASSET") {
      const validColumns = [
        "descriptionAr", "descriptionEn", "descriptionUr",
        "notesAr", "notesEn", "notesUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(assets)
        .set({ [columnName]: translatedText })
        .where(eq(assets.id, entityId));

    } else if (entityType === "WORK_ORDER") {
      const validColumns = [
        "technicianNotesAr", "technicianNotesEn", "technicianNotesUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(pmWorkOrders)
        .set({ [columnName]: translatedText })
        .where(eq(pmWorkOrders.id, entityId));

    } else if (entityType === "PO_ITEM") {
      const validColumns = [
        "itemNameAr", "itemNameEn", "itemNameUr",
        "descriptionAr", "descriptionEn", "descriptionUr",
        "notesAr", "notesEn", "notesUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(purchaseOrderItems)
        .set({ [columnName]: translatedText })
        .where(eq(purchaseOrderItems.id, entityId));

    } else if (entityType === "PM_PLAN") {
      const validColumns = [
        "titleAr", "titleEn", "titleUr",
        "descriptionAr", "descriptionEn", "descriptionUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(preventivePlans)
        .set({ [columnName]: translatedText })
        .where(eq(preventivePlans.id, entityId));

    } else if (entityType === "PM_WORK_ORDER") {
      const validColumns = [
        "titleAr", "titleEn", "titleUr",
        "technicianNotesAr", "technicianNotesEn", "technicianNotesUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(pmWorkOrders)
        .set({ [columnName]: translatedText })
        .where(eq(pmWorkOrders.id, entityId));

    } else if (entityType === "PM_RESULT") {
      const validColumns = [
        "fixNotesAr", "fixNotesEn", "fixNotesUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(pmExecutionResults)
        .set({ [columnName]: translatedText })
        .where(eq(pmExecutionResults.id, entityId));

    } else if (entityType === "PM_SESSION") {
      const validColumns = [
        "generalNotesAr", "generalNotesEn", "generalNotesUr",
      ];
      if (!validColumns.includes(columnName)) return;
      await db.update(pmExecutionSessions)
        .set({ [columnName]: translatedText })
        .where(eq(pmExecutionSessions.id, entityId));

    } else if (entityType === "PM_CHECKLIST") {
      const validColumns = ["textAr", "textEn", "textUr"];
      if (!validColumns.includes(columnName)) return;
      await db.update(pmChecklistItems)
        .set({ [columnName]: translatedText })
        .where(eq(pmChecklistItems.id, entityId));
    }
  } catch (e) {
    // لا نوقف العملية إذا فشل الـ write-back
    console.error(`[TranslationEngine] Write-back failed for ${entityType}.${fieldName}_${language}:`, e);
  }
}

/**
 * Process translation jobs (called asynchronously)
 */
// Creation, retry and recovery share a single worker in this process.
let processingTail: Promise<void> = Promise.resolve();
function processTranslationJobs(jobIds: number[]): Promise<void> {
  const work = processingTail.then(() => runTranslationJobs(jobIds));
  processingTail = work.catch(() => {});
  return work;
}
async function saveTranslatedJob(db: any, job: any, translated: string): Promise<void> {
  const jobId = job.id;
      // Recheck the recipient if its role changed while the external translation ran.
      if (job.entityType === "NOTIFICATION" && !isAutomaticTranslationEnabled(job.entityType,
        await loadNotificationRecipientRole(db, job.entityType, job.entityId))) return;

      // Update job as completed
      await db.update(translationJobs).set({
        status: "completed",
        translatedText: translated,
        completedAt: new Date(),
      }).where(eq(translationJobs.id, jobId));

      // Update entity_translations
      const [etRecord] = await db.select().from(entityTranslations).where(
        and(
          eq(entityTranslations.entityType, job.entityType),
          eq(entityTranslations.entityId, job.entityId),
          eq(entityTranslations.fieldName, job.fieldName),
          eq(entityTranslations.languageCode, job.targetLanguage)
        )
      ).limit(1);

      if (etRecord && etRecord.translationJobId === jobId && !["approved", "completed"].includes(etRecord.translationStatus)) {
        const newVersion = etRecord.versionNumber + 1;
        // Save version history
        await db.insert(translationVersions).values({
          entityTranslationId: etRecord.id,
          versionNumber: newVersion,
          translatedText: translated,
          translationStatus: "completed",
          changeReason: "auto_translate",
        });

        const [saved] = await db.update(entityTranslations).set({
          translatedText: translated,
          translationStatus: "completed",
          versionNumber: newVersion,
          lastAttemptAt: new Date(),
          errorMessage: null,
          translationJobId: jobId,
        }).where(and(eq(entityTranslations.id, etRecord.id),
          eq(entityTranslations.translationJobId, jobId),
          ne(entityTranslations.translationStatus, "approved"),
          ne(entityTranslations.translationStatus, "completed")));
        if (!saved.affectedRows) return;

        // Update cache
        translationCache.set(
          job.entityType, job.entityId, job.fieldName,
          job.targetLanguage as SupportedLanguage, translated
        );

        // كتابة الترجمة في الأعمدة المباشرة أيضاً حتى تظهر في القوائم والبحث
        await writeBackToDirectColumn(
          db, job.entityType, job.entityId,
          job.fieldName, job.targetLanguage as SupportedLanguage, translated, job.sourceText
        );
      }

}

async function failTranslatedJob(db: any, jobId: number, error: any): Promise<void> {
      // Handle failure with retry
      const [job] = await db.select().from(translationJobs).where(eq(translationJobs.id, jobId)).limit(1);
      if (!job) return;

      const newRetryCount = job.retryCount + 1;
      const isFinalFailure = newRetryCount >= job.maxRetries;

      await db.update(translationJobs).set({
        status: isFinalFailure ? "failed" : "pending",
        retryCount: newRetryCount,
        errorMessage: error.message?.slice(0, 500),
      }).where(eq(translationJobs.id, jobId));

      // Update entity_translations status
      await db.update(entityTranslations).set({
        translationStatus: isFinalFailure ? "failed" : "pending",
        lastAttemptAt: new Date(),
        errorMessage: error.message?.slice(0, 500),
      }).where(
        and(
          eq(entityTranslations.entityType, job.entityType),
          eq(entityTranslations.entityId, job.entityId),
          eq(entityTranslations.fieldName, job.fieldName),
          eq(entityTranslations.languageCode, job.targetLanguage),
          eq(entityTranslations.translationJobId, jobId),
          ne(entityTranslations.translationStatus, "approved"),
          ne(entityTranslations.translationStatus, "completed")
        )
      );

      // Retry pending jobs after a delay
      if (!isFinalFailure) {
        setTimeout(() => {
          processTranslationJobs([jobId]).catch(console.error);
        }, 5000 * newRetryCount); // Exponential backoff
      }
}

export async function runTranslationJobs(jobIds: number[], maintenanceBatch = false): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const candidates: any[] = [];
  for (const jobId of [...new Set(jobIds)]) {
    const [job] = await db.select().from(translationJobs).where(eq(translationJobs.id, jobId)).limit(1);
    if (job?.status === "pending") candidates.push(job);
  }
  // Maintenance-only opt-in; normal app callers retain per-record boundaries.
  if (maintenanceBatch && (candidates.length > 2500 || candidates.reduce((n, j) => n + j.sourceText.length, 0) > 400000)) {
    throw new Error("Maintenance translation batch exceeds safe payload bound");
  }
  for (const batch of maintenanceBatch ? [candidates] : splitTranslationBatches(candidates)) {
    const claimed: any[] = [];
    for (const job of batch) {
      const recipientRole = await loadNotificationRecipientRole(db, job.entityType, job.entityId);
      if (!isAutomaticTranslationEnabled(job.entityType, recipientRole)) continue;
      const [current] = await db.select().from(entityTranslations).where(and(
        eq(entityTranslations.entityType, job.entityType), eq(entityTranslations.entityId, job.entityId),
        eq(entityTranslations.fieldName, job.fieldName), eq(entityTranslations.languageCode, job.targetLanguage)
      )).limit(1);
      if (!canProcessTranslationJob(job, current, recipientRole)) continue;
      const [claim] = await db.update(translationJobs).set({ status: "processing" })
        .where(and(eq(translationJobs.id, job.id), eq(translationJobs.status, "pending")));
      if (claim.affectedRows) claimed.push(job);
    }
    if (!claimed.length) continue;
    let translated: Map<number, string>;
    try {
      translated = await translateJobBatch(claimed, maintenanceBatch ? 300_000 : 60_000);
    } catch (error) {
      for (const job of claimed) await failTranslatedJob(db, job.id, error);
      continue;
    }
    for (const job of claimed) {
      try {
        const text = translated.get(job.id);
        if (!text) throw new Error("Missing translation for requested target");
        await saveTranslatedJob(db, job, text);
      } catch (error) {
        await failTranslatedJob(db, job.id, error);
      }
    }
  }
}

/**
 * Get translations for an entity (with cache + fallback)
 */
export async function getEntityTranslations(
  entityType: string,
  entityId: number,
  languageCode: SupportedLanguage,
  fieldNames?: string[]
): Promise<Record<string, { text: string | null; status: string; isOriginal: boolean }>> {
  const db = await getDb();
  const result: Record<string, { text: string | null; status: string; isOriginal: boolean }> = {};

  if (!db) return result;

  const fields = fieldNames || ENTITY_FIELD_MAP[entityType] || [];

  for (const fieldName of fields) {
    // Check cache first
    const cached = translationCache.get(entityType, entityId, fieldName, languageCode);
    if (cached) {
      result[fieldName] = { text: cached, status: "completed", isOriginal: false };
      continue;
    }

    // Query DB
    const [record] = await db.select().from(entityTranslations).where(
      and(
        eq(entityTranslations.entityType, entityType),
        eq(entityTranslations.entityId, entityId),
        eq(entityTranslations.fieldName, fieldName),
        eq(entityTranslations.languageCode, languageCode)
      )
    ).limit(1);

    if (record?.translatedText && (record.translationStatus === "completed" || record.translationStatus === "approved")) {
      // Cache it
      translationCache.set(entityType, entityId, fieldName, languageCode, record.translatedText);
      result[fieldName] = {
        text: record.translatedText,
        status: record.translationStatus,
        isOriginal: false,
      };
    } else {
      // Fallback: return null (frontend will show original text)
      result[fieldName] = {
        text: null,
        status: record?.translationStatus || "not_found",
        isOriginal: true,
      };
    }
  }

  return result;
}

/**
 * Get translations for multiple entities at once (batch)
 */
export async function getBatchTranslations(
  entityType: string,
  entityIds: number[],
  languageCode: SupportedLanguage,
  fieldNames?: string[]
): Promise<Record<number, Record<string, { text: string | null; status: string; isOriginal: boolean }>>> {
  const db = await getDb();
  const result: Record<number, Record<string, { text: string | null; status: string; isOriginal: boolean }>> = {};

  if (!db || entityIds.length === 0) return result;

  // Initialize all entities
  for (const id of entityIds) {
    result[id] = {};
  }

  // Batch query all translations
  const records = await db.select().from(entityTranslations).where(
    and(
      eq(entityTranslations.entityType, entityType),
      inArray(entityTranslations.entityId, entityIds),
      eq(entityTranslations.languageCode, languageCode)
    )
  );

  const fields = fieldNames || ENTITY_FIELD_MAP[entityType] || [];

  // Index records
  const recordMap = new Map<string, typeof records[0]>();
  for (const r of records) {
    recordMap.set(`${r.entityId}:${r.fieldName}`, r);
  }

  for (const id of entityIds) {
    for (const fieldName of fields) {
      const cached = translationCache.get(entityType, id, fieldName, languageCode);
      if (cached) {
        result[id][fieldName] = { text: cached, status: "completed", isOriginal: false };
        continue;
      }

      const record = recordMap.get(`${id}:${fieldName}`);
      if (record?.translatedText && (record.translationStatus === "completed" || record.translationStatus === "approved")) {
        translationCache.set(entityType, id, fieldName, languageCode, record.translatedText);
        result[id][fieldName] = { text: record.translatedText, status: record.translationStatus, isOriginal: false };
      } else {
        result[id][fieldName] = { text: null, status: record?.translationStatus || "not_found", isOriginal: true };
      }
    }
  }

  return result;
}

/**
 * Manual Override - update translation manually (marks as "approved")
 */
export async function manualOverrideTranslation(
  entityType: string,
  entityId: number,
  fieldName: string,
  languageCode: SupportedLanguage,
  translatedText: string,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[TranslationEngine] Failed to get database connection for processTranslationJobs. Job aborted.");
    return;
  }

  const [existing] = await db.select().from(entityTranslations).where(
    and(
      eq(entityTranslations.entityType, entityType),
      eq(entityTranslations.entityId, entityId),
      eq(entityTranslations.fieldName, fieldName),
      eq(entityTranslations.languageCode, languageCode)
    )
  ).limit(1);

  if (existing) {
    const newVersion = existing.versionNumber + 1;

    // Save version history
    await db.insert(translationVersions).values({
      entityTranslationId: existing.id,
      versionNumber: newVersion,
      translatedText,
      translationStatus: "approved",
      changedById: userId,
      changeReason: "manual_edit",
    });

    await db.update(entityTranslations).set({
      translatedText,
      translationStatus: "approved",
      versionNumber: newVersion,
      approvedById: userId,
      approvedAt: new Date(),
      errorMessage: null,
    }).where(eq(entityTranslations.id, existing.id));
  } else {
    const [insertResult] = await db.insert(entityTranslations).values({
      entityType,
      entityId,
      fieldName,
      languageCode,
      translatedText,
      translationStatus: "approved",
      versionNumber: 1,
      approvedById: userId,
      approvedAt: new Date(),
    });

    // Save version history
    await db.insert(translationVersions).values({
      entityTranslationId: insertResult.insertId,
      versionNumber: 1,
      translatedText,
      translationStatus: "approved",
      changedById: userId,
      changeReason: "manual_edit",
    });
  }

  // Update cache
  translationCache.set(entityType, entityId, fieldName, languageCode, translatedText);

  // Audit log
  await db.insert(auditLogs).values({
    userId,
    action: "manual_translation_override",
    entityType: "TRANSLATION",
    entityId,
    newValues: JSON.stringify({ entityType, fieldName, languageCode, translatedText }),
  });
}

/**
 * Get translation version history
 */
export async function getTranslationVersions(
  entityType: string,
  entityId: number,
  fieldName: string,
  languageCode: SupportedLanguage
) {
  const db = await getDb();
  if (!db) {
    console.error("[TranslationEngine] Failed to get database connection for queueTranslation. Job aborted.");
    return [];
  }

  const [etRecord] = await db.select().from(entityTranslations).where(
    and(
      eq(entityTranslations.entityType, entityType),
      eq(entityTranslations.entityId, entityId),
      eq(entityTranslations.fieldName, fieldName),
      eq(entityTranslations.languageCode, languageCode)
    )
  ).limit(1);

  if (!etRecord) return [];

  return db.select().from(translationVersions)
    .where(eq(translationVersions.entityTranslationId, etRecord.id))
    .orderBy(desc(translationVersions.versionNumber));
}

/**
 * Retry failed translation jobs
 */
export async function retryFailedJobs(entityType?: string, jobId?: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  const conditions: any[] = [eq(translationJobs.status, "failed"), automaticTranslationScope(translationJobs.entityType, translationJobs.entityId),
    sql`EXISTS (SELECT 1 FROM entity_translations et WHERE et.entityType = ${translationJobs.entityType}
      AND et.entityId = ${translationJobs.entityId} AND et.fieldName = ${translationJobs.fieldName}
      AND et.languageCode = ${translationJobs.targetLanguage} AND et.translationJobId = ${translationJobs.id}
      AND et.translationStatus IN ('failed', 'pending'))`];
  if (jobId !== undefined) conditions.push(eq(translationJobs.id, jobId));
  if (entityType) conditions.push(eq(translationJobs.entityType, entityType));

  const failedJobs = await db.select().from(translationJobs).where(and(...conditions))
    .orderBy(translationJobs.id).limit(jobId !== undefined ? 1 : TRANSLATION_RETRY_BATCH_SIZE);

  const jobIds: number[] = [];
  for (const job of failedJobs) {
    const [reset] = await db.update(translationJobs).set({
      status: "pending",
      retryCount: 0,
      errorMessage: null,
    }).where(and(eq(translationJobs.id, job.id), eq(translationJobs.status, "failed"),
      automaticTranslationScope(translationJobs.entityType, translationJobs.entityId)));
    if (!reset.affectedRows) continue;

    // Reset entity_translations status
    await db.update(entityTranslations).set({
      translationStatus: "pending",
      errorMessage: null,
    }).where(
      and(
        eq(entityTranslations.entityType, job.entityType),
        eq(entityTranslations.entityId, job.entityId),
        eq(entityTranslations.fieldName, job.fieldName),
        eq(entityTranslations.languageCode, job.targetLanguage),
        eq(entityTranslations.translationJobId, job.id),
        inArray(entityTranslations.translationStatus, ["failed", "pending"])
      )
    );

    jobIds.push(job.id);
  }

  // Process retried jobs
  if (jobIds.length > 0) {
    processTranslationJobs(jobIds).catch(console.error);
  }

  return jobIds.length;
}

/**
 * Get translation statistics for monitoring
 */
export async function getTranslationStats() {
  const db = await getDb();
  if (!db) return null;

  const [total] = await db.select({ cnt: sql<number>`count(*)` }).from(entityTranslations);
  const [pending] = await db.select({ cnt: sql<number>`count(*)` }).from(entityTranslations)
    .where(eq(entityTranslations.translationStatus, "pending"));
  const [processing] = await db.select({ cnt: sql<number>`count(*)` }).from(entityTranslations)
    .where(eq(entityTranslations.translationStatus, "processing"));
  const [completed] = await db.select({ cnt: sql<number>`count(*)` }).from(entityTranslations)
    .where(eq(entityTranslations.translationStatus, "completed"));
  const [failed] = await db.select({ cnt: sql<number>`count(*)` }).from(entityTranslations)
    .where(eq(entityTranslations.translationStatus, "failed"));
  const [approved] = await db.select({ cnt: sql<number>`count(*)` }).from(entityTranslations)
    .where(eq(entityTranslations.translationStatus, "approved"));

  const [jobsPending] = await db.select({ cnt: sql<number>`count(*)` }).from(translationJobs)
    .where(eq(translationJobs.status, "pending"));
  const [jobsProcessing] = await db.select({ cnt: sql<number>`count(*)` }).from(translationJobs)
    .where(eq(translationJobs.status, "processing"));
  const [jobsFailed] = await db.select({ cnt: sql<number>`count(*)` }).from(translationJobs)
    .where(eq(translationJobs.status, "failed"));

  // By entity type
  const byEntity = await db.select({
    entityType: entityTranslations.entityType,
    cnt: sql<number>`count(*)`,
  }).from(entityTranslations).groupBy(entityTranslations.entityType);

  // By language
  const byLanguage = await db.select({
    languageCode: entityTranslations.languageCode,
    cnt: sql<number>`count(*)`,
  }).from(entityTranslations).groupBy(entityTranslations.languageCode);

  return {
    translations: {
      total: total?.cnt || 0,
      pending: pending?.cnt || 0,
      processing: processing?.cnt || 0,
      completed: completed?.cnt || 0,
      failed: failed?.cnt || 0,
      approved: approved?.cnt || 0,
    },
    jobs: {
      pending: jobsPending?.cnt || 0,
      processing: jobsProcessing?.cnt || 0,
      failed: jobsFailed?.cnt || 0,
    },
    byEntity: byEntity.map(e => ({ entityType: e.entityType, count: e.cnt })),
    byLanguage: byLanguage.map(l => ({ languageCode: l.languageCode, count: l.cnt })),
    cacheSize: translationCache.size,
  };
}

/**
 * Get failed/pending translations for admin monitoring
 */
export async function getTranslationJobsList(filters?: {
  status?: string;
  entityType?: string;
  entityId?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    console.error("[TranslationEngine] Failed to get database connection for queueTranslation. Job aborted.");
    return [];
  }

  const conditions: any[] = [];
  if (filters?.status) conditions.push(eq(translationJobs.status, filters.status as any));
  if (filters?.entityType) conditions.push(eq(translationJobs.entityType, filters.entityType));
  if (filters?.entityId) conditions.push(eq(translationJobs.entityId, filters.entityId));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  return db.select({ ...getTableColumns(translationJobs),
    automaticTranslationEnabled: automaticTranslationScope(translationJobs.entityType, translationJobs.entityId).mapWith(Number),
  }).from(translationJobs)
    .where(where)
    .orderBy(desc(translationJobs.createdAt))
    .limit(filters?.limit || 100);
}

/**
 * Update user preferred language
 */
export async function updateUserLanguage(userId: number, language: SupportedLanguage) {
  const db = await getDb();
  if (!db) {
    console.error("[TranslationEngine] Failed to get database connection for processTranslationJobs. Job aborted.");
    return;
  }
  const { users } = await import("../../../drizzle/schema");
  await db.update(users).set({ preferredLanguage: language }).where(eq(users.id, userId));
}

/**
 * استعادة الـ jobs المعلقة عند بدء تشغيل السيرفر
 */
export async function recoverPendingTranslations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const pending = await db.select()
    .from(translationJobs)
    .where(and(automaticTranslationScope(translationJobs.entityType, translationJobs.entityId),
      sql`(${translationJobs.status} = 'pending' OR (${translationJobs.status} = 'processing'
        AND ${translationJobs.updatedAt} < DATE_SUB(NOW(), INTERVAL 30 MINUTE)))`,
      sql`EXISTS (SELECT 1 FROM entity_translations et WHERE et.translationJobId = ${translationJobs.id}
        AND et.entityType = ${translationJobs.entityType} AND et.entityId = ${translationJobs.entityId}
        AND et.fieldName = ${translationJobs.fieldName} AND et.languageCode = ${translationJobs.targetLanguage}
        AND et.translationStatus IN ('pending', 'processing', 'failed'))`))
    .limit(50);

  if (pending.length === 0) {
    console.log("[TranslationEngine] No pending translation jobs to recover.");
    return;
  }

  console.log(`[TranslationEngine] Recovering ${pending.length} pending translation jobs...`);

  // أعد وضع الـ processing كـ pending إذا كانت stuck
  const processingIds = pending
    .filter(j => j.status === "processing")
    .map(j => j.id);

  if (processingIds.length > 0) {
    await db.update(translationJobs)
      .set({ status: "pending" })
      .where(and(inArray(translationJobs.id, processingIds),
        automaticTranslationScope(translationJobs.entityType, translationJobs.entityId)));
  }

  const allPendingIds = pending.map(j => j.id);
  processTranslationJobs(allPendingIds).catch(e =>
    console.error("[TranslationEngine] Recovery processing error:", e)
  );
}

/**
 * ✅ إصلاح: يكتشف بلاغات (وأي كيان آخر لاحقًا) لم تُنشأ لها أي مهمة ترجمة إطلاقًا —
 * حالة أخطر من "المهمة المعلَّقة" التي تغطيها recoverPendingTranslations، لأنها تعني
 * أن queueTranslation نفسه فشل بصمت عند الإنشاء (مثال حقيقي: انقطاع اتصال مؤقت بقاعدة
 * البيانات في نفس لحظة إنشاء البلاغ) ولم يترك أي أثر (لا مهمة pending ولا حتى failed).
 * يُنفَّذ دوريًا (راجع server/_core/index.ts) ويكتفي بالبلاغات الحديثة لتفادي فحص كامل الجدول.
 */
export async function queueMissingTranslations(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const recentTickets = await db.select({
    id: tickets.id,
    title: tickets.title,
    description: tickets.description,
    originalLanguage: tickets.originalLanguage,
  }).from(tickets)
    .where(sql`${tickets.createdAt} >= DATE_SUB(NOW(), INTERVAL 7 DAY)`)
    .limit(200);

  if (recentTickets.length > 0) {
    const existing = await db.select({ entityId: entityTranslations.entityId })
      .from(entityTranslations)
      .where(and(
        eq(entityTranslations.entityType, "TICKET"),
        inArray(entityTranslations.entityId, recentTickets.map(t => t.id))
      ));
    const hasAnyTranslation = new Set(existing.map(e => e.entityId));

    const missing = recentTickets.filter(t => !hasAnyTranslation.has(t.id));
    if (missing.length === 0) {
      console.log("[TranslationEngine] No tickets missing translations entirely.");
    } else {
      console.log(`[TranslationEngine] Found ${missing.length} ticket(s) with zero translation records — re-queueing...`);
      for (const t of missing) {
        const fields: TranslatableField[] = [
          { fieldName: "title", text: t.title },
          ...(t.description ? [{ fieldName: "description", text: t.description }] : []),
        ];
        await queueTranslation({
          entityType: "TICKET",
          entityId: t.id,
          fields,
          sourceLanguage: (t.originalLanguage as SupportedLanguage) || "ar",
        }).catch(e => console.error(`[TranslationEngine] Re-queue failed for ticket ${t.id}:`, e));
      }
    }
  }

  // Master-data names are intentionally kept in their source tables unchanged.
  // Missing display translations are generated in entity_translations only, so
  // historical/master records are never rewritten. Each recovery cycle picks
  // the next bounded set that has no name translation rows yet.
  const missingAssets = await db.select({ id: assets.id, name: assets.name })
    .from(assets)
    .where(sql`NOT EXISTS (
      SELECT 1 FROM entity_translations et
      WHERE et.entityType = 'ASSET' AND et.entityId = ${assets.id} AND et.fieldName = 'name'
    )`)
    .limit(200);
  const missingCategories = await db.select({ id: centerCategories.id, name: centerCategories.name })
    .from(centerCategories)
    .where(sql`NOT EXISTS (
      SELECT 1 FROM entity_translations et
      WHERE et.entityType = 'CENTER_CATEGORY' AND et.entityId = ${centerCategories.id} AND et.fieldName = 'name'
    )`)
    .limit(200);
  const missingAssetCategories = await db.select({ id: assetCategories.id, name: assetCategories.name })
    .from(assetCategories)
    .where(sql`NOT EXISTS (
      SELECT 1 FROM entity_translations et
      WHERE et.entityType = 'ASSET_CATEGORY' AND et.entityId = ${assetCategories.id} AND et.fieldName = 'name'
    )`)
    .limit(200);
  const missingUsers = await db.select({ id: users.id, name: users.name })
    .from(users)
    .where(sql`NOT EXISTS (
      SELECT 1 FROM entity_translations et
      WHERE et.entityType = 'USER' AND et.entityId = ${users.id} AND et.fieldName = 'name'
    )`)
    .limit(200);

  const masterSources: Array<{ entityType: string; rows: Array<{ id: number; name: string | null }> }> = [
    { entityType: "ASSET", rows: missingAssets },
    { entityType: "CENTER_CATEGORY", rows: missingCategories },
    { entityType: "ASSET_CATEGORY", rows: missingAssetCategories },
    { entityType: "USER", rows: missingUsers },
  ];
  const { detectLanguage } = await import("./translation");
  for (const source of masterSources) {
    for (const row of source.rows.filter((item) => item.name && item.name.trim())) {
      const sourceLanguage = await detectLanguage(row.name!);
      await queueTranslation({
        entityType: source.entityType,
        entityId: row.id,
        fields: [{ fieldName: "name", text: row.name! }],
        sourceLanguage,
      }).catch((error) => console.error(`[TranslationEngine] Master-data translation queue failed for ${source.entityType} ${row.id}:`, error));
    }
  }
}

