import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { purchaseOrders, purchaseOrderItems, warehouseReceiptItems, warehouseReceipts } from "../../../drizzle/schema";

type ReceiptCandidate = {
  id: number;
  purchaseOrderId: number;
  status: string;
  supplierInvoiceNumber?: string | null;
};

// The receipt workflow is item-scoped. A later pricing batch must not hide
// already delivered items merely because the parent returns to approved.
export function eligiblePurchaseReceiptItems<T extends ReceiptCandidate>(
  items: T[], confirmedItemIds: number[], invoiceNumber?: string,
): T[] {
  const confirmed = new Set(confirmedItemIds);
  return items.filter(item =>
    item.status === "delivered_to_warehouse" &&
    !confirmed.has(item.id) &&
    (invoiceNumber === undefined || item.supplierInvoiceNumber === invoiceNumber ||
      (invoiceNumber === "بدون رقم فاتورة" && !item.supplierInvoiceNumber)),
  );
}

export async function getPurchaseReceiptContext(database: any, purchaseOrderId: number, invoiceNumber?: string) {
  const [po] = await database.select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
    .from(purchaseOrders).where(eq(purchaseOrders.id, purchaseOrderId)).limit(1);
  if (!po) throw new TRPCError({ code: "NOT_FOUND", message: "طلب الشراء غير موجود" });

  // Only fields consumed by receiving; no parent approvals, comments or other items.
  const items = await database.select({
    id: purchaseOrderItems.id, purchaseOrderId: purchaseOrderItems.purchaseOrderId,
    status: purchaseOrderItems.status, supplierInvoiceNumber: purchaseOrderItems.supplierInvoiceNumber,
    itemName: purchaseOrderItems.itemName, quantity: purchaseOrderItems.quantity,
    receivedQuantity: purchaseOrderItems.receivedQuantity, unit: purchaseOrderItems.unit,
    catalogItemId: purchaseOrderItems.catalogItemId,
    actualUnitCost: purchaseOrderItems.actualUnitCost, estimatedUnitCost: purchaseOrderItems.estimatedUnitCost,
  }).from(purchaseOrderItems).where(and(
    eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId),
    eq(purchaseOrderItems.status, "delivered_to_warehouse"),
  ));
  const confirmed = await database.select({ itemId: warehouseReceiptItems.purchaseOrderItemId })
    .from(warehouseReceiptItems)
    .innerJoin(warehouseReceipts, eq(warehouseReceipts.id, warehouseReceiptItems.receiptId))
    .innerJoin(purchaseOrderItems, eq(purchaseOrderItems.id, warehouseReceiptItems.purchaseOrderItemId))
    .where(and(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId), eq(warehouseReceipts.status, "confirmed")));
  return { ...po, items: eligiblePurchaseReceiptItems(items, confirmed.map((r: any) => Number(r.itemId)), invoiceNumber) };
}

export function validatePurchaseReceiptSelection(
  purchaseOrderId: number, selectedIds: number[], currentItems: ReceiptCandidate[], confirmedItemIds: number[],
): void {
  if (!selectedIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "اختر صنفاً مؤهلاً من طلب الشراء. للاستلام دون بنود طلب استخدم الاستلام المستقل." });
  }
  if (new Set(selectedIds).size !== selectedIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "لا يمكن تكرار نفس بند طلب الشراء في سند الاستلام" });
  }
  const valid = new Set(eligiblePurchaseReceiptItems(
    currentItems.filter(item => item.purchaseOrderId === purchaseOrderId), [],
  ).map(item => item.id));
  if (selectedIds.some(id => !valid.has(id))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "أحد الأصناف لا ينتمي لهذا الطلب أو لم يعد مؤهلاً للاستلام. حدّث الصفحة." });
  }
  if (selectedIds.some(id => confirmedItemIds.includes(id))) {
    throw new TRPCError({ code: "CONFLICT", message: "سبق إكمال إدخال أحد الأصناف للمخزون. حدّث الصفحة لتجنب تكرار الاستلام." });
  }
}

// Called BEFORE writes, inside the existing receipt transaction. Locking the
// same PO item rows serializes competing saves through this endpoint. The
// confirmed-receipt check is also a current/locking read (not an old snapshot).
export async function lockAndValidatePurchaseReceiptItems(
  tx: any, purchaseOrderId: number, items: Array<{ purchaseOrderItemId?: number }>,
): Promise<void> {
  const ids = items.map(item => item.purchaseOrderItemId).filter((id): id is number => id != null);
  if (!ids.length || new Set(ids).size !== ids.length) {
    validatePurchaseReceiptSelection(purchaseOrderId, ids, [], []);
  }
  const sortedIds = [...ids].sort((a, b) => a - b);
  const current = await tx.select({
    id: purchaseOrderItems.id, purchaseOrderId: purchaseOrderItems.purchaseOrderId, status: purchaseOrderItems.status,
  }).from(purchaseOrderItems)
    .where(and(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId), inArray(purchaseOrderItems.id, sortedIds)))
    .orderBy(asc(purchaseOrderItems.id)).for("update");
  const confirmed = await tx.select({ itemId: warehouseReceiptItems.purchaseOrderItemId })
    .from(warehouseReceiptItems)
    .innerJoin(warehouseReceipts, eq(warehouseReceipts.id, warehouseReceiptItems.receiptId))
    .where(and(inArray(warehouseReceiptItems.purchaseOrderItemId, sortedIds), eq(warehouseReceipts.status, "confirmed")))
    .for("update");
  validatePurchaseReceiptSelection(purchaseOrderId, ids, current, confirmed.map((r: any) => Number(r.itemId)));
}
