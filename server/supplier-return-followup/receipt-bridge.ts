import { sql } from "drizzle-orm";
import { ReturnFollowupError } from "./policy";
import { readRows, trialEnabled } from "./runtime";
import { replacementReceiptAllocation } from "./receipt-allocation";
import { decimal4 } from "./amounts";
import type { FollowupTx } from "./commands";

const conflict = (message: string): never => { throw new ReturnFollowupError("CONFLICT", message); };

/** Called only after the ordinary receipt line/lot has been created, inside
 * that same receipt transaction. It records provenance without writing stock.
 */
export async function linkReplacementReceipt(tx: FollowupTx, actorId: number, input: {
  purchaseOrderId: number; purchaseOrderItemId: number; receiptId: number; receiptItemId: number;
  lotId: number | null; quantityInOrderUnits: string; orderUnit: string;
}) {
  if (!await trialEnabled(tx)) return false;
  const [plan] = await readRows(tx, sql`SELECT p.id,p.caseId,p.status,p.purchaseOrderId,p.purchaseOrderItemId,p.replacementQuantity,p.replacementUnit,
      p.originalQuantityCovered,p.creditAllocationSettlementId,p.fundingSettlementId,p.additionalFunding,
      c.returnedUnit,c.handoverStatus
    FROM supplier_return_replacement_plans p INNER JOIN supplier_return_cases c ON c.id=p.caseId
    WHERE p.purchaseOrderItemId=${input.purchaseOrderItemId} FOR UPDATE`);
  if (!plan) return false;
  if (Number(plan.purchaseOrderId) !== input.purchaseOrderId || plan.status !== "purchased" || plan.handoverStatus !== "accepted"
    || String(plan.replacementUnit).trim() !== input.orderUnit.trim()) conflict("استلام البديل لا يطابق طلب التعويض المعتمد");
  // The current PO receipt workflow confirms each order item once. A smaller
  // receipt would make its remaining quantity unreachable through that flow.
  if (decimal4(input.quantityInOrderUnits) !== decimal4(String(plan.replacementQuantity))) conflict("يجب استلام كمية البديل كاملة؛ لا تدعم دورة الاستلام الحالية تجزئة بند التعويض");
  const [previous] = await readRows(tx, sql`SELECT COALESCE(SUM(receivedQuantity),0) AS received,COALESCE(SUM(compensatedOriginalQuantity),0) AS compensated
    FROM supplier_return_replacement_links WHERE caseId=${plan.caseId} AND purchaseOrderItemId=${input.purchaseOrderItemId}`);
  let allocation;
  try { allocation = replacementReceiptAllocation({ replacementQuantity: String(plan.replacementQuantity),
    originalQuantityCovered: String(plan.originalQuantityCovered), alreadyReceived: String(previous?.received ?? "0"),
    alreadyCompensated: String(previous?.compensated ?? "0"), receiving: input.quantityInOrderUnits }); }
  catch { conflict("كمية البديل تتجاوز نطاق التعويض أو سبق استلامها"); }
  if (!allocation!.completed) conflict("استلام البديل غير مكتمل");
  const [link] = await tx.execute(sql`INSERT INTO supplier_return_replacement_links
    (caseId,purchaseOrderId,purchaseOrderItemId,receiptId,receiptItemId,lotId,receivedQuantity,receivedUnit,compensatedOriginalQuantity,originalUnit,createdById)
    VALUES (${plan.caseId},${input.purchaseOrderId},${input.purchaseOrderItemId},${input.receiptId},${input.receiptItemId},${input.lotId},
      ${input.quantityInOrderUnits},${input.orderUnit},${allocation!.compensatedOriginalQuantity},${plan.returnedUnit},${actorId})`);
  if (!Number.isSafeInteger(Number(link?.insertId)) || Number(link.insertId) <= 0) conflict("تعذر حفظ رابط استلام البديل");
  const [credit] = await tx.execute(sql`UPDATE supplier_return_settlements SET status='completed',completedById=${actorId},completedAt=CURRENT_TIMESTAMP,revision=revision+1
    WHERE id=${plan.creditAllocationSettlementId} AND caseId=${plan.caseId} AND type='credit_allocation' AND status='management_approved'`);
  if (Number(credit?.affectedRows) !== 1) conflict("رصيد المرتجع لم يكمل اعتماده");
  if (decimal4(String(plan.additionalFunding)) > BigInt(0)) {
    const [funding] = await tx.execute(sql`UPDATE supplier_return_settlements SET status='completed',completedById=${actorId},completedAt=CURRENT_TIMESTAMP,revision=revision+1
      WHERE id=${plan.fundingSettlementId} AND caseId=${plan.caseId} AND type='additional_funding' AND status='management_approved'`);
    if (Number(funding?.affectedRows) !== 1) conflict("فرق العهدة لم يكمل اعتماده");
  }
  const [written] = await tx.execute(sql`UPDATE supplier_return_replacement_plans SET status='received',revision=revision+1
    WHERE id=${plan.id} AND status='purchased' AND purchaseOrderItemId=${input.purchaseOrderItemId}`);
  if (Number(written?.affectedRows) !== 1) conflict("تغيرت خطة التعويض أثناء الاستلام");
  return true;
}
