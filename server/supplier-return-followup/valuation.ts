import { sql } from "drizzle-orm";
import type { FollowupTx } from "./commands";
import { decimal4, format4, returnedInvoiceValue } from "./amounts";
import { ReturnFollowupError } from "./policy";

/** The invoice value is a compensation reference, never the stock movement's
 * average cost and never, by itself, confirmation that the supplier refunded it.
 */
export type ReturnValuation = {
  originalPurchaseValue: string | null;
  currency: "SAR" | null;
  valuationBasis: "tax_inclusive" | null;
  valuationSource: string | null;
  unavailableReason: string | null;
};
const unknown = (reason: string): ReturnValuation => ({ originalPurchaseValue: null, currency: null,
  valuationBasis: null, valuationSource: null, unavailableReason: reason });

export interface InvoiceLotSource {
  lotId: number;
  receiptItemId: number | null;
  originalQuantity: string | null;
  conversionFactor: string | null;
  purchaseUnit: string | null;
  issueUnit: string | null;
  receiptQuantity: string | null;
  receiptPurchaseUnit: string | null;
  invoiceUnitCost: string | null;
  invoiceTaxAmount: string | null;
  invoiceLineTotal: string | null;
}
const money = (value: unknown) => {
  if (value == null || value === "") throw Error("Missing decimal");
  return decimal4(String(value));
};
const abs = (n: bigint) => n < BigInt(0) ? -n : n;
const round = (n: bigint, unit: bigint) => ((n + unit / BigInt(2)) / unit) * unit;

/** Receipts currently store SAR and lineTotal inclusive of the recorded tax.
 * Check the persisted invoice arithmetic and conversion instead of treating a
 * legacy default lineTotal=0 as a free purchase. Missing facts stay unknown.
 * Cumulative rounding makes separate partial returns sum to the invoice value.
 */
export function valueReturnedQuantity(source: InvoiceLotSource, quantity: string, previouslyReturned = "0"): ReturnValuation {
  const incoming = money(quantity), previous = money(previouslyReturned);
  if (incoming <= BigInt(0) || incoming % BigInt(10) || previous % BigInt(10)) throw new ReturnFollowupError("INVALID", "كمية المرتجع غير صحيحة");
  if (!source.receiptItemId || !source.purchaseUnit?.trim() || !source.issueUnit?.trim()
    || source.purchaseUnit.trim() !== source.receiptPurchaseUnit?.trim()) {
    return unknown("بيانات وحدة فاتورة اللوت غير مكتملة؛ يلزم مراجعتها قبل التعويض المالي");
  }
  let original: bigint, received: bigint, factor: bigint, unitCost: bigint, tax: bigint, total: bigint;
  try {
    original = money(source.originalQuantity); received = money(source.receiptQuantity);
    factor = money(source.conversionFactor); unitCost = money(source.invoiceUnitCost);
    tax = money(source.invoiceTaxAmount); total = money(source.invoiceLineTotal);
  } catch { return unknown("قيمة فاتورة اللوت أو معامل تحويلها غير مكتمل؛ لا يمكن حساب قيمة المرتجع"); }
  if (original <= BigInt(0) || received <= BigInt(0) || factor <= BigInt(0) || original % BigInt(10) || received % BigInt(10)
    || round(received * factor / BigInt(10000), BigInt(10)) !== original) {
    return unknown("كمية اللوت لا تطابق كمية الفاتورة ومعامل التحويل المسجل");
  }
  // Receipt lineTotal is DECIMAL(12,2); unit cost is DECIMAL(12,4).
  if (total % BigInt(100) || tax % BigInt(100) || abs(round(received * unitCost / BigInt(10000), BigInt(100)) + tax - total) > BigInt(100)) {
    return unknown("إجمالي سطر الفاتورة لا يطابق الكمية والسعر والضريبة المسجلة");
  }
  if (previous + incoming > original) return unknown("إجمالي الكميات المرتجعة يتجاوز كمية اللوت الأصلية؛ يلزم مراجعة المصدر");
  const cumulative = money(returnedInvoiceValue(format4(total), format4(original), format4(previous + incoming)));
  const before = previous === BigInt(0) ? BigInt(0) : money(returnedInvoiceValue(format4(total), format4(original), format4(previous)));
  return { originalPurchaseValue: format4(cumulative - before), currency: "SAR", valuationBasis: "tax_inclusive",
    valuationSource: `receipt_item:${source.receiptItemId};lot:${source.lotId};cumulative_v1`, unavailableReason: null };
}

async function rows(tx: FollowupTx, query: Parameters<FollowupTx["execute"]>[0]): Promise<any[]> {
  const result = await tx.execute(query);
  if (!Array.isArray(result?.[0])) throw Error("Invalid supplier return valuation response");
  return result[0];
}

/** Source joins are checked explicitly; a missing/wrong parent is not replaced
 * with the first item or the receipt header's first PO in a multi-PO invoice.
 */
function sourceFromRow(row: any): InvoiceLotSource {
  if (!row || row.sourceType !== "receipt" || !row.actualReceiptId
    || Number(row.actualReceiptId) !== Number(row.receiptId)
    || (row.receiptItemId != null && (!row.actualReceiptItemId
      || Number(row.actualReceiptItemId) !== Number(row.receiptItemId)
      || Number(row.lineReceiptId) !== Number(row.receiptId)
      || nullableId(row.linePurchaseOrderItemId) !== nullableId(row.purchaseOrderItemId)))
    || (row.purchaseOrderId != null && Number(row.actualOrderId) !== Number(row.purchaseOrderId))
    || (row.purchaseOrderItemId != null && (Number(row.actualOrderItemId) !== Number(row.purchaseOrderItemId)
      || Number(row.itemOrderId) !== Number(row.purchaseOrderId)))
    || (row.catalogItemId != null && row.lineCatalogItemId != null && Number(row.catalogItemId) !== Number(row.lineCatalogItemId))) {
    throw new ReturnFollowupError("CONFLICT", "مصدر فاتورة اللوت غير متطابق؛ حدّث بيانات المرتجع قبل المتابعة");
  }
  return row as InvoiceLotSource;
}
const nullableId = (value: unknown) => value == null ? null : Number(value);
const sourceColumns = sql`l.id AS lotId,l.sourceType,l.receiptId,l.receiptItemId,l.purchaseOrderId,l.purchaseOrderItemId,l.catalogItemId,
  l.originalQuantity,l.conversionFactor,l.purchaseUnit,l.issueUnit,
  r.id AS actualReceiptId,r.vendorName,r.invoiceNumber,r.receiptNumber,
  i.id AS actualReceiptItemId,i.receiptId AS lineReceiptId,i.purchaseOrderItemId AS linePurchaseOrderItemId,i.catalogItemId AS lineCatalogItemId,
  i.receivedQuantity AS receiptQuantity,i.purchaseUnit AS receiptPurchaseUnit,i.unitCost AS invoiceUnitCost,i.taxAmount AS invoiceTaxAmount,i.lineTotal AS invoiceLineTotal,
  p.id AS actualOrderId,p.poNumber,p.requestedById,j.id AS actualOrderItemId,j.purchaseOrderId AS itemOrderId`;
const sourceJoins = sql`LEFT JOIN warehouse_receipts r ON r.id=l.receiptId
  LEFT JOIN warehouse_receipt_items i ON i.id=l.receiptItemId
  LEFT JOIN purchase_orders p ON p.id=l.purchaseOrderId LEFT JOIN purchase_order_items j ON j.id=l.purchaseOrderItemId`;

export async function previewReturnValuation(tx: FollowupTx, input: { trackingToken: string; warehouseId: number; returnedQuantity: number }) {
  const matches = await rows(tx, sql`SELECT ${sourceColumns},l.trackingToken,l.lotCode,l.remainingQuantity,b.quantity AS availableQuantity,v.quantity AS inventoryQuantity,
    COALESCE(NULLIF(v.issueUnit,''),v.unit) AS inventoryUnit,v.linkedItemId AS inventoryCatalogItemId
    FROM inventory_lots l INNER JOIN inventory_lot_balances b ON b.lotId=l.id
    INNER JOIN inventory v ON v.id=b.inventoryId INNER JOIN warehouses w ON w.id=v.warehouseId
    ${sourceJoins} WHERE w.id=${input.warehouseId} AND w.isActive=1 AND b.quantity>0
    AND (l.trackingToken=${input.trackingToken} OR l.lotCode=${input.trackingToken})`);
  if (matches.length !== 1) throw new ReturnFollowupError("CONFLICT", "الدفعة غير متاحة بصورة محددة في المستودع المختار");
  const row = matches[0], source = sourceFromRow(row);
  const available = Math.min(Number(row.availableQuantity), Number(row.inventoryQuantity), Number(row.remainingQuantity));
  if (!Number.isInteger(input.returnedQuantity) || input.returnedQuantity <= 0 || !Number.isFinite(available)
    || input.returnedQuantity > available) {
    throw new ReturnFollowupError("INVALID", "الكمية المطلوبة أكبر من المتاح أو غير صحيحة");
  }
  if (row.catalogItemId != null && row.inventoryCatalogItemId != null && Number(row.catalogItemId) !== Number(row.inventoryCatalogItemId)) {
    throw new ReturnFollowupError("CONFLICT", "هوية الصنف في اللوت لا تطابق المخزون");
  }
  if (source.issueUnit?.trim() !== row.inventoryUnit?.trim()) throw new ReturnFollowupError("CONFLICT", "وحدة اللوت لا تطابق وحدة صرف المخزون");
  const [prior] = await rows(tx, sql`SELECT COALESCE(SUM(returnedQuantity),0) AS quantity FROM warehouse_returns WHERE lotId=${Number(row.lotId)} AND sourceDeliveryDocumentId IS NULL`);
  return { ...valueReturnedQuantity(source, String(input.returnedQuantity), String(prior?.quantity ?? "0")),
    quantity: input.returnedQuantity, unit: source.issueUnit!, availableQuantity: available,
    vendorName: row.vendorName ?? null, invoiceNumber: row.invoiceNumber ?? null, lotCode: row.lotCode };
}

/** Call AFTER the canonical writer in its SAME transaction. The lot is already
 * locked by that writer. Current locking reads observe concurrent prior returns,
 * and any source mismatch rolls back the stock write rather than saving a guess.
 */
export async function savedReturnValuation(tx: FollowupTx, returnId: number) {
  const [row] = await rows(tx, sql`SELECT ${sourceColumns},ret.returnedQuantity,ret.inventoryId,
    ret.purchaseOrderId AS returnOrderId,ret.purchaseOrderItemId AS returnOrderItemId,ret.receiptId AS returnReceiptId
    FROM warehouse_returns ret INNER JOIN inventory_lots l ON l.id=ret.lotId ${sourceJoins}
    WHERE ret.id=${returnId} AND ret.sourceDeliveryDocumentId IS NULL FOR UPDATE`);
  const source = sourceFromRow(row);
  if (Number(row.returnReceiptId) !== Number(row.receiptId) || nullableId(row.returnOrderItemId) !== nullableId(row.purchaseOrderItemId)
    || (row.purchaseOrderId != null && Number(row.returnOrderId) !== Number(row.purchaseOrderId))) {
    throw new ReturnFollowupError("CONFLICT", "المرتجع لا يطابق مصدر اللوت");
  }
  const previous = await rows(tx, sql`SELECT id,returnedQuantity FROM warehouse_returns
    WHERE lotId=${Number(row.lotId)} AND id<>${returnId} AND sourceDeliveryDocumentId IS NULL ORDER BY id FOR UPDATE`);
  const previousQuantity = format4(previous.reduce((sum, item) => sum + money(item.returnedQuantity), BigInt(0)));
  return { source: row, valuation: valueReturnedQuantity(source, String(row.returnedQuantity), previousQuantity) };
}
