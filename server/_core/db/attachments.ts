// ============================================================
// db/attachments.ts — المرفقات
// (مُقسَّم من db.ts الأصلي حسب المجال الوظيفي)
// ============================================================
import { eq, desc, asc, and, sql, count, sum, inArray, notInArray, like, or, gte, lte, lt, isNull, isNotNull, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { alias } from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";
import {
  InsertUser, users, tickets, purchaseOrders, purchaseOrderItems,
  inventory, inventoryTransactions, notifications, auditLogs,
  ticketStatusHistory, attachments, sites, backups,
  assets, preventivePlans, pmWorkOrders, assetSpareParts, pmJobs, assetMetrics,
  pmChecklistItems, pmWorkOrderBranches,
  twoFactorSecrets, twoFactorAuditLogs,
  pushSubscriptions, sections, technicians, inspectionResults,
  type InsertAsset, type InsertPreventivePlan, type PreventivePlan, type InsertPMWorkOrder,
  type InsertSection, type InsertInspectionResult,
  assetCategories,
  procurementComments,
  type InsertProcurementComment,
  warehouseReceipts,
  warehouseReturns,
  warehouseReceiptItems,
  ocrJobs,
  type InsertWarehouseReceipt,
  type InsertWarehouseReturn,
  ticketConfirmations,
  type InsertTicketConfirmation,
  deliveryDocuments,
  returnDocuments,
  deliveryNumberCounter,
  itemBarcodeCounter,
  disposalOperations,
  disposalItems,
  disposalNumberCounter,
  poPricingBatches,
  purchasePackageSubmissions,
  type InsertPOPricingBatch,
  inventoryCountOperations,
  inventoryCountItems,
  inventorySettlements,
  inventorySettlementItems,
  inventoryCountNumberCounter,
  inventorySettlementNumberCounter,
} from "../../../drizzle/schema";
import { ENV } from '../env';


import { getDb } from "./client";

// ============================================================
// ATTACHMENTS
// ============================================================
export async function createAttachment(data: any) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(attachments).values(data);
  return result[0].insertId;
}

export async function getAttachments(entityType: string, entityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attachments).where(and(eq(attachments.entityType, entityType), eq(attachments.entityId, entityId))).orderBy(desc(attachments.createdAt));
}

/**
 * كل مرفقات نوع كيان بعينه، بلا تحديد entityId — لعرض مجمَّع بمركز المستندات.
 * الخطوة الجديدة (2026-08-10): "الوثائق المالية المعتمدة"
 * (entityType = "po_financial_batch"). لا فحص صلاحية هنا — يُفرض على مستوى
 * الإجراء المستدعي (راجع attachmentsRouter.listByType، مقيَّد بأدوار مالية).
 */
export async function getAttachmentsByType(entityType: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(attachments).where(eq(attachments.entityType, entityType)).orderBy(desc(attachments.createdAt));
}

/**
 * "الوثائق المالية المعتمدة" مع اسم المندوب.
 *
 * تدعم نوعين معزولين من الارتباط داخل نفس تبويب مركز المستندات:
 * - po_financial_batch: المستندات القديمة، entityId = po_pricing_batches.id.
 * - purchase_package_submission_financial: مستند الحزمة الموحد،
 *   entityId = purchase_package_submissions.id.
 *
 * الفصل بين النوعين يمنع تداخل أرقام Pricing Batch مع أرقام دفعات الإرسال،
 * مع إبقاء واجهة مركز المستندات الحالية وقواعد صلاحياتها كما هي.
 */
export async function getFinancialBatchAttachmentsWithDelegate() {
  const db = await getDb();
  if (!db) return [];

  // المستندات القديمة: entityId = po_pricing_batches.id
  const legacyRows = await db
    .select({
      id: attachments.id,
      entityType: attachments.entityType,
      entityId: attachments.entityId,
      fileName: attachments.fileName,
      fileUrl: attachments.fileUrl,
      fileKey: attachments.fileKey,
      mimeType: attachments.mimeType,
      fileSize: attachments.fileSize,
      uploadedById: attachments.uploadedById,
      createdAt: attachments.createdAt,
      delegateId: poPricingBatches.submittedById,
      delegateName: users.name,
      totalEstimatedCost: poPricingBatches.totalEstimatedCost,
      custodyBalance: poPricingBatches.custodyAmount,
      financialDocumentScope: sql<string>`'pricing_batch'`,
    })
    .from(attachments)
    .leftJoin(poPricingBatches, eq(attachments.entityId, poPricingBatches.id))
    .leftJoin(users, eq(poPricingBatches.submittedById, users.id))
    .where(eq(attachments.entityType, "po_financial_batch"));

  // مستندات دفعات الحزم الجديدة: entityId = purchase_package_submissions.id.
  // نقرأ المندوب من أول Pricing Batch تابع للإرسال؛ كل إرسال يُنشئه مندوب
  // واحد في المسار الحالي، ولا نخزن delegateId مكررًا على سجل المرفق نفسه.
  const packageAttachments = await db
    .select()
    .from(attachments)
    .where(eq(attachments.entityType, "purchase_package_submission_financial"));

  const packageRows: any[] = [];
  for (const attachment of packageAttachments as any[]) {
    const submissionRows = await db
      .select({
        id: purchasePackageSubmissions.id,
        totalEstimatedCost: purchasePackageSubmissions.totalEstimatedCost,
        custodyBalance: purchasePackageSubmissions.custodyBalance,
      })
      .from(purchasePackageSubmissions)
      .where(eq(purchasePackageSubmissions.id, attachment.entityId))
      .limit(1);
    const submission = submissionRows[0];

    const batchRows = await db
      .select({ submittedById: poPricingBatches.submittedById })
      .from(poPricingBatches)
      .where(eq(poPricingBatches.purchasePackageSubmissionId, attachment.entityId))
      .limit(1);
    const delegateId = batchRows[0]?.submittedById ?? null;

    let delegateName: string | null = null;
    if (delegateId != null) {
      const userRows = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, delegateId))
        .limit(1);
      delegateName = userRows[0]?.name ?? null;
    }

    packageRows.push({
      ...attachment,
      delegateId,
      delegateName,
      totalEstimatedCost: submission?.totalEstimatedCost ?? null,
      custodyBalance: submission?.custodyBalance ?? null,
      financialDocumentScope: "package_submission",
    });
  }

  return [...legacyRows, ...packageRows].sort((a: any, b: any) =>
    new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
  );
}

/**
 * وثائق التسعير الصادرة من المندوبين — تجمع المستندات المؤرشفة عند لحظة
 * الإرسال للحسابات، سواء دفعة طلب مفرد أو دفعة إرسال حزمة.
 */
export async function getDelegatePricingAttachmentsWithDelegate() {
  const db = await getDb();
  if (!db) return [];

  const singleRows = await db
    .select({
      id: attachments.id,
      entityType: attachments.entityType,
      entityId: attachments.entityId,
      fileName: attachments.fileName,
      fileUrl: attachments.fileUrl,
      fileKey: attachments.fileKey,
      mimeType: attachments.mimeType,
      fileSize: attachments.fileSize,
      uploadedById: attachments.uploadedById,
      createdAt: attachments.createdAt,
      delegateId: poPricingBatches.submittedById,
      delegateName: users.name,
      totalEstimatedCost: poPricingBatches.totalEstimatedCost,
      pricingDocumentScope: sql<string>`'pricing_batch'`,
    })
    .from(attachments)
    .leftJoin(poPricingBatches, eq(attachments.entityId, poPricingBatches.id))
    .leftJoin(users, eq(poPricingBatches.submittedById, users.id))
    .where(eq(attachments.entityType, "delegate_pricing_batch"));

  const packageAttachments = await db
    .select()
    .from(attachments)
    .where(eq(attachments.entityType, "delegate_package_submission_pricing"));

  const packageRows: any[] = [];
  for (const attachment of packageAttachments as any[]) {
    const batches = await db
      .select({
        submittedById: poPricingBatches.submittedById,
        totalEstimatedCost: poPricingBatches.totalEstimatedCost,
      })
      .from(poPricingBatches)
      .where(eq(poPricingBatches.purchasePackageSubmissionId, attachment.entityId));

    const delegateId = batches[0]?.submittedById ?? attachment.uploadedById ?? null;
    let delegateName: string | null = null;
    if (delegateId != null) {
      const userRows = await db.select({ name: users.name }).from(users).where(eq(users.id, delegateId)).limit(1);
      delegateName = userRows[0]?.name ?? null;
    }
    const totalEstimatedCost = batches.reduce((sum: number, b: any) =>
      sum + Number(b.totalEstimatedCost || 0), 0
    );

    packageRows.push({
      ...attachment,
      delegateId,
      delegateName,
      totalEstimatedCost: totalEstimatedCost.toFixed(2),
      pricingDocumentScope: "package_submission",
    });
  }

  return [...singleRows, ...packageRows].sort((a: any, b: any) =>
    new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime()
  );
}

export async function getAttachmentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return result[0] || null;
}

export async function deleteAttachment(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(attachments).where(eq(attachments.id, id));
}

