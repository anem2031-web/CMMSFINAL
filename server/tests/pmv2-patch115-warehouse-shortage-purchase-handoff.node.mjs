import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const contracts = read("server/pmv2/adapters/contracts.ts");
const adapters = read("server/pmv2/adapters/current-system.ts");
const queueService = read("server/pmv2/materials/warehouse-queue-service.ts");
const purchaseHandoff = read("server/pmv2/materials/warehouse-purchase-handoff-service.ts");
const issueService = read("server/pmv2/materials/team-issue-handoff-service.ts");
const warehouseRouter = read("server/routers/pmv2/warehouse.ts");
const warehousePage = read("client/src/pages/pmv2/Pmv2WarehouseQueue.tsx");
const purchasePage = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");
const transferService = read("server/pmv2/materials/warehouse-transfer-handoff-service.ts");
const transferPage = read("client/src/pages/inventory/WarehouseTransfer.tsx");
const schema = read("drizzle/schema.ts");


test("Patch 115 keeps the full task need visible but makes warehouse action quantity the shortage only", () => {
  assert.match(warehousePage, /احتياج المهمة/);
  assert.match(warehousePage, /المتاح في مخزن الفريق وقت الطلب/);
  assert.match(warehousePage, /النقص المسجل على المهمة/);
  assert.match(warehousePage, /المتبقي المطلوب تغطيته/);
  assert.match(warehousePage, /لذلك المطلوب من المستودع تغطية/);
  assert.match(warehousePage, /تحويل النقص إلى مخزن الفريق/);
});


test("shortage-routed material is hidden from ready issue/receipt until the shortage physically reaches Team Warehouse", () => {
  assert.match(issueService, /materialRequestItemIds/);
  assert.match(issueService, /requestItem\.status !== "issued_to_team"/);
  assert.match(issueService, /suppliedToTeam \+ 0\.0005 < requestedFromWarehouse/);
  assert.match(issueService, /prevents the original full task need from appearing as an issue card/);
});


test("warehouse queue exposes existing PM V2 purchase links without making Purchase rows part of PM V2 ownership", () => {
  assert.match(schema, /export const pmv2MaterialPurchaseLinks/);
  assert.match(queueService, /pmv2MaterialPurchaseLinks/);
  assert.match(queueService, /currentPurchaseAdapter\.getOrdersByIds/);
  assert.match(queueService, /pendingPurchaseCoverageQuantity/);
  assert.match(queueService, /purchaseNeededQuantity/);
  assert.doesNotMatch(queueService, /insert\(purchaseOrders\)|update\(purchaseOrders\)|insert\(purchaseOrderItems\)|update\(purchaseOrderItems\)/);
});


test("current Purchase workflow is consumed through a read adapter boundary", () => {
  assert.match(contracts, /interface PurchaseAdapter/);
  assert.match(contracts, /getOrderWithItems/);
  assert.match(adapters, /currentPurchaseAdapter/);
  const block = adapters.slice(adapters.indexOf("export const currentPurchaseAdapter"), adapters.indexOf("export const currentMaintenanceTargetAdapter"));
  assert.match(block, /from\(purchaseOrders\)/);
  assert.match(block, /from\(purchaseOrderItems\)/);
  assert.doesNotMatch(block, /\.insert\(|\.update\(|\.delete\(/);
});


test("purchase handoff computes only the uncovered Main-Warehouse shortage and blocks duplicate pending coverage", () => {
  assert.match(purchaseHandoff, /remainingQuantity - availableMainQuantity/);
  assert.match(purchaseHandoff, /pendingPurchaseCoverage/);
  assert.match(purchaseHandoff, /purchaseMinimumQuantity/);
  assert.match(purchaseHandoff, /يوجد طلب شراء مرتبط يغطي العجز الحالي/);
  assert.match(purchaseHandoff, /الكمية الناقصة أصبحت متوفرة بالكامل في المستودع الرئيسي/);
});


test("PM V2 never creates a PO; it links one authoritative PO item with a capped linked quantity", () => {
  assert.match(purchaseHandoff, /currentPurchaseAdapter\.getOrderWithItems/);
  assert.match(purchaseHandoff, /purchaseItem\.catalogItemId !== context\.catalogItemId/);
  assert.match(purchaseHandoff, /Math\.min\(uncoveredQuantity, Number\(purchaseItem\.quantity/);
  assert.match(purchaseHandoff, /insert\(pmv2MaterialPurchaseLinks\)/);
  assert.match(purchaseHandoff, /action: "material_purchase_linked"/);
  assert.doesNotMatch(purchaseHandoff, /insert\(purchaseOrders\)|update\(purchaseOrders\)|insert\(purchaseOrderItems\)|update\(purchaseOrderItems\)/);
});


test("warehouse router exposes purchase prepare/link actions under the existing PM V2 warehouse authorization", () => {
  assert.match(warehouseRouter, /preparePurchaseHandoff: pmv2WarehouseProcedure/);
  assert.match(warehouseRouter, /linkPurchaseOrder: pmv2WarehouseProcedure/);
  assert.match(warehouseRouter, /purchaseOrderItemId: z\.number\(\)\.int\(\)\.positive\(\)/);
});


test("warehouse UI chooses full shortage transfer when Main Warehouse covers it, otherwise opens Purchase for the uncovered amount", () => {
  assert.match(warehousePage, /item\.availabilityStatus === "available"/);
  assert.match(warehousePage, /تحويل النقص إلى مخزن الفريق/);
  assert.match(warehousePage, /Number\(item\.purchaseNeededQuantity \|\| 0\) > 0/);
  assert.match(warehousePage, /إنشاء طلب شراء للعجز/);
  assert.match(warehousePage, /preparePurchaseHandoff\.useMutation/);
  assert.match(warehousePage, /navigate\(`\/purchase-orders\/new\?\$\{params\.toString\(\)\}`\)/);
});


test("Purchase page receives PM V2 context, preserves the linked Catalog identity, and submits the PM V2 reference with creation", () => {
  assert.match(purchasePage, /pmv2RequestItemId/);
  assert.match(purchasePage, /pmv2CatalogItemId/);
  assert.match(purchasePage, /pmv2MinimumQuantity/);
  assert.match(purchasePage, /طلب شراء مرتبط بعجز PM V2/);
  assert.match(purchasePage, /disabled=\{isPmv2BoundItem && Boolean\(pmv2ResolvedCatalogUnit\)\}/);
  assert.match(purchasePage, /pmv2RequestItemId: hasPmv2PurchaseContext \? pmv2RequestItemId : undefined/);
  assert.doesNotMatch(purchasePage, /linkPmv2PurchaseMut\.mutateAsync/);
});


test("purchase coverage follows confirmed warehouse receipt truth so a PO is not double-counted after stock entry", () => {
  assert.match(contracts, /inventoryReceivedQuantity: number/);
  assert.match(adapters, /warehouseReceiptItems/);
  assert.match(adapters, /warehouseReceipts/);
  assert.match(adapters, /eq\(warehouseReceipts\.status, "confirmed"\)/);
  assert.match(queueService, /pendingPurchaseCoverageQuantity/);
  assert.match(queueService, /purchaseItem\.inventoryReceivedQuantity/);
  assert.match(purchaseHandoff, /item\.inventoryReceivedQuantity/);
});

test("new PM V2 transfer handoff does not default to a partial Main-to-Team transfer", () => {
  assert.match(transferService, /availableQuantity \+ 0\.0005 < remainingQuantity/);
  assert.match(transferService, /لا يبدأ PM V2 تحويلًا جزئيًا افتراضيًا/);
  assert.match(transferPage, /Math\.abs\(pmv2CartQuantity - pmv2Handoff\.quantity\) > 0\.0005/);
  assert.match(transferPage, /يجب تحويل كامل النقص المرتبط بالمهمة/);
});
