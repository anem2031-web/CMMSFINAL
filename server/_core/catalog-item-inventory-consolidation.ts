import { TRPCError } from "@trpc/server";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import {
  deliveryDocuments,
  disposalItems,
  inventory,
  inventoryCountItems,
  inventoryCountSnapshots,
  inventoryLotBalances,
  inventorySettlementItems,
  inventoryTransactions,
  warehouseReceiptItems,
  warehouseReturns,
  warehouseTransfers,
} from "../../drizzle/schema";
import {
  calculateInventoryValue,
  calculateMovingWeightedAverage,
  normalizeInventoryQuantity,
} from "./inventory-costing";

export interface ResolvedInventoryCandidate {
  id: number;
  inventoryId: number;
}

export interface InventoryConsolidationMove {
  sourceInventoryId: number;
  targetInventoryId: number;
  warehouseId: number;
  movedQuantity: number;
}

function numericId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function lockInventoryRow(tx: any, inventoryId: number): Promise<void> {
  await tx.execute(sql`SELECT id FROM inventory WHERE id = ${inventoryId} FOR UPDATE`);
}

async function moveLotBalances(tx: any, sourceInventoryId: number, targetInventoryId: number): Promise<void> {
  const sourceBalances = await tx.select({
    id: inventoryLotBalances.id,
    lotId: inventoryLotBalances.lotId,
    quantity: inventoryLotBalances.quantity,
  }).from(inventoryLotBalances)
    .where(eq(inventoryLotBalances.inventoryId, sourceInventoryId));

  for (const sourceBalance of sourceBalances as any[]) {
    const targetBalances = await tx.select({
      id: inventoryLotBalances.id,
      quantity: inventoryLotBalances.quantity,
    }).from(inventoryLotBalances)
      .where(and(
        eq(inventoryLotBalances.inventoryId, targetInventoryId),
        eq(inventoryLotBalances.lotId, sourceBalance.lotId),
      ))
      .limit(1);

    const targetBalance = targetBalances[0] as any;
    if (!targetBalance) {
      await tx.update(inventoryLotBalances)
        .set({ inventoryId: targetInventoryId } as any)
        .where(eq(inventoryLotBalances.id, sourceBalance.id));
      continue;
    }

    const combinedQuantity = normalizeInventoryQuantity(
      Number(targetBalance.quantity || 0) + Number(sourceBalance.quantity || 0),
    );
    await tx.update(inventoryLotBalances)
      .set({ quantity: combinedQuantity.toFixed(3) } as any)
      .where(eq(inventoryLotBalances.id, targetBalance.id));
    await tx.delete(inventoryLotBalances).where(eq(inventoryLotBalances.id, sourceBalance.id));
  }
}

async function moveOperationalInventoryReferences(
  tx: any,
  sourceInventoryId: number,
  targetInventoryId: number,
): Promise<void> {
  await tx.update(warehouseReceiptItems)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(warehouseReceiptItems.inventoryId, sourceInventoryId));

  await tx.update(inventoryTransactions)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(inventoryTransactions.inventoryId, sourceInventoryId));

  await moveLotBalances(tx, sourceInventoryId, targetInventoryId);

  await tx.update(deliveryDocuments)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(deliveryDocuments.inventoryId, sourceInventoryId));

  await tx.update(warehouseReturns)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(warehouseReturns.inventoryId, sourceInventoryId));

  await tx.update(disposalItems)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(disposalItems.inventoryId, sourceInventoryId));

  await tx.update(inventoryCountSnapshots)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(inventoryCountSnapshots.inventoryId, sourceInventoryId));

  await tx.update(inventoryCountItems)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(inventoryCountItems.inventoryId, sourceInventoryId));

  await tx.update(inventorySettlementItems)
    .set({ inventoryId: targetInventoryId } as any)
    .where(eq(inventorySettlementItems.inventoryId, sourceInventoryId));

  await tx.update(warehouseTransfers)
    .set({ fromInventoryId: targetInventoryId } as any)
    .where(eq(warehouseTransfers.fromInventoryId, sourceInventoryId));

  await tx.update(warehouseTransfers)
    .set({ toInventoryId: targetInventoryId } as any)
    .where(eq(warehouseTransfers.toInventoryId, sourceInventoryId));
}

async function mergeInventoryRow(
  tx: any,
  sourceInventoryId: number,
  targetInventoryId: number,
  catalogItemId: number,
): Promise<InventoryConsolidationMove> {
  if (sourceInventoryId === targetInventoryId) {
    throw new TRPCError({ code: "CONFLICT", message: "تعذر دمج سجل المخزون مع نفسه" });
  }

  for (const id of [sourceInventoryId, targetInventoryId].sort((a, b) => a - b)) {
    await lockInventoryRow(tx, id);
  }

  const rows = await tx.select({
    id: inventory.id,
    linkedItemId: inventory.linkedItemId,
    warehouseId: inventory.warehouseId,
    quantity: inventory.quantity,
    averageCost: inventory.averageCost,
    isFrozen: inventory.isFrozen,
  }).from(inventory)
    .where(inArray(inventory.id, [sourceInventoryId, targetInventoryId]));

  const source = (rows as any[]).find(row => Number(row.id) === sourceInventoryId);
  const target = (rows as any[]).find(row => Number(row.id) === targetInventoryId);
  if (!source || !target) {
    throw new TRPCError({ code: "CONFLICT", message: "تعذر العثور على سجل المخزون المطلوب لإتمام الربط" });
  }

  const sourceWarehouseId = numericId(source.warehouseId);
  const targetWarehouseId = numericId(target.warehouseId);
  if (!sourceWarehouseId || !targetWarehouseId || sourceWarehouseId !== targetWarehouseId) {
    throw new TRPCError({ code: "CONFLICT", message: "لا يمكن دمج سجلي مخزون من مستودعين مختلفين" });
  }
  if (numericId(source.linkedItemId) !== catalogItemId || numericId(target.linkedItemId) !== catalogItemId) {
    throw new TRPCError({ code: "CONFLICT", message: "تغير ربط أحد سجلي المخزون أثناء العملية؛ حدّث الصفحة وأعد المحاولة" });
  }
  if (Number(target.isFrozen || 0) === 1) {
    throw new TRPCError({ code: "CONFLICT", message: "سجل المخزون الموجود لهذا الصنف مجمد؛ يجب مراجعته قبل الربط" });
  }

  const sourceQuantity = normalizeInventoryQuantity(Number(source.quantity || 0));
  const targetQuantity = normalizeInventoryQuantity(Number(target.quantity || 0));
  const sourceAverageCost = Math.max(0, Number(source.averageCost || 0));
  const targetAverageCost = Math.max(0, Number(target.averageCost || 0));
  const mergedQuantity = normalizeInventoryQuantity(targetQuantity + sourceQuantity);
  const mergedAverageCost = calculateMovingWeightedAverage({
    currentQuantity: targetQuantity,
    currentAverageCost: targetAverageCost,
    incomingQuantity: sourceQuantity,
    incomingUnitCost: sourceAverageCost,
  });

  await moveOperationalInventoryReferences(tx, sourceInventoryId, targetInventoryId);

  await tx.update(inventory).set({
    quantity: mergedQuantity,
    averageCost: mergedAverageCost.toFixed(4),
    totalCostValue: calculateInventoryValue(mergedQuantity, mergedAverageCost).toFixed(2),
  } as any).where(eq(inventory.id, targetInventoryId));

  // لا نحذف هوية Inventory المؤقتة حتى يبقى Candidate وسجل التدقيق قابلين للتتبع.
  // بعد نقل كل الروابط التشغيلية نصفرها، نفصلها عن Catalog ونجمّدها كي لا تظهر
  // كسطر مخزون ثانٍ ولا تدخل في مطابقة الاستلام المستقبلية لنفس الصنف.
  await tx.update(inventory).set({
    quantity: 0,
    totalCostValue: "0.00",
    linkedItemId: null,
    isFrozen: 1,
  } as any).where(eq(inventory.id, sourceInventoryId));

  return {
    sourceInventoryId,
    targetInventoryId,
    warehouseId: sourceWarehouseId,
    movedQuantity: sourceQuantity,
  };
}

/**
 * بعد حسم Candidate وربطه بصنف Catalog موجود، نوحّد هوية المخزون داخل كل مستودع.
 * المستندات والحركات والـLots تحتفظ بمعرفاتها الأصلية؛ الذي يتغير فقط هو inventoryId
 * المرجعي حتى يصبح لكل Catalog Item سجل مخزون نشط واحد في المستودع.
 */
export async function consolidateResolvedCatalogInventory(
  tx: any,
  candidates: ResolvedInventoryCandidate[],
  catalogItemId: number,
): Promise<InventoryConsolidationMove[]> {
  const sourceInventoryIds = Array.from(new Set(
    candidates.map(candidate => Number(candidate.inventoryId)).filter(id => Number.isInteger(id) && id > 0),
  ));
  if (sourceInventoryIds.length === 0) return [];

  const sourceRows = await tx.select({
    id: inventory.id,
    linkedItemId: inventory.linkedItemId,
    warehouseId: inventory.warehouseId,
  }).from(inventory)
    .where(inArray(inventory.id, sourceInventoryIds));

  if (sourceRows.length !== sourceInventoryIds.length) {
    throw new TRPCError({ code: "CONFLICT", message: "أحد سجلات المخزون الخاصة بالأصناف الجديدة غير موجود" });
  }

  const byWarehouse = new Map<number, number[]>();
  for (const row of sourceRows as any[]) {
    const warehouseId = numericId(row.warehouseId);
    if (!warehouseId) {
      throw new TRPCError({ code: "CONFLICT", message: `سجل المخزون #${row.id} غير مرتبط بمستودع؛ يجب مراجعته قبل الربط` });
    }
    if (numericId(row.linkedItemId) !== catalogItemId) {
      throw new TRPCError({ code: "CONFLICT", message: `هوية الكتالوج لم تُنشر على سجل المخزون #${row.id} كما هو متوقع` });
    }
    const ids = byWarehouse.get(warehouseId) || [];
    ids.push(Number(row.id));
    byWarehouse.set(warehouseId, ids);
  }

  const moves: InventoryConsolidationMove[] = [];
  for (const [warehouseId, warehouseSourceIds] of byWarehouse.entries()) {
    const existingRows = await tx.select({
      id: inventory.id,
      isFrozen: inventory.isFrozen,
    }).from(inventory)
      .where(and(
        eq(inventory.linkedItemId, catalogItemId),
        eq(inventory.warehouseId, warehouseId),
        notInArray(inventory.id, warehouseSourceIds),
      ));

    const existingNonSource = existingRows as any[];
    if (existingNonSource.length > 1) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "يوجد أكثر من سجل مخزون قديم لنفس صنف الكتالوج داخل المستودع. يجب معالجة التكرار القديم قبل إتمام الربط.",
      });
    }

    let targetInventoryId: number;
    if (existingNonSource[0]) {
      if (Number(existingNonSource[0].isFrozen || 0) === 1) {
        throw new TRPCError({ code: "CONFLICT", message: "سجل المخزون الموجود لهذا الصنف مجمد؛ يجب مراجعته قبل الربط" });
      }
      targetInventoryId = Number(existingNonSource[0].id);
    } else {
      // إذا كانت مجموعة مرشحين لنفس الصنف ولا يوجد رصيد سابق، نحتفظ بسجل واحد
      // منها كسجل أساسي ونضم إليه بقية المرشحين في نفس المستودع.
      targetInventoryId = [...warehouseSourceIds].sort((a, b) => a - b)[0];
    }

    for (const sourceInventoryId of warehouseSourceIds) {
      if (sourceInventoryId === targetInventoryId) continue;
      moves.push(await mergeInventoryRow(tx, sourceInventoryId, targetInventoryId, catalogItemId));
    }
  }

  return moves;
}
