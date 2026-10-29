import { sql } from "drizzle-orm";
import { compensationAmounts, decimal4, format4, availableCredit } from "./amounts";
import { ReturnFollowupError } from "./policy";
import { readRows, trialEnabled } from "./runtime";
import type { FollowupTx } from "./commands";

const conflict = (message: string): never => { throw new ReturnFollowupError("CONFLICT", message); };

/** Reserve supplier credit in the SAME transaction that sends the existing
 * pricing bundle. The quoted item total is VAT inclusive, like the invoice.
 */
export async function reserveReplacementPricing(tx: FollowupTx, actorId: number, purchaseOrderId: number, items: Array<{ id: number; estimatedTotalCost: string | null }>) {
  if (!await trialEnabled(tx)) return null;
  const [plan] = await readRows(tx, sql`SELECT p.*,c.delegateId,c.handoverStatus,c.resolution,c.originalPurchaseValue,c.returnedQuantity,c.currency AS caseCurrency,c.valuationBasis AS caseBasis,
      original.poNumber AS originalPoNumber,r.returnNumber,originalBundle.bundleNumber AS originalBundleNumber
    FROM supplier_return_replacement_plans p INNER JOIN supplier_return_cases c ON c.id=p.caseId
    INNER JOIN purchase_orders original ON original.id=c.purchaseOrderId
    INNER JOIN purchase_order_items originalItem ON originalItem.id=c.purchaseOrderItemId AND originalItem.purchaseOrderId=original.id
    INNER JOIN warehouse_returns r ON r.id=c.returnId
    LEFT JOIN delegate_pricing_bundle_batches originalBatch ON originalBatch.pricingBatchId=originalItem.batchId AND originalBatch.purchaseOrderId=original.id
    LEFT JOIN delegate_pricing_bundles originalBundle ON originalBundle.id=originalBatch.bundleId
    WHERE p.purchaseOrderId=${purchaseOrderId} FOR UPDATE`);
  if (!plan) return null;
  if (Number(plan.delegateId) !== actorId || plan.handoverStatus !== "accepted" || plan.status !== "pending_review"
    || items.length !== 1 || Number(plan.purchaseOrderItemId) !== Number(items[0].id)) conflict("خطة التعويض أو المندوب أو أصناف الحزمة تغيرت");
  if (plan.caseCurrency !== "SAR" || plan.caseBasis !== "tax_inclusive") conflict("أساس سعر التعويض يجب أن يكون شامل الضريبة وبالريال");
  const sourceType = plan.resolution === "refund" ? "cash_refund" : "supplier_credit";
  const [credit] = await readRows(tx, sql`SELECT id,amount,currency,valuationBasis,status FROM supplier_return_settlements
    WHERE id=${plan.supplierCreditId} AND caseId=${plan.caseId} AND type=${sourceType} FOR UPDATE`);
  if (!credit || credit.status !== "completed" || credit.currency !== "SAR" || credit.valuationBasis !== "tax_inclusive"
    || decimal4(String(credit.amount)) !== decimal4(String(plan.originalPurchaseValue))) conflict("رصيد المرتجع المؤكد غير متاح");
  const reservations = await readRows(tx, sql`SELECT type AS kind,amount,status FROM supplier_return_settlements
    WHERE caseId=${plan.caseId} AND sourceCreditId=${credit.id} AND type IN ('credit_allocation','cash_refund') FOR UPDATE`);
  const available = availableCredit(String(credit.amount), reservations);
  const total = format4(decimal4(String(items[0].estimatedTotalCost ?? "")));
  if (decimal4(total) <= BigInt(0)) conflict("سعر البديل يجب أن يكون أكبر من صفر");
  const amounts = compensationAmounts(total, available);
  const [allocation] = await tx.execute(sql`INSERT INTO supplier_return_settlements
    (caseId,operationKey,type,status,amount,currency,valuationBasis,sourceCreditId,purchaseOrderId,purchaseOrderItemId,notes,createdById)
    VALUES (${plan.caseId},${`replacement-plan:${plan.id}:credit:${plan.revision}`},'credit_allocation','pending',${amounts.creditAllocated},'SAR','tax_inclusive',${credit.id},${purchaseOrderId},${items[0].id},'حجز رصيد المرتجع لتعويض الصنف',${actorId})`);
  if (!Number.isSafeInteger(Number(allocation?.insertId)) || Number(allocation.insertId) <= 0) conflict("تعذر حجز رصيد المرتجع");
  const [write] = await tx.execute(sql`UPDATE supplier_return_replacement_plans
    SET status='pending_accounting',quotedById=${actorId},quotedAt=CURRENT_TIMESTAMP,quotedTotal=${total},currency='SAR',valuationBasis='tax_inclusive',
      creditAllocationSettlementId=${Number(allocation.insertId)},creditAllocated=${amounts.creditAllocated},additionalFunding=${amounts.additionalFunding},revision=revision+1
    WHERE id=${plan.id} AND status='pending_review' AND purchaseOrderId=${purchaseOrderId} AND purchaseOrderItemId=${items[0].id}`);
  if (Number(write?.affectedRows) !== 1) conflict("تغيرت خطة التعويض أثناء إرسال التسعير");
  return { planId: Number(plan.id), caseId: Number(plan.caseId), purchaseOrderItemId: Number(plan.purchaseOrderItemId),
    originalPoNumber: String(plan.originalPoNumber), originalBundleNumber: plan.originalBundleNumber ? String(plan.originalBundleNumber) : null,
    returnNumber: String(plan.returnNumber), returnedQuantity: String(plan.returnedQuantity), replacementQuantity: String(plan.replacementQuantity),
    originalPurchaseValue: String(plan.originalPurchaseValue), total, ...amounts };
}

/** Read-only approval check. A separate atomic approval writer must still
 * recheck this value at its write boundary before funds are approved.
 */
export async function replacementFundingForBatch(tx: FollowupTx, batchId: number) {
  if (!await trialEnabled(tx)) return null;
  const [plan] = await readRows(tx, sql`SELECT p.id,p.caseId,p.status,p.quotedTotal,p.creditAllocated,p.additionalFunding,p.purchaseOrderId,p.purchaseOrderItemId,
      b.status AS batchStatus,b.purchaseOrderId AS batchOrderId,i.batchId AS itemBatchId
    FROM supplier_return_replacement_plans p
    INNER JOIN po_pricing_batches b ON b.purchaseOrderId=p.purchaseOrderId
    INNER JOIN purchase_order_items i ON i.id=p.purchaseOrderItemId AND i.purchaseOrderId=p.purchaseOrderId
    WHERE b.id=${batchId}`);
  if (!plan) return null;
  if (plan.status !== "pending_accounting" || plan.batchStatus !== "pending_accounting" || Number(plan.itemBatchId) !== batchId
    || Number(plan.batchOrderId) !== Number(plan.purchaseOrderId)
    || decimal4(String(plan.quotedTotal)) !== decimal4(String(plan.creditAllocated)) + decimal4(String(plan.additionalFunding))) conflict("بيانات اعتماد تعويض المرتجع غير متطابقة");
  return { planId: Number(plan.id), caseId: Number(plan.caseId), additionalFunding: String(plan.additionalFunding) };
}

/** Scoped accounting writer. Batch approval, the credit reservation and the
 * extra funding record advance together. Other purchase batches use their
 * unchanged writer.
 */
export async function approveReplacementAccounting(tx: FollowupTx, actorId: number, batchId: number, custodyAmount: string | undefined, notes: string | undefined, signature: string | null) {
  if (!await trialEnabled(tx)) return false;
  const [plan] = await readRows(tx, sql`SELECT p.*,c.delegateId,c.handoverStatus,b.status AS batchStatus,b.purchaseOrderId AS batchOrderId,
      b.submittedById,b.purchasePackageSubmissionId,i.batchId AS itemBatchId,i.status AS itemStatus,i.estimatedTotalCost
    FROM supplier_return_replacement_plans p
    INNER JOIN supplier_return_cases c ON c.id=p.caseId
    INNER JOIN po_pricing_batches b ON b.purchaseOrderId=p.purchaseOrderId
    INNER JOIN purchase_order_items i ON i.id=p.purchaseOrderItemId AND i.purchaseOrderId=p.purchaseOrderId
    WHERE b.id=${batchId} FOR UPDATE`);
  if (!plan) return false;
  if (plan.status !== "pending_accounting" || plan.batchStatus !== "pending_accounting" || plan.handoverStatus !== "accepted"
    || plan.purchasePackageSubmissionId != null || Number(plan.itemBatchId) !== batchId || plan.itemStatus !== "estimated"
    || Number(plan.submittedById) !== Number(plan.delegateId)
    || decimal4(String(plan.quotedTotal)) !== decimal4(String(plan.estimatedTotalCost))
    || decimal4(String(plan.quotedTotal)) !== decimal4(String(plan.creditAllocated)) + decimal4(String(plan.additionalFunding))) conflict("تغيرت بيانات تسعير البديل؛ حدّث الصفحة");
  let requested: bigint;
  try { requested = decimal4((custodyAmount || "0").trim()); }
  catch { conflict("مبلغ عهدة التعويض غير صحيح"); }
  if (requested! !== decimal4(String(plan.additionalFunding))) conflict("مبلغ العهدة يجب أن يساوي فرق سعر البديل عن رصيد المرتجع فقط");
  const [allocation] = await readRows(tx, sql`SELECT id,status,amount,sourceCreditId FROM supplier_return_settlements
    WHERE id=${plan.creditAllocationSettlementId} AND caseId=${plan.caseId} AND type='credit_allocation' FOR UPDATE`);
  if (!allocation || allocation.status !== "pending" || Number(allocation.sourceCreditId) !== Number(plan.supplierCreditId)
    || decimal4(String(allocation.amount)) !== decimal4(String(plan.creditAllocated))) conflict("حجز رصيد المرتجع تغير قبل اعتماد الحسابات");
  const [batchWrite] = await tx.execute(sql`UPDATE po_pricing_batches SET status='pending_management',accountingApprovedById=${actorId},
      accountingApprovedAt=CURRENT_TIMESTAMP,accountingSignatureSnapshot=${signature},accountingNotes=${notes ?? null},custodyAmount=${format4(requested!)}
      WHERE id=${batchId} AND status='pending_accounting' AND purchaseOrderId=${plan.purchaseOrderId}`);
  if (Number(batchWrite?.affectedRows) !== 1) conflict("تغيرت دفعة التسعير أثناء الاعتماد");
  const [allocationWrite] = await tx.execute(sql`UPDATE supplier_return_settlements SET status='accounting_approved',accountingApprovedById=${actorId},accountingApprovedAt=CURRENT_TIMESTAMP,
      revision=revision+1 WHERE id=${allocation.id} AND status='pending'`);
  if (Number(allocationWrite?.affectedRows) !== 1) conflict("تغير حجز الرصيد أثناء الاعتماد");
  let fundingId: number | null = null;
  if (requested! > BigInt(0)) {
    const [funding] = await tx.execute(sql`INSERT INTO supplier_return_settlements
      (caseId,operationKey,type,status,amount,currency,valuationBasis,sourceCreditId,purchaseOrderId,purchaseOrderItemId,notes,createdById,accountingApprovedById,accountingApprovedAt)
      VALUES (${plan.caseId},${`replacement-plan:${plan.id}:funding:${plan.revision}`},'additional_funding','accounting_approved',${format4(requested!)},'SAR','tax_inclusive',${plan.supplierCreditId},${plan.purchaseOrderId},${plan.purchaseOrderItemId},'فرق عهدة البديل فقط',${actorId},${actorId},CURRENT_TIMESTAMP)`);
    fundingId = Number(funding?.insertId);
    if (!Number.isSafeInteger(fundingId) || fundingId <= 0) conflict("تعذر تثبيت فرق العهدة");
  }
  const [planWrite] = await tx.execute(sql`UPDATE supplier_return_replacement_plans SET status='pending_management',fundingSettlementId=${fundingId},revision=revision+1
    WHERE id=${plan.id} AND status='pending_accounting' AND creditAllocationSettlementId=${allocation.id}`);
  if (Number(planWrite?.affectedRows) !== 1) conflict("تغيرت خطة البديل أثناء الاعتماد");
  return true;
}

export async function approveReplacementManagement(tx: FollowupTx, actorId: number, batchId: number, notes: string | undefined) {
  if (!await trialEnabled(tx)) return false;
  const [plan] = await readRows(tx, sql`SELECT p.*,b.status AS batchStatus,b.purchasePackageSubmissionId,b.accountingApprovedById,
      i.batchId AS itemBatchId,i.status AS itemStatus
    FROM supplier_return_replacement_plans p
    INNER JOIN po_pricing_batches b ON b.purchaseOrderId=p.purchaseOrderId
    INNER JOIN purchase_order_items i ON i.id=p.purchaseOrderItemId AND i.purchaseOrderId=p.purchaseOrderId
    WHERE b.id=${batchId} FOR UPDATE`);
  if (!plan) return false;
  if (plan.status !== "pending_management" || plan.batchStatus !== "pending_management" || plan.purchasePackageSubmissionId != null
    || !plan.accountingApprovedById || Number(plan.itemBatchId) !== batchId || plan.itemStatus !== "estimated") conflict("خطة التعويض لم تكمل اعتماد الحسابات أو تغير صنفها");
  const [allocation] = await readRows(tx, sql`SELECT id,status,amount FROM supplier_return_settlements
    WHERE id=${plan.creditAllocationSettlementId} AND caseId=${plan.caseId} AND type='credit_allocation' FOR UPDATE`);
  if (!allocation || allocation.status !== "accounting_approved" || decimal4(String(allocation.amount)) !== decimal4(String(plan.creditAllocated))) conflict("اعتماد رصيد المرتجع من الحسابات مفقود");
  if (decimal4(String(plan.additionalFunding)) > BigInt(0)) {
    const [funding] = await readRows(tx, sql`SELECT id,status,amount FROM supplier_return_settlements
      WHERE id=${plan.fundingSettlementId} AND caseId=${plan.caseId} AND type='additional_funding' FOR UPDATE`);
    if (!funding || funding.status !== "accounting_approved" || decimal4(String(funding.amount)) !== decimal4(String(plan.additionalFunding))) conflict("اعتماد فرق العهدة من الحسابات مفقود");
    const [fundingWrite] = await tx.execute(sql`UPDATE supplier_return_settlements SET status='management_approved',managementApprovedById=${actorId},managementApprovedAt=CURRENT_TIMESTAMP,revision=revision+1
      WHERE id=${funding.id} AND status='accounting_approved'`);
    if (Number(fundingWrite?.affectedRows) !== 1) conflict("تغير اعتماد فرق العهدة");
  }
  const [allocationWrite] = await tx.execute(sql`UPDATE supplier_return_settlements SET status='management_approved',managementApprovedById=${actorId},managementApprovedAt=CURRENT_TIMESTAMP,revision=revision+1
    WHERE id=${allocation.id} AND status='accounting_approved'`);
  if (Number(allocationWrite?.affectedRows) !== 1) conflict("تغير اعتماد رصيد المرتجع");
  const [batchWrite] = await tx.execute(sql`UPDATE po_pricing_batches SET status='approved',managementApprovedById=${actorId},managementApprovedAt=CURRENT_TIMESTAMP,managementNotes=${notes ?? null}
    WHERE id=${batchId} AND status='pending_management' AND purchaseOrderId=${plan.purchaseOrderId}`);
  if (Number(batchWrite?.affectedRows) !== 1) conflict("تغيرت دفعة التسعير");
  const [itemWrite] = await tx.execute(sql`UPDATE purchase_order_items SET status='approved' WHERE id=${plan.purchaseOrderItemId} AND purchaseOrderId=${plan.purchaseOrderId} AND batchId=${batchId} AND status='estimated'`);
  if (Number(itemWrite?.affectedRows) !== 1) conflict("تغير صنف البديل قبل الاعتماد");
  const [planWrite] = await tx.execute(sql`UPDATE supplier_return_replacement_plans SET status='ready_to_purchase',revision=revision+1
    WHERE id=${plan.id} AND status='pending_management'`);
  if (Number(planWrite?.affectedRows) !== 1) conflict("تغيرت خطة التعويض");
  return true;
}

/** The existing delegate purchase action calls this under the same lock as
 * its ordinary item update. It never purchases or changes stock itself. */
export async function markReplacementPurchased(tx: FollowupTx, actorId: number, purchaseOrderItemId: number) {
  if (!await trialEnabled(tx)) return false;
  const [plan] = await readRows(tx, sql`SELECT p.id,p.status,p.purchaseOrderId,p.purchaseOrderItemId,p.additionalFunding,
      p.creditAllocationSettlementId,p.fundingSettlementId,c.delegateId,c.handoverStatus,
      i.status AS itemStatus,i.delegateId AS itemDelegateId,b.status AS batchStatus
    FROM supplier_return_replacement_plans p INNER JOIN supplier_return_cases c ON c.id=p.caseId
    INNER JOIN purchase_order_items i ON i.id=p.purchaseOrderItemId AND i.purchaseOrderId=p.purchaseOrderId
    INNER JOIN po_pricing_batches b ON b.id=i.batchId AND b.purchaseOrderId=p.purchaseOrderId
    WHERE p.purchaseOrderItemId=${purchaseOrderItemId} FOR UPDATE`);
  if (!plan) return false;
  if (plan.status !== "ready_to_purchase" || plan.handoverStatus !== "accepted" || plan.itemStatus !== "approved"
    || plan.batchStatus !== "approved" || Number(plan.delegateId) !== actorId || Number(plan.itemDelegateId) !== actorId) conflict("البديل لم يكتمل اعتماده أو لم يعد مسندًا إلى هذا المندوب");
  const [allocation] = await readRows(tx, sql`SELECT id,status FROM supplier_return_settlements
    WHERE id=${plan.creditAllocationSettlementId} AND type='credit_allocation' FOR UPDATE`);
  if (!allocation || allocation.status !== "management_approved") conflict("اعتماد رصيد المرتجع غير مكتمل");
  if (decimal4(String(plan.additionalFunding)) > BigInt(0)) {
    const [funding] = await readRows(tx, sql`SELECT id,status FROM supplier_return_settlements
      WHERE id=${plan.fundingSettlementId} AND type='additional_funding' FOR UPDATE`);
    if (!funding || funding.status !== "management_approved") conflict("اعتماد فرق العهدة غير مكتمل");
  }
  const [write] = await tx.execute(sql`UPDATE supplier_return_replacement_plans SET status='purchased',revision=revision+1
    WHERE id=${plan.id} AND status='ready_to_purchase' AND purchaseOrderItemId=${purchaseOrderItemId}`);
  if (Number(write?.affectedRows) !== 1) conflict("تغيرت خطة البديل أثناء تأكيد الشراء");
  return true;
}

/** Existing per-batch PDFs read the same frozen compensation values that the
 * pricing submission approved. The bundle PDF uses its own immutable snapshot.
 */
export async function replacementDocumentForBatch(tx: FollowupTx, batchId: number, purchaseOrderId: number) {
  if (!await trialEnabled(tx)) return [];
  const rows = await readRows(tx, sql`SELECT p.id AS planId,p.caseId,p.purchaseOrderItemId,p.replacementQuantity,p.quotedTotal AS total,
      p.creditAllocated,p.additionalFunding,c.originalPurchaseValue,c.returnedQuantity,
      original.poNumber AS originalPoNumber,r.returnNumber,originalBundle.bundleNumber AS originalBundleNumber
    FROM supplier_return_replacement_plans p INNER JOIN supplier_return_cases c ON c.id=p.caseId
    INNER JOIN purchase_order_items item ON item.id=p.purchaseOrderItemId AND item.purchaseOrderId=p.purchaseOrderId AND item.batchId=${batchId}
    INNER JOIN purchase_orders original ON original.id=c.purchaseOrderId
    INNER JOIN purchase_order_items sourceItem ON sourceItem.id=c.purchaseOrderItemId AND sourceItem.purchaseOrderId=original.id
    INNER JOIN warehouse_returns r ON r.id=c.returnId
    LEFT JOIN delegate_pricing_bundle_batches originalBatch ON originalBatch.pricingBatchId=sourceItem.batchId AND originalBatch.purchaseOrderId=original.id
    LEFT JOIN delegate_pricing_bundles originalBundle ON originalBundle.id=originalBatch.bundleId
    WHERE p.purchaseOrderId=${purchaseOrderId} AND p.quotedTotal IS NOT NULL`);
  return rows.map(row => ({ planId: Number(row.planId), caseId: Number(row.caseId), purchaseOrderItemId: Number(row.purchaseOrderItemId),
    originalPoNumber: String(row.originalPoNumber), originalBundleNumber: row.originalBundleNumber ? String(row.originalBundleNumber) : null,
    returnNumber: String(row.returnNumber), returnedQuantity: String(row.returnedQuantity), replacementQuantity: String(row.replacementQuantity),
    originalPurchaseValue: String(row.originalPurchaseValue), total: String(row.total), creditAllocated: String(row.creditAllocated),
    additionalFunding: String(row.additionalFunding) }));
}
