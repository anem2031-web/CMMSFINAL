import { sql } from "drizzle-orm";
import { ReturnFollowupError } from "./policy";
import { decimal4 } from "./amounts";
import { readRows, trialEnabled } from "./runtime";
import type { FollowupTx } from "./commands";

type Actor = { id: number; role: string; isActive?: number };
type ReplacementItem = { catalogItemId?: number | null; itemName: string; quantity: number; unit?: string | null;
  siteId?: number | null; sectionId?: number | null; categoryId?: number | null; assetId?: number | null };
type Context = { siteId?: number | null; sectionId?: number | null; categoryId?: number | null; assetId?: number | null };
const conflict = (message: string): never => { throw new ReturnFollowupError("CONFLICT", message); };
const same = (a: unknown, b: unknown) => (a == null && b == null) || Number(a) === Number(b);
// Some historical orders have no site/section/category. The replacement must
// supply the now-required context without rewriting the historical order.
const matchesRecorded = (supplied: unknown, recorded: unknown) => recorded == null || same(supplied, recorded);

/** Called by the existing PO creator inside its transaction, before inserting
 * the header. The original requester and parent source are checked afresh.
 */
export async function prepareReplacementPurchase(tx: FollowupTx, actor: Actor, planId: number, input: {
  ticketId?: number | null; ticketItemId?: number | null; items: ReplacementItem[]; context: Context;
}) {
  if (!await trialEnabled(tx)) throw new ReturnFollowupError("FORBIDDEN", "متابعة مرتجع المورد غير مفعّلة لهذه القاعدة");
  const [user] = await readRows(tx, sql`SELECT id,role,isActive FROM users WHERE id=${actor.id} FOR UPDATE`);
  if (!user || user.role !== actor.role || Number(user.isActive) !== 1) throw new ReturnFollowupError("FORBIDDEN", "الحساب غير متاح");
  const [plan] = await readRows(tx, sql`SELECT p.*,c.handoverStatus,c.resolution,c.creatorDecision,c.creatorId,c.purchaseOrderId AS originalOrderId,
      c.purchaseOrderItemId AS originalItemId,c.returnedQuantity,c.originalPurchaseValue,c.currency,c.valuationBasis,
      original.requestedById,original.ticketId AS originalTicketId,original.ticketItemId AS originalTicketItemId,
      original.siteId AS originalSiteId,original.sectionId AS originalSectionId,
      original.categoryId AS originalCategoryId,original.assetId AS originalAssetId,
      sourceItem.siteId AS originalItemSiteId,sourceItem.sectionId AS originalItemSectionId,
      sourceItem.categoryId AS originalItemCategoryId,sourceItem.assetId AS originalItemAssetId
    FROM supplier_return_replacement_plans p
    INNER JOIN supplier_return_cases c ON c.id=p.caseId
    INNER JOIN purchase_orders original ON original.id=c.purchaseOrderId
    INNER JOIN purchase_order_items sourceItem ON sourceItem.id=c.purchaseOrderItemId AND sourceItem.purchaseOrderId=original.id
    WHERE p.id=${planId} FOR UPDATE`);
  if (!plan) conflict("خطة البديل أو طلب الشراء الأصلي غير متاح");
  if (Number(plan.creatorId) !== Number(plan.requestedById) || Number(plan.originalQuantityCovered) !== Number(plan.returnedQuantity)) conflict("مصدر خطة البديل لا يطابق الطلب أو الكمية المرتجعة");
  if (Number(plan.creatorId) !== actor.id && !["admin", "owner"].includes(actor.role)) throw new ReturnFollowupError("FORBIDDEN", "طلب التعويض لمنشئ الطلب الأصلي");
  if (plan.handoverStatus !== "accepted" || plan.status !== "pending_review" || plan.purchaseOrderId != null || plan.purchaseOrderItemId != null) conflict("خطة البديل تغيرت أو ارتبطت بطلب شراء سابق");
  if (plan.resolution !== "same_item" && !(["change_item", "refund"].includes(plan.resolution) && plan.creatorDecision === "replace")) conflict("لم يُعتمد اختيار الصنف البديل");
  if (plan.originalPurchaseValue == null || plan.currency !== "SAR" || plan.valuationBasis !== "tax_inclusive") conflict("مرجع قيمة الفاتورة غير مكتمل أو أساسه المالي مختلف");
  if (input.items.length !== 1) conflict("طلب التعويض يحمل صنف البديل وحده");
  const [item] = input.items;
  if ((plan.catalogItemId ?? null) !== (item.catalogItemId ?? null) || item.itemName.trim() !== String(plan.itemName).trim()
    || Number(item.quantity) !== Number(plan.replacementQuantity) || (item.unit ?? "").trim() !== String(plan.replacementUnit).trim()) conflict("صنف الطلب أو كميته لا يطابقان خطة البديل");
  if (!same(input.ticketId, plan.originalTicketId) || !same(input.ticketItemId, plan.originalTicketItemId)
    || !matchesRecorded(input.context.siteId, plan.originalSiteId) || !matchesRecorded(input.context.sectionId, plan.originalSectionId)
    || !matchesRecorded(input.context.categoryId, plan.originalCategoryId) || !matchesRecorded(input.context.assetId, plan.originalAssetId)) conflict("سياق طلب التعويض لا يطابق الطلب الأصلي");
  if (!matchesRecorded(item.siteId ?? input.context.siteId, plan.originalItemSiteId ?? plan.originalSiteId)
    || !matchesRecorded(item.sectionId ?? input.context.sectionId, plan.originalItemSectionId ?? plan.originalSectionId)
    || !matchesRecorded(item.categoryId ?? input.context.categoryId, plan.originalItemCategoryId ?? plan.originalCategoryId)
    || !matchesRecorded(item.assetId ?? input.context.assetId, plan.originalItemAssetId ?? plan.originalAssetId)) conflict("موقع أو قسم أو تصنيف صنف البديل لا يطابق بند الشراء الأصلي");
  const [credit] = await readRows(tx, sql`SELECT id,amount,currency,valuationBasis FROM supplier_return_settlements
    WHERE caseId=${Number(plan.caseId)} AND operationKey=${`handover-credit:${Number(plan.caseId)}`}
      AND type='supplier_credit' AND status='completed' FOR UPDATE`);
  if (!credit || credit.currency !== "SAR" || credit.valuationBasis !== "tax_inclusive" || decimal4(String(credit.amount)) !== decimal4(String(plan.originalPurchaseValue))) conflict("رصيد المرتجع المؤكد غير متاح");
  return { planId: Number(plan.id), caseId: Number(plan.caseId), creditId: Number(credit.id), originalOrderId: Number(plan.originalOrderId) };
}

export async function linkReplacementPurchase(tx: FollowupTx, prepared: Awaited<ReturnType<typeof prepareReplacementPurchase>>, purchaseOrderId: number, purchaseOrderItemId: number) {
  const [written] = await tx.execute(sql`UPDATE supplier_return_replacement_plans SET purchaseOrderId=${purchaseOrderId},purchaseOrderItemId=${purchaseOrderItemId},supplierCreditId=${prepared.creditId},revision=revision+1
    WHERE id=${prepared.planId} AND caseId=${prepared.caseId} AND status='pending_review' AND purchaseOrderId IS NULL AND purchaseOrderItemId IS NULL`);
  if (Number(written?.affectedRows) !== 1) conflict("تغيرت خطة التعويض أثناء إنشاء الطلب");
}
