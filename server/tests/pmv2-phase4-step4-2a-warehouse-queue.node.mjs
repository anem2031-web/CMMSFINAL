import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const contracts = read("server/pmv2/adapters/contracts.ts");
const adapters = read("server/pmv2/adapters/current-system.ts");
const queueService = read("server/pmv2/materials/warehouse-queue-service.ts");
const queueRouter = read("server/routers/pmv2/warehouse.ts");
const routerIndex = read("server/routers/pmv2/index.ts");
const securityPolicy = read("server/pmv2/security/policy.ts");
const securityProcedures = read("server/pmv2/security/procedures.ts");
const roles = read("shared/roles.ts");
const page = read("client/src/pages/pmv2/Pmv2WarehouseQueue.tsx");
const app = read("client/src/App.tsx");
const nav = read("client/src/components/layout/DashboardLayout.tsx");
const ar = read("client/src/i18n/ar.ts");


test("Step 4.2A adds a strict Main-Warehouse adapter boundary instead of hard-coding warehouse ID", () => {
  assert.match(contracts, /requireSingleActiveMainWarehouse/);
  assert.match(adapters, /eq\(warehouses\.type, "main"\)/);
  assert.match(adapters, /eq\(warehouses\.isActive, 1\)/);
  assert.match(adapters, /\.limit\(2\)/);
  assert.match(adapters, /لا يوجد مستودع رئيسي مفعّل/);
  assert.match(adapters, /يوجد أكثر من مستودع رئيسي مفعّل/);
  assert.doesNotMatch(queueService, /warehouseId\s*=\s*1|warehouseId:\s*1/);
});

test("warehouse queue reads only waiting_warehouse PM V2 request items", () => {
  assert.match(queueService, /from\(pmv2MaterialRequestItems\)/);
  assert.match(queueService, /innerJoin\(\s*pmv2MaterialRequests/);
  assert.match(queueService, /eq\(pmv2MaterialRequestItems\.status, "waiting_warehouse"\)/);
  assert.match(queueService, /taskNumber: pmv2Tasks\.taskNumber/);
  assert.match(queueService, /teamWarehouseId: pmv2MaterialRequests\.teamWarehouseId/);
});

test("queue checks Main-Warehouse availability through the existing Inventory adapter in one batch", () => {
  assert.match(queueService, /currentInventoryAdapter\.getCatalogAvailabilities\(catalogIds, mainWarehouse\.id\)/);
  assert.match(queueService, /availabilityByCatalogId/);
  assert.match(queueService, /availableQuantity/);
  assert.match(queueService, /lotsRequired/);
});

test("unlisted material is kept explicit and is never guessed against Inventory", () => {
  assert.match(queueService, /row\.catalogItemId == null/);
  assert.match(queueService, /availabilityStatus = "unlisted"/);
  assert.match(page, /غير موجودة في الدليل — يلزم حل الهوية قبل أي تحويل/);
  assert.match(page, /لا يتم تخمين صنف بديل/);
});

test("queue protects against invalid Catalog and ambiguous Inventory identity", () => {
  assert.match(queueService, /!catalogItem \|\| !catalogItem\.isActive/);
  assert.match(queueService, /availabilityStatus = "catalog_unavailable"/);
  assert.match(queueService, /availability\?\.ambiguous/);
  assert.match(queueService, /availabilityStatus = "ambiguous_inventory"/);
});

test("queue refuses to call quantities comparable when Inventory and request units differ", () => {
  assert.match(queueService, /normalizeUnit\(availability\.unit\) !== normalizeUnit\(row\.unitSnapshot\)/);
  assert.match(queueService, /availabilityStatus = "unit_mismatch"/);
  assert.match(page, /وحدة الصرف الحالية في المخزون لا تطابق وحدة الطلب/);
});

test("availability remains based on the outstanding PM V2 shortage as Step 4.2B fulfillment accumulates", () => {
  assert.match(queueService, /requestedQuantity - issuedToTeamQuantity/);
  assert.match(queueService, /\(availableQuantity \?\? 0\) >= remainingQuantity/);
  assert.match(queueService, /availabilityStatus = "available"/);
  assert.match(queueService, /availabilityStatus = "insufficient"/);
  assert.match(queueService, /remainingQuantity - availableQuantity/);
});

test("warehouse queue remains read-only even after later purchase-link visibility is added", () => {
  assert.doesNotMatch(queueService, /\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(queueService, /createWarehouseTransfer|warehouseTransfers/);
  assert.match(queueService, /currentPurchaseAdapter\.getOrdersByIds/);
  assert.match(queueService, /currentPurchaseAdapter\.getItemsByIds/);
  assert.doesNotMatch(queueService, /external_purchase|received_warehouse|issued_to_team/);
});

test("warehouse PM V2 access is a distinct server-side role guard", () => {
  assert.match(roles, /PMV2_WAREHOUSE_ROLES/);
  assert.match(roles, /APP_ROLE\.WAREHOUSE/);
  assert.match(securityPolicy, /canAccessPmv2WarehouseQueue/);
  assert.match(securityProcedures, /pmv2WarehouseProcedure/);
  assert.match(securityProcedures, /ليس لديك صلاحية لمعالجة طلبات مواد PM V2 في المستودع/);
});

test("warehouse queue router preserves the Step 4.2A read query when Step 4.2B handoff mutations are added", () => {
  assert.match(queueRouter, /waitingMaterialQueue: pmv2WarehouseProcedure\.query/);
  assert.match(queueRouter, /pmv2WarehouseQueueService\.listWaitingMaterialItems/);
  assert.match(queueRouter, /prepareTransferHandoff: pmv2WarehouseProcedure/);
  assert.match(queueRouter, /linkConfirmedTransfers: pmv2WarehouseProcedure/);
  assert.match(routerIndex, /warehouse: pmv2WarehouseRouter/);
});

test("warehouse route is explicitly allowed without granting warehouse the PM V2 management screen", () => {
  assert.match(roles, /scheduled-maintenance\/warehouse-requests/);
  assert.match(roles, /return canRoleAccessPmv2Warehouse\(role\)/);
  assert.match(roles, /return canRoleManagePmv2\(role\)/);
  assert.match(nav, /roles: \["warehouse","owner","admin"\]/);
});

test("client registers a dedicated PM V2 warehouse queue page and navigation entry", () => {
  assert.match(app, /Pmv2WarehouseQueue/);
  assert.match(app, /scheduled-maintenance\/warehouse-requests/);
  assert.match(nav, /nav\.pmv2WarehouseRequests/);
  assert.match(ar, /pmv2WarehouseRequests: "طلبات مواد PM V2"/);
});

test("warehouse queue UI identifies Main Warehouse, Team Warehouse destination, task, material and quantity", () => {
  assert.match(page, /المستودع الرئيسي المستخدم للفحص/);
  assert.match(page, /مخزن الفريق المستهدف/);
  assert.match(page, /item\.taskNumber/);
  assert.match(page, /item\.taskItemTitle/);
  assert.match(page, /item\.itemNameSnapshot/);
  assert.match(page, /item\.requestedQuantity/);
});

test("warehouse queue UI exposes the three core business outcomes plus integrity exceptions", () => {
  assert.match(page, /متوفر في المستودع الرئيسي/);
  assert.match(page, /يحتاج استكمال\/شراء/);
  assert.match(page, /غير موجود في الدليل/);
  assert.match(page, /هوية المخزون تحتاج مراجعة/);
  assert.match(page, /وحدة المخزون تختلف عن الطلب/);
});

test("Step 4.2A read model remains stock-read-only after Step 4.2B adds a handoff button", () => {
  assert.match(page, /PM V2 لا ينفذ حركة مخزون بنفسه/);
  assert.match(page, /Warehouse Transfer الحالي/);
  assert.doesNotMatch(queueService, /createWarehouseTransfer|createBatch|warehouseTransfers/);
  assert.doesNotMatch(queueService, /\.insert\(|\.update\(|\.delete\(/);
});

test("warehouse Catalog adapter returns operator-facing item code and taxonomy path without exposing DB identity as UI data", () => {
  assert.match(contracts, /categoryPathAr: string \| null/);
  assert.match(contracts, /getItemsByIds\(ids: Pmv2ExternalId\[\]\)/);
  assert.match(adapters, /catalogNodes/);
  assert.match(adapters, /categoryPathAr: path\.map\(\(node\) => node\.nameAr\)/);
  assert.match(adapters, /categoryPathEn: path\.map\(\(node\) => node\.nameEn\)/);
  assert.match(queueService, /currentCatalogAdapter\.getItemsByIds\(catalogIds\)/);
});

test("warehouse request card shows Catalog item code and taxonomy path for listed materials", () => {
  assert.match(page, /كود الصنف:/);
  assert.match(page, /item\.catalogItem\?\.code/);
  assert.match(page, /التصنيف:/);
  assert.match(page, /item\.catalogItem\?\.categoryPathAr/);
  assert.match(page, /غير محدد في شجرة الأصناف/);
});

test("warehouse UI no longer presents catalogItemId as a user-facing Catalog number", () => {
  assert.doesNotMatch(page, /Catalog #\$\{item\.catalogItemId\}/);
  assert.doesNotMatch(page, /Catalog #/);
  assert.match(page, /item\.catalogItemId != null/);
  assert.match(page, /غير موجودة في الدليل — يلزم حل الهوية قبل أي تحويل/);
});
