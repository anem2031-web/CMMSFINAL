import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { decideCreator, ReturnFollowupError, type Followup } from "./policy";
import { readRows, trialEnabled } from "./runtime";
import type { FollowupPort } from "./commands";

export const creatorReplacementChoice = z.object({
  caseId: z.number().int().positive(), expectedRevision: z.number().int().nonnegative(),
  catalogItemId: z.number().int().positive(), quantity: z.number().int().positive().max(1000000),
  operationKey: z.string().min(16).max(100),
}).strict();
export const creatorCancellation = z.object({
  caseId: z.number().int().positive(), expectedRevision: z.number().int().nonnegative(),
  operationKey: z.string().min(16).max(100),
}).strict();

const conflict = (message: string): never => { throw new ReturnFollowupError("CONFLICT", message); };
const deny = (message: string): never => { throw new ReturnFollowupError("FORBIDDEN", message); };

/** The original requester chooses a different catalog item after the delegate
 * has accepted the return. This only creates a plan; purchase, pricing and
 * stock still use their existing guarded writers. */
export async function runTrialCreatorReplacement(actor: {id:number;role:string}, raw: z.input<typeof creatorReplacementChoice>, port: FollowupPort) {
  const input = creatorReplacementChoice.parse(raw);
  return port.transaction(async tx => {
    if (!await trialEnabled(tx)) deny("متابعة مرتجع المورد غير مفعّلة لهذه القاعدة");
    const [user] = await readRows(tx, sql`SELECT id,role,isActive FROM users WHERE id=${actor.id} FOR UPDATE`);
    if (!user || user.role !== actor.role || Number(user.isActive) !== 1) deny("الحساب غير متاح");
    const [record] = await readRows(tx, sql`SELECT * FROM supplier_return_cases WHERE id=${input.caseId} FOR UPDATE`);
    if (!record || Number(record.creatorId) !== actor.id) deny("قرار البديل لمنشئ الطلب الأصلي فقط");
    const [source] = await readRows(tx, sql`SELECT r.id,r.inventoryId,r.purchaseOrderId,r.purchaseOrderItemId,r.sourceDeliveryDocumentId,
        p.requestedById,i.id AS itemId,i.catalogItemId AS originalCatalogItemId
      FROM warehouse_returns r INNER JOIN purchase_orders p ON p.id=r.purchaseOrderId
      INNER JOIN purchase_order_items i ON i.id=r.purchaseOrderItemId AND i.purchaseOrderId=p.id
      WHERE r.id=${Number(record.returnId)} FOR UPDATE`);
    if (!source || Number(source.inventoryId) !== Number(record.inventoryId)
      || Number(source.purchaseOrderId) !== Number(record.purchaseOrderId)
      || Number(source.purchaseOrderItemId) !== Number(record.purchaseOrderItemId)
      || Number(source.requestedById) !== actor.id || source.sourceDeliveryDocumentId != null) conflict("مصدر المرتجع أو منشئ الطلب تغير");
    const hash = createHash("sha256").update(JSON.stringify({actorId:actor.id,...input})).digest("hex");
    const [previous] = await readRows(tx, sql`SELECT actorId,requestHash,result FROM supplier_return_events WHERE caseId=${input.caseId} AND operationKey=${input.operationKey}`);
    if (previous) {
      if (Number(previous.actorId) !== actor.id || previous.requestHash !== hash) conflict("مفتاح العملية مستخدم لقرار مختلف");
      return typeof previous.result === "string" ? JSON.parse(previous.result) : previous.result;
    }
    if (record.closedAt || record.handoverStatus !== "accepted" || !["change_item", "refund"].includes(record.resolution)
      || record.creatorDecision !== "pending" || Number(record.revision) !== input.expectedRevision) conflict("لم يعد المرتجع بانتظار اختيار البديل");
    if (record.resolution === "refund") {
      const [refund] = await readRows(tx, sql`SELECT id FROM supplier_return_settlements WHERE caseId=${input.caseId}
        AND type='cash_refund' AND status='completed' AND operationKey=${`cash-refund:${input.caseId}`} FOR UPDATE`);
      if (!refund) conflict("لم يؤكد المندوب استلام مبلغ الاسترداد بعد");
    }
    if (record.originalPurchaseValue == null || record.currency !== "SAR" || record.valuationBasis !== "tax_inclusive") conflict("مرجع قيمة الفاتورة غير صالح للتعويض");
    const [catalog] = await readRows(tx, sql`SELECT id,nameAr,unit,isActive FROM catalog_items WHERE id=${input.catalogItemId} FOR UPDATE`);
    if (!catalog || Number(catalog.isActive) !== 1 || !String(catalog.nameAr || "").trim() || !String(catalog.unit || "").trim()) conflict("الصنف البديل غير نشط أو بيانات وحدته ناقصة");
    if (source.originalCatalogItemId != null && Number(source.originalCatalogItemId) === input.catalogItemId) conflict("اختر صنفًا مختلفًا عن الصنف الأصلي");
    const [existingPlan] = await readRows(tx, sql`SELECT id FROM supplier_return_replacement_plans WHERE caseId=${input.caseId} LIMIT 1`);
    if (existingPlan) conflict("يوجد طلب بديل سابق لهذا المرتجع");
    const before: Followup = { delegateId:Number(record.delegateId),creatorId:Number(record.creatorId),returnedQuantity:Number(record.returnedQuantity),
      revision:Number(record.revision),handover:record.handoverStatus,resolution:record.resolution,rejectionReason:record.rejectionReason,creatorDecision:record.creatorDecision };
    const after = decideCreator({id:actor.id,role:actor.role,active:true},before,input.expectedRevision,"replace",
      {verified:true,hasMaintenance:false,hasTask:false,hasMaterialNeed:false});
    const [plan] = await tx.execute(sql`INSERT INTO supplier_return_replacement_plans
      (caseId,planNumber,status,catalogItemId,itemName,replacementQuantity,replacementUnit,originalQuantityCovered,selectedById,createdById)
      VALUES (${input.caseId},1,'pending_review',${input.catalogItemId},${String(catalog.nameAr).trim()},${input.quantity},${String(catalog.unit).trim()},${record.returnedQuantity},${actor.id},${actor.id})`);
    if (!Number.isSafeInteger(Number(plan?.insertId)) || Number(plan.insertId) <= 0) conflict("تعذر حفظ خطة البديل");
    const [written] = await tx.execute(sql`UPDATE supplier_return_cases SET creatorDecision='replace',revision=${after.revision}
      WHERE id=${input.caseId} AND revision=${before.revision} AND creatorDecision='pending'`);
    if (Number(written?.affectedRows) !== 1) conflict("تغير المرتجع أثناء اختيار البديل");
    const result = {caseId:input.caseId,planId:Number(plan.insertId),revision:after.revision};
    await tx.execute(sql`INSERT INTO supplier_return_events
      (caseId,actorId,action,operationKey,requestHash,fromRevision,toRevision,beforeState,afterState,reason,result)
      VALUES (${input.caseId},${actor.id},'creator_replace',${input.operationKey},${hash},${before.revision},${after.revision},${JSON.stringify(before)},${JSON.stringify(after)},NULL,${JSON.stringify(result)})`);
    return result;
  });
}

/** Cancellation closes only the return follow-up. The historical invoice,
 * purchased item and inventory movements remain intact. */
export async function runTrialCreatorCancellation(actor: {id:number;role:string}, raw: z.input<typeof creatorCancellation>, port: FollowupPort) {
  const input = creatorCancellation.parse(raw);
  return port.transaction(async tx => {
    if (!await trialEnabled(tx)) deny("متابعة مرتجع المورد غير مفعّلة لهذه القاعدة");
    const [user] = await readRows(tx, sql`SELECT id,role,isActive FROM users WHERE id=${actor.id} FOR UPDATE`);
    if (!user || user.role !== actor.role || Number(user.isActive) !== 1) deny("الحساب غير متاح");
    const [record] = await readRows(tx, sql`SELECT * FROM supplier_return_cases WHERE id=${input.caseId} FOR UPDATE`);
    if (!record || Number(record.creatorId) !== actor.id) deny("الإلغاء لمنشئ الطلب الأصلي فقط");
    const [source] = await readRows(tx, sql`SELECT p.id,p.requestedById,p.ticketId,p.ticketItemId,i.id AS itemId
      FROM warehouse_returns r INNER JOIN purchase_orders p ON p.id=r.purchaseOrderId
      INNER JOIN purchase_order_items i ON i.id=r.purchaseOrderItemId AND i.purchaseOrderId=p.id
      WHERE r.id=${record.returnId} AND r.inventoryId=${record.inventoryId} AND r.sourceDeliveryDocumentId IS NULL FOR UPDATE`);
    if (!source || Number(source.id) !== Number(record.purchaseOrderId)
      || Number(source.itemId) !== Number(record.purchaseOrderItemId) || Number(source.requestedById) !== actor.id)
      conflict("تغير مصدر المرتجع أو منشئ الطلب");
    const hash = createHash("sha256").update(JSON.stringify({ actorId:actor.id,...input })).digest("hex");
    const [previous] = await readRows(tx, sql`SELECT actorId,requestHash,result FROM supplier_return_events WHERE caseId=${input.caseId} AND operationKey=${input.operationKey}`);
    if (previous) {
      if (Number(previous.actorId) !== actor.id || previous.requestHash !== hash) conflict("مفتاح العملية مستخدم لقرار مختلف");
      return typeof previous.result === "string" ? JSON.parse(previous.result) : previous.result;
    }
    if (record.closedAt || record.handoverStatus !== "accepted" || record.resolution !== "refund"
      || record.creatorDecision !== "pending" || Number(record.revision) !== input.expectedRevision) conflict("لم يعد المرتجع قابلًا للإلغاء");
    const [refund] = await readRows(tx, sql`SELECT id FROM supplier_return_settlements WHERE caseId=${input.caseId}
      AND type='cash_refund' AND status='completed' AND operationKey=${`cash-refund:${input.caseId}`} FOR UPDATE`);
    if (!refund) conflict("لم يؤكد المندوب استلام المبلغ بعد");
    const [plan] = await readRows(tx, sql`SELECT id FROM supplier_return_replacement_plans WHERE caseId=${input.caseId} LIMIT 1`);
    if (plan) conflict("يوجد طلب بديل لهذا المرتجع");
    const knownTables = ["it_purchase_needs", "pmv2_material_purchase_links", "operational_issue_purchase_links", "external_maintenance_jobs"] as const;
    const tables = await readRows(tx, sql`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()
      AND TABLE_NAME IN ('it_purchase_needs','pmv2_material_purchase_links','operational_issue_purchase_links','external_maintenance_jobs')`);
    const present = new Set(tables.map(row => String(row.name).toLowerCase()));
    let hasOtherLink = false;
    if (present.has(knownTables[0])) hasOtherLink ||= (await readRows(tx, sql`SELECT id FROM it_purchase_needs WHERE purchaseOrderId=${source.id} LIMIT 1`)).length > 0;
    if (present.has(knownTables[1])) hasOtherLink ||= (await readRows(tx, sql`SELECT id FROM pmv2_material_purchase_links WHERE purchaseOrderItemId=${source.itemId} LIMIT 1`)).length > 0;
    if (present.has(knownTables[2])) hasOtherLink ||= (await readRows(tx, sql`SELECT 1 AS linked FROM operational_issue_purchase_links WHERE purchaseOrderItemId=${source.itemId} LIMIT 1`)).length > 0;
    if (present.has(knownTables[3])) hasOtherLink ||= (await readRows(tx, sql`SELECT id FROM external_maintenance_jobs WHERE purchaseOrderId=${source.id} LIMIT 1`)).length > 0;
    const before: Followup = { delegateId:Number(record.delegateId),creatorId:Number(record.creatorId),returnedQuantity:Number(record.returnedQuantity),
      revision:Number(record.revision),handover:record.handoverStatus,resolution:record.resolution,rejectionReason:record.rejectionReason,creatorDecision:record.creatorDecision };
    const after = decideCreator({ id:actor.id,role:actor.role,active:true },before,input.expectedRevision,"cancel",{
      verified:true,hasMaintenance:source.ticketId != null || hasOtherLink,hasTask:source.ticketItemId != null,hasMaterialNeed:hasOtherLink,
    });
    const [written] = await tx.execute(sql`UPDATE supplier_return_cases SET creatorDecision='cancel',revision=${after.revision},closedAt=CURRENT_TIMESTAMP
      WHERE id=${input.caseId} AND revision=${before.revision} AND creatorDecision='pending' AND closedAt IS NULL`);
    if (Number(written?.affectedRows) !== 1) conflict("تغير المرتجع أثناء الإلغاء");
    const result = { caseId:input.caseId,revision:after.revision,decision:"cancel" as const };
    await tx.execute(sql`INSERT INTO supplier_return_events
      (caseId,actorId,action,operationKey,requestHash,fromRevision,toRevision,beforeState,afterState,reason,result)
      VALUES (${input.caseId},${actor.id},'creator_cancel',${input.operationKey},${hash},${before.revision},${after.revision},
        ${JSON.stringify(before)},${JSON.stringify(after)},'إلغاء التعويض بعد استرداد المبلغ',${JSON.stringify(result)})`);
    return result;
  });
}
