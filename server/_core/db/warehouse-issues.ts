// ============================================================
// db/warehouse-issues.ts — سند الصرف المخزني التجميعي (WIS)
//
// WIS لا يستبدل DLV الحالي ولا ينشئ منطق مخزون موازياً. هو رأس تجميعي
// فوق حركات issueDelivery الحالية؛ كل بند يحتفظ بـ DLV / Lot / Inventory
// Transaction الفعلي حتى تبقى المرتجعات والتذاكر والتقارير الحالية مستقرة.
// ============================================================
import { and, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import {
  inventory,
  inventoryLotBalances,
  inventoryLots,
  inventoryIssueCostAllocations,
  sections,
  sites,
  warehouseIssueBatchItems,
  warehouseIssueBatchNumberCounter,
  warehouseIssueBatches,
  warehouses,
} from "../../../drizzle/schema";
import { getDb } from "./client";
import { normalizeInventoryQuantity } from "../inventory-costing";

export type WarehouseIssueResolvedLot = {
  inventoryId: number;
  warehouseId: number | null;
  itemName: string;
  internalCode: string | null;
  manufacturerBarcode: string | null;
  unit: string | null;
  inventoryQuantity: number;
  linkedItemId: number | null;
  lotId: number;
  lotCode: string;
  trackingToken: string;
  lotBalanceQuantity: number;
  lotRemainingQuantity: number;
  lotIssueUnitCost: number;
  purchaseOrderId: number | null;
  purchaseOrderItemId: number | null;
  supplierItemName: string | null;
};

export async function resolveWarehouseIssueLot(params: {
  warehouseId: number;
  identifier: string;
}, tx?: any): Promise<WarehouseIssueResolvedLot> {
  const db = tx || await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات");

  const identifier = String(params.identifier || "").trim();
  if (!identifier) throw new Error("QR الدفعة أو رقم اللوت مطلوب");

  const warehouseRows = await db
    .select({ id: warehouses.id, type: warehouses.type, isActive: warehouses.isActive })
    .from(warehouses)
    .where(eq(warehouses.id, params.warehouseId))
    .limit(1);
  const warehouse = (warehouseRows as any[])[0];
  if (!warehouse) throw new Error("المخزن المحدد غير موجود");
  if (Number(warehouse.isActive ?? 1) === 0) throw new Error("المخزن المحدد غير نشط");

  const warehouseCondition = warehouse.type === "main"
    ? or(eq(inventory.warehouseId, params.warehouseId), isNull(inventory.warehouseId))
    : eq(inventory.warehouseId, params.warehouseId);

  const rows = await db
    .select({
      inventoryId: inventory.id,
      warehouseId: inventory.warehouseId,
      itemName: inventory.itemName,
      internalCode: inventory.internalCode,
      manufacturerBarcode: inventory.manufacturerBarcode,
      unit: inventory.unit,
      inventoryQuantity: inventory.quantity,
      linkedItemId: inventory.linkedItemId,
      lotId: inventoryLots.id,
      lotCode: inventoryLots.lotCode,
      trackingToken: inventoryLots.trackingToken,
      lotCatalogItemId: inventoryLots.catalogItemId,
      lotRemainingQuantity: inventoryLots.remainingQuantity,
      lotIssueUnitCost: inventoryLots.issueUnitCost,
      purchaseOrderId: inventoryLots.purchaseOrderId,
      purchaseOrderItemId: inventoryLots.purchaseOrderItemId,
      supplierItemName: inventoryLots.supplierItemName,
      lotBalanceQuantity: inventoryLotBalances.quantity,
    })
    .from(inventoryLots)
    .innerJoin(inventoryLotBalances, eq(inventoryLotBalances.lotId, inventoryLots.id))
    .innerJoin(inventory, eq(inventory.id, inventoryLotBalances.inventoryId))
    .where(and(
      or(eq(inventoryLots.trackingToken, identifier), eq(inventoryLots.lotCode, identifier)),
      warehouseCondition,
      gt(inventoryLotBalances.quantity, "0"),
    ));

  if ((rows as any[]).length === 0) {
    throw new Error("رقم اللوت أو الـQR لا يملك رصيدًا في المخزن المصدر المحدد");
  }
  if ((rows as any[]).length > 1) {
    throw new Error("معرّف الدفعة مرتبط بأكثر من سجل مخزون داخل المخزن المحدد؛ راجع بيانات المخزون قبل الصرف");
  }

  const row: any = (rows as any[])[0];
  const inventoryCatalogItemId = row.linkedItemId == null ? null : Number(row.linkedItemId);
  const lotCatalogItemId = row.lotCatalogItemId == null ? null : Number(row.lotCatalogItemId);
  if (
    inventoryCatalogItemId != null &&
    lotCatalogItemId != null &&
    inventoryCatalogItemId !== lotCatalogItemId
  ) {
    throw new Error("هوية الكتالوج للدفعة لا تطابق هوية الصنف في المخزون");
  }

  const lotBalanceQuantity = normalizeInventoryQuantity(Number(row.lotBalanceQuantity || 0));
  const lotRemainingQuantity = normalizeInventoryQuantity(Number(row.lotRemainingQuantity || 0));
  if (!(lotBalanceQuantity > 0) || !(lotRemainingQuantity > 0)) {
    throw new Error("هذه الدفعة لا تحتوي رصيدًا متاحًا للصرف في المخزن المحدد");
  }

  return {
    inventoryId: Number(row.inventoryId),
    warehouseId: row.warehouseId == null ? null : Number(row.warehouseId),
    itemName: String(row.itemName || row.supplierItemName || "صنف مخزون"),
    internalCode: row.internalCode == null ? null : String(row.internalCode),
    manufacturerBarcode: row.manufacturerBarcode == null ? null : String(row.manufacturerBarcode),
    unit: row.unit == null ? null : String(row.unit),
    inventoryQuantity: normalizeInventoryQuantity(Number(row.inventoryQuantity || 0)),
    linkedItemId: inventoryCatalogItemId,
    lotId: Number(row.lotId),
    lotCode: String(row.lotCode),
    trackingToken: String(row.trackingToken),
    lotBalanceQuantity,
    lotRemainingQuantity,
    lotIssueUnitCost: Number(row.lotIssueUnitCost || 0),
    purchaseOrderId: row.purchaseOrderId == null ? null : Number(row.purchaseOrderId),
    purchaseOrderItemId: row.purchaseOrderItemId == null ? null : Number(row.purchaseOrderItemId),
    supplierItemName: row.supplierItemName == null ? null : String(row.supplierItemName),
  };
}

export async function getNextWarehouseIssueBatchNumber(tx: any): Promise<string> {
  const year = new Date().getFullYear();
  const [result] = await tx.insert(warehouseIssueBatchNumberCounter).values({ year });
  const seq = Number((result as any)?.insertId || 0);
  if (!seq) throw new Error("تعذر توليد رقم سند الصرف المخزني");
  return `WIS-${year}-${String(seq).padStart(6, "0")}`;
}

export async function createWarehouseIssueBatch(data: {
  issueNumber: string;
  warehouseId: number;
  warehouseName: string;
  deliveredToId: number;
  deliveredToName: string;
  issuedById: number;
  issuedByName: string;
  notes?: string | null;
  itemsCount: number;
}, tx: any): Promise<number> {
  const [result] = await tx.insert(warehouseIssueBatches).values({
    ...data,
    notes: data.notes || null,
    status: "completed",
    printCount: 0,
  } as any);
  const id = Number((result as any)?.insertId || 0);
  if (!id) throw new Error("تعذر إنشاء رأس سند الصرف المخزني");
  return id;
}

export async function createWarehouseIssueBatchItem(data: {
  batchId: number;
  deliveryDocumentId: number;
  deliveryNumber: string;
  inventoryTransactionId: number;
  inventoryLotId: number;
  lotCode: string;
  inventoryId: number;
  catalogItemId?: number | null;
  itemName: string;
  itemCode?: string | null;
  quantity: number;
  unit?: string | null;
  referenceType?: string | null;
  referenceId?: number | null;
  referenceNumber?: string | null;
}, tx: any) {
  await tx.insert(warehouseIssueBatchItems).values({
    batchId: data.batchId,
    deliveryDocumentId: data.deliveryDocumentId,
    deliveryNumber: data.deliveryNumber,
    inventoryTransactionId: data.inventoryTransactionId,
    inventoryLotId: data.inventoryLotId,
    lotCode: data.lotCode,
    inventoryId: data.inventoryId,
    catalogItemId: data.catalogItemId ?? null,
    itemName: data.itemName,
    itemCode: data.itemCode ?? null,
    quantity: Number(data.quantity).toFixed(3),
    unit: data.unit ?? null,
    referenceType: data.referenceType ?? null,
    referenceId: data.referenceId ?? null,
    referenceNumber: data.referenceNumber ?? null,
  } as any);
}


type WarehouseIssueCostTargetRow = {
  batchId: number;
  inventoryTransactionId: number;
  beneficiarySiteId: number;
  beneficiarySiteName: string | null;
  beneficiarySectionId: number | null;
  beneficiarySectionName: string | null;
};

function summarizeWarehouseIssueCostTargets(rows: WarehouseIssueCostTargetRow[]) {
  const siteNames = Array.from(new Set(rows.map((row) => row.beneficiarySiteName).filter(Boolean) as string[]));
  const sectionNames = Array.from(new Set(rows.map((row) => row.beneficiarySectionName).filter(Boolean) as string[]));
  const siteIds = Array.from(new Set(rows.map((row) => Number(row.beneficiarySiteId)).filter((value) => value > 0)));
  const sectionIds = Array.from(new Set(rows.map((row) => Number(row.beneficiarySectionId || 0)).filter((value) => value > 0)));

  return {
    beneficiarySiteId: siteIds.length === 1 ? siteIds[0] : null,
    beneficiarySectionId: sectionIds.length === 1 ? sectionIds[0] : null,
    beneficiarySiteName: siteNames.length === 0
      ? null
      : siteNames.length === 1
        ? siteNames[0]
        : `متعدد: ${siteNames.join("، ")}`,
    beneficiarySectionName: sectionNames.length === 0
      ? null
      : sectionNames.length === 1
        ? sectionNames[0]
        : `متعدد: ${sectionNames.join("، ")}`,
  };
}

async function getWarehouseIssueCostTargetsForBatchIds(database: any, batchIds: number[]) {
  if (batchIds.length === 0) return [] as WarehouseIssueCostTargetRow[];
  return database
    .select({
      batchId: warehouseIssueBatchItems.batchId,
      inventoryTransactionId: warehouseIssueBatchItems.inventoryTransactionId,
      beneficiarySiteId: inventoryIssueCostAllocations.beneficiarySiteId,
      beneficiarySiteName: sites.name,
      beneficiarySectionId: inventoryIssueCostAllocations.beneficiarySectionId,
      beneficiarySectionName: sections.name,
    })
    .from(warehouseIssueBatchItems)
    .innerJoin(
      inventoryIssueCostAllocations,
      eq(inventoryIssueCostAllocations.inventoryTransactionId, warehouseIssueBatchItems.inventoryTransactionId),
    )
    .leftJoin(sites, eq(sites.id, inventoryIssueCostAllocations.beneficiarySiteId))
    .leftJoin(sections, eq(sections.id, inventoryIssueCostAllocations.beneficiarySectionId))
    .where(inArray(warehouseIssueBatchItems.batchId, batchIds));
}

export async function getWarehouseIssueBatches() {
  const db = await getDb();
  if (!db) return [];
  const headers = await db.select().from(warehouseIssueBatches)
    .orderBy(desc(warehouseIssueBatches.createdAt), desc(warehouseIssueBatches.id));
  if ((headers as any[]).length === 0) return [];

  const batchIds = (headers as any[]).map((row) => Number(row.id));
  const targets = await getWarehouseIssueCostTargetsForBatchIds(db, batchIds);
  const grouped = new Map<number, WarehouseIssueCostTargetRow[]>();
  for (const row of targets as WarehouseIssueCostTargetRow[]) {
    const list = grouped.get(Number(row.batchId)) || [];
    list.push(row);
    grouped.set(Number(row.batchId), list);
  }

  return (headers as any[]).map((header) => ({
    ...header,
    ...summarizeWarehouseIssueCostTargets(grouped.get(Number(header.id)) || []),
  }));
}

export async function getWarehouseIssueBatchById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const headerRows = await db.select().from(warehouseIssueBatches)
    .where(eq(warehouseIssueBatches.id, id)).limit(1);
  const header = (headerRows as any[])[0];
  if (!header) return null;
  const items = await db.select().from(warehouseIssueBatchItems)
    .where(eq(warehouseIssueBatchItems.batchId, id))
    .orderBy(warehouseIssueBatchItems.id);

  const targets = await getWarehouseIssueCostTargetsForBatchIds(db, [id]);
  const targetByTransactionId = new Map<number, WarehouseIssueCostTargetRow>();
  for (const target of targets as WarehouseIssueCostTargetRow[]) {
    targetByTransactionId.set(Number(target.inventoryTransactionId), target);
  }
  const enrichedItems = (items as any[]).map((item) => {
    const target = targetByTransactionId.get(Number(item.inventoryTransactionId));
    return {
      ...item,
      beneficiarySiteId: target?.beneficiarySiteId ?? null,
      beneficiarySiteName: target?.beneficiarySiteName ?? null,
      beneficiarySectionId: target?.beneficiarySectionId ?? null,
      beneficiarySectionName: target?.beneficiarySectionName ?? null,
    };
  });

  return {
    ...header,
    ...summarizeWarehouseIssueCostTargets(targets as WarehouseIssueCostTargetRow[]),
    items: enrichedItems,
  };
}

export async function incrementWarehouseIssueBatchPrintCount(id: number) {
  const db = await getDb();
  if (!db) return 0;
  await db.update(warehouseIssueBatches)
    .set({ printCount: sql`${warehouseIssueBatches.printCount} + 1` })
    .where(eq(warehouseIssueBatches.id, id));
  const rows = await db.select({ printCount: warehouseIssueBatches.printCount })
    .from(warehouseIssueBatches)
    .where(eq(warehouseIssueBatches.id, id))
    .limit(1);
  return Number((rows as any[])[0]?.printCount || 0);
}
