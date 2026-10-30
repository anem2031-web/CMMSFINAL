import { inArray } from "drizzle-orm";
import { assets, centerCategories, sections, sites, users } from "../../../drizzle/schema";
import { getDb } from "../../_core/db";
import { ensureStoredNameTranslations } from "./translationEngine";
import type { SupportedLanguage } from "./translation";

/**
 * Localize master-data names without changing their stored source value.
 * `sourceName` is always exposed so admin edit forms can keep editing the
 * canonical database value instead of accidentally saving a translated label.
 */
export async function localizeNamedRecords<T extends { id: number; name?: string | null }>(
  entityType: string,
  records: T[],
  language: SupportedLanguage,
  options?: { translateMissing?: boolean },
): Promise<Array<T & { sourceName?: string | null }>> {
  if (!records.length) return records as Array<T & { sourceName?: string | null }>;
  const translatedNames = await ensureStoredNameTranslations(
    entityType,
    records as Array<T & { nameAr?: string | null; nameEn?: string | null; nameUr?: string | null }>,
    language,
    options,
  );

  return records.map((record) => {
    const sourceName = record.name ?? null;
    const translated = translatedNames.get(Number(record.id));
    return {
      ...record,
      sourceName,
      name: translated || sourceName,
    } as T & { sourceName?: string | null };
  });
}

/** Sites and sections already persist English/Urdu names in direct columns. */
export function localizeDirectNamedRecords<
  T extends { name?: string | null; nameEn?: string | null; nameUr?: string | null }
>(records: T[], language: SupportedLanguage): Array<T & { sourceName?: string | null }> {
  return records.map((record) => {
    const sourceName = record.name ?? null;
    const translated = language === "en"
      ? record.nameEn
      : language === "ur"
        ? record.nameUr
        : sourceName;
    return {
      ...record,
      sourceName,
      name: translated?.trim() || sourceName,
    } as T & { sourceName?: string | null };
  });
}


type ReferenceKind = "site" | "section" | "asset" | "user" | "category";
type ReferencePair = { kind: ReferenceKind; idField: string; nameField: string };

const MASTER_REFERENCE_PAIRS: ReferencePair[] = [
  { kind: "site", idField: "siteId", nameField: "siteName" },
  { kind: "section", idField: "sectionId", nameField: "sectionName" },
  { kind: "asset", idField: "assetId", nameField: "assetName" },
  { kind: "asset", idField: "assetId", nameField: "assetRegisteredName" },
  { kind: "category", idField: "categoryId", nameField: "centerCategoryName" },
  { kind: "user", idField: "userId", nameField: "userName" },
  { kind: "user", idField: "technicianId", nameField: "technicianName" },
  { kind: "user", idField: "createdById", nameField: "createdByName" },
  { kind: "user", idField: "updatedById", nameField: "updatedByName" },
  { kind: "user", idField: "reportedById", nameField: "reportedByName" },
  { kind: "user", idField: "assignedToId", nameField: "assignedToUserName" },
  { kind: "user", idField: "requestedById", nameField: "requestedByName" },
  { kind: "user", idField: "reviewedById", nameField: "reviewedByName" },
  { kind: "user", idField: "accountingApprovedById", nameField: "accountingApprovedByName" },
  { kind: "user", idField: "managementApprovedById", nameField: "managementApprovedByName" },
  { kind: "user", idField: "delegateId", nameField: "delegateName" },
  { kind: "user", idField: "responsibleManagerId", nameField: "responsibleManagerName" },
  { kind: "user", idField: "responsibleUserId", nameField: "responsibleUserName" },
  { kind: "user", idField: "actorUserId", nameField: "actorName" },
  { kind: "user", idField: "approvedById", nameField: "approvedByName" },
  { kind: "user", idField: "closedById", nameField: "closedByName" },
  { kind: "user", idField: "claimedById", nameField: "claimedByName" },
  { kind: "user", idField: "submittedById", nameField: "submittedByName" },
  { kind: "user", idField: "returnedById", nameField: "returnedByName" },
  { kind: "user", idField: "requesterId", nameField: "requesterName" },
];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || value instanceof Date) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Localize joined master-data labels already embedded in an arbitrary response.
 * The stored source records are never changed. Only response display fields are
 * replaced, and only when an explicit id/name pair is present on the same object.
 * Non-plain objects (Date, Buffer, class instances, etc.) are preserved verbatim.
 */
export async function localizeMasterDataReferences<T>(value: T, language: SupportedLanguage): Promise<T> {
  if (value == null || language === "ar" && typeof value !== "object") return value;
  const db = await getDb();
  if (!db || value == null || typeof value !== "object") return value;

  const ids: Record<ReferenceKind, Set<number>> = {
    site: new Set(), section: new Set(), asset: new Set(), user: new Set(), category: new Set(),
  };

  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    if (!isPlainRecord(node)) return;
    for (const pair of MASTER_REFERENCE_PAIRS) {
      if (!(pair.nameField in node)) continue;
      const id = Number(node[pair.idField]);
      if (Number.isInteger(id) && id > 0) ids[pair.kind].add(id);
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(value);

  const [siteRows, sectionRows, assetRows, userRows, categoryRows] = await Promise.all([
    ids.site.size ? db.select().from(sites).where(inArray(sites.id, [...ids.site])) : Promise.resolve([]),
    ids.section.size ? db.select().from(sections).where(inArray(sections.id, [...ids.section])) : Promise.resolve([]),
    ids.asset.size ? db.select({ id: assets.id, name: assets.name }).from(assets).where(inArray(assets.id, [...ids.asset])) : Promise.resolve([]),
    ids.user.size ? db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, [...ids.user])) : Promise.resolve([]),
    ids.category.size ? db.select({ id: centerCategories.id, name: centerCategories.name }).from(centerCategories).where(inArray(centerCategories.id, [...ids.category])) : Promise.resolve([]),
  ]);

  const siteLocalized = await localizeNamedRecords("SITE", siteRows as any[], language);
  const sectionLocalized = await localizeNamedRecords("SECTION", sectionRows as any[], language);
  const siteMap = new Map(siteLocalized.map((row: any) => [Number(row.id), row.name]));
  const sectionMap = new Map(sectionLocalized.map((row: any) => [Number(row.id), row.name]));
  const assetLocalized = await localizeNamedRecords("ASSET", assetRows as any[], language);
  const userLocalized = await localizeNamedRecords("USER", userRows as any[], language);
  const categoryLocalized = await localizeNamedRecords("CENTER_CATEGORY", categoryRows as any[], language);
  const maps: Record<ReferenceKind, Map<number, string | null | undefined>> = {
    site: siteMap,
    section: sectionMap,
    asset: new Map(assetLocalized.map((row: any) => [Number(row.id), row.name])),
    user: new Map(userLocalized.map((row: any) => [Number(row.id), row.name])),
    category: new Map(categoryLocalized.map((row: any) => [Number(row.id), row.name])),
  };

  const apply = (node: any): any => {
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map(apply);
    if (!isPlainRecord(node)) return node;
    const out: any = { ...node };
    for (const pair of MASTER_REFERENCE_PAIRS) {
      if (!(pair.nameField in node)) continue;
      const id = Number(node[pair.idField]);
      const localizedName = maps[pair.kind].get(id);
      if (localizedName) out[pair.nameField] = localizedName;
    }
    for (const [key, child] of Object.entries(node)) {
      if (child && typeof child === "object") out[key] = apply(child);
    }
    return out;
  };

  return apply(value) as T;
}
