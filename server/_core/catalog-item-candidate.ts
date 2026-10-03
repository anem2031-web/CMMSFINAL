import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { catalogAuditLogs, catalogItemCandidates, inventory } from "../../drizzle/schema";

export interface CatalogItemCandidateSource {
  inventoryId: number;
  sourceReceiptId: number;
  sourceReceiptItemId: number;
  purchaseOrderId?: number;
  purchaseOrderItemId?: number;
  catalogSupplierId?: number;
  supplierCandidateId?: number;
  invoiceNumber?: string;
  itemName: string;
  itemNameAr?: string;
  itemNameEn?: string;
  supplierItemCode?: string;
  purchaseUnit?: string;
  manufacturerBarcode?: string;
  createdById: number;
}

export interface CatalogItemCandidateResult {
  id: number;
  created: boolean;
}

function cleanOptional(value?: string): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

/**
 * 2B-5 snapshot used by the future Catalog Review screen.
 * Operational quantity/cost are deliberately not duplicated here; the candidate
 * points to the receipt item and inventory identity, which remain the source of truth.
 */
export function buildCatalogItemCandidateValues(source: CatalogItemCandidateSource) {
  const itemName = source.itemName.trim();
  if (!itemName) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "اسم الصنف الجديد مطلوب لإنشاء مرشح مراجعة الكتالوج" });
  }

  return {
    inventoryId: source.inventoryId,
    sourceReceiptId: source.sourceReceiptId,
    sourceReceiptItemId: source.sourceReceiptItemId,
    purchaseOrderId: source.purchaseOrderId ?? null,
    purchaseOrderItemId: source.purchaseOrderItemId ?? null,
    catalogSupplierId: source.catalogSupplierId ?? null,
    supplierCandidateId: source.supplierCandidateId ?? null,
    invoiceNumber: cleanOptional(source.invoiceNumber),
    itemName,
    itemNameAr: cleanOptional(source.itemNameAr),
    itemNameEn: cleanOptional(source.itemNameEn),
    supplierItemCode: cleanOptional(source.supplierItemCode),
    purchaseUnit: cleanOptional(source.purchaseUnit),
    manufacturerBarcode: cleanOptional(source.manufacturerBarcode),
    status: "pending" as const,
    createdById: source.createdById,
  };
}

/**
 * Ensure exactly one Catalog Item Candidate per unresolved inventory identity.
 * The queue is non-blocking in workflow terms: warehouse receiving is not waiting
 * for Catalog approval. Candidate creation itself stays in the same DB transaction
 * so a successful receipt can never silently lose its Master Data review task.
 */
export async function ensurePendingCatalogItemCandidate(
  tx: any,
  source: CatalogItemCandidateSource,
): Promise<CatalogItemCandidateResult> {
  const invRows = await tx.select({
    id: inventory.id,
    linkedItemId: inventory.linkedItemId,
  }).from(inventory)
    .where(eq(inventory.id, source.inventoryId))
    .limit(1);

  const inv = invRows[0];
  if (!inv) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر العثور على سجل المخزون للصنف الجديد" });
  }
  if (inv.linkedItemId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "لا يمكن إرسال الصنف إلى مراجعة الكتالوج لأنه مرتبط مسبقاً بصنف كتالوج",
    });
  }

  const existingRows = await tx.select({
    id: catalogItemCandidates.id,
  }).from(catalogItemCandidates)
    .where(eq(catalogItemCandidates.inventoryId, source.inventoryId))
    .limit(1);

  if (existingRows[0]) {
    return { id: Number(existingRows[0].id), created: false };
  }

  const values = buildCatalogItemCandidateValues(source);
  try {
    const result = await tx.insert(catalogItemCandidates).values(values as any);
    const id = Number((result as any)[0]?.insertId || 0);
    if (!id) {
      throw new Error("catalog_item_candidates insert did not return insertId");
    }
    await tx.insert(catalogAuditLogs).values({
      userId: source.createdById,
      action: "create_item_candidate",
      entityType: "catalog_item_candidate",
      entityId: id,
      newValues: JSON.stringify({
        inventoryId: source.inventoryId,
        sourceReceiptId: source.sourceReceiptId,
        sourceReceiptItemId: source.sourceReceiptItemId,
        purchaseOrderId: source.purchaseOrderId ?? null,
        purchaseOrderItemId: source.purchaseOrderItemId ?? null,
        catalogSupplierId: source.catalogSupplierId ?? null,
        supplierCandidateId: source.supplierCandidateId ?? null,
        itemName: values.itemName,
        supplierItemCode: values.supplierItemCode,
        status: values.status,
      }),
    } as any);
    return { id, created: true };
  } catch (error: any) {
    // Concurrency safety: UNIQUE(inventoryId) may win in another request between
    // the SELECT and INSERT. Re-read and reuse that candidate instead of duplicating.
    const duplicate = error?.code === "ER_DUP_ENTRY" || String(error?.message || "").includes("Duplicate entry");
    if (duplicate) {
      const rows = await tx.select({ id: catalogItemCandidates.id })
        .from(catalogItemCandidates)
        .where(eq(catalogItemCandidates.inventoryId, source.inventoryId))
        .limit(1);
      if (rows[0]) return { id: Number(rows[0].id), created: false };
    }
    throw error;
  }
}
