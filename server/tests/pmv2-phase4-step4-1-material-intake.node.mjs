import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const contracts = read("server/pmv2/adapters/contracts.ts");
const adapters = read("server/pmv2/adapters/current-system.ts");
const service = read("server/pmv2/materials/request-service.ts");
const validation = read("server/pmv2/materials/request-item-validation.ts");
const router = read("server/routers/pmv2/technician.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const audit = read("server/pmv2/audit/service.ts");
const quantityPolicy = read("shared/pmv2MaterialQuantity.ts");

test("Phase 4.1 adds explicit Catalog and Inventory adapter boundaries", () => {
  assert.match(contracts, /export interface CatalogAdapter/);
  assert.match(contracts, /searchActiveItems/);
  assert.match(contracts, /export interface InventoryAdapter/);
  assert.match(contracts, /getCatalogAvailability/);
  assert.match(contracts, /getCatalogAvailabilities/);
  assert.match(adapters, /export const currentCatalogAdapter: CatalogAdapter/);
  assert.match(adapters, /export const currentInventoryAdapter: InventoryAdapter/);
});

test("Catalog adapter reuses active catalog_items instead of creating PM V2 master data", () => {
  assert.match(adapters, /from\(catalogItems\)/);
  assert.match(adapters, /eq\(catalogItems\.isActive, 1\)/);
  assert.match(adapters, /like\(catalogItems\.nameAr/);
  assert.match(adapters, /like\(catalogItems\.code/);
});

test("Inventory availability is read-only and warehouse/catalog scoped", () => {
  const inventoryAdapterBlock = adapters.split("export const currentInventoryAdapter: InventoryAdapter", 2)[1]?.split("export const currentInventoryIssueAdapter", 1)[0] ?? "";
  assert.match(adapters, /inArray\(inventory\.linkedItemId, ids\)/);
  assert.match(adapters, /eq\(inventory\.warehouseId, warehouseId\)/);
  assert.match(adapters, /eq\(inventory\.isFrozen, 0\)/);
  assert.match(adapters, /matching\.length > 1/);
  assert.match(adapters, /ambiguous: true/);
  assert.doesNotMatch(inventoryAdapterBlock, /\.update\(inventory\)|\.insert\(inventoryTransactions\)|issueDelivery\(/);
});

test("Lot-enabled availability uses positive lot balances as the usable quantity", () => {
  assert.match(adapters, /isInventoryLotsEnabled\(\)/);
  assert.match(adapters, /from\(inventoryLotBalances\)/);
  assert.match(adapters, /inArray\(inventoryLotBalances\.inventoryId, rows\.map/);
  assert.match(adapters, /gt\(inventoryLotBalances\.quantity, "0"\)/);
  assert.match(adapters, /lotTotals\.get\(row\.id\)/);
});


test("Team Warehouse balances are loaded in one scoped batch for catalog options", () => {
  assert.match(adapters, /async function getCatalogAvailabilitiesReadOnly\(/);
  assert.match(adapters, /inArray\(inventory\.linkedItemId, ids\)/);
  assert.match(adapters, /eq\(inventory\.warehouseId, warehouseId\)/);
  assert.match(adapters, /inArray\(inventoryLotBalances\.inventoryId, rows\.map/);
  assert.match(service, /currentInventoryAdapter\.getCatalogAvailabilities/);
  assert.match(service, /teamAvailability: availabilityByItem\.get\(item\.id\)/);
});

test("catalog balance lookup is protected by the selected task and active team membership", () => {
  const searchBlock = service.split("async searchCatalog", 2)[1]?.split("async getItemMaterialState", 1)[0] ?? "";
  assert.match(searchBlock, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(searchBlock, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(searchBlock, /eq\(pmv2Tasks\.id, taskId\)/);
  assert.match(searchBlock, /eq\(pmv2TaskItems\.id, taskItemId\)/);
});

test("material need write is restricted to active task-team membership and waiting_material/needs_material", () => {
  assert.match(service, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(service, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(service, /context\.itemStatus !== "waiting_material"/);
  assert.match(service, /context\.itemResult !== "needs_material"/);
});

test("material request keeps the Visit that produced needs_material", () => {
  assert.match(service, /eq\(pmv2ItemActions\.action, "submit_result"\)/);
  assert.match(service, /eq\(pmv2ItemActions\.result, "needs_material"\)/);
  assert.match(service, /visitId: needAction\.visitId/);
});

test("enough Team Warehouse stock creates no Material Request and hands off to current Inventory flow", () => {
  assert.match(service, /availableQuantity >= quantity/);
  assert.match(service, /route: "team_inventory" as const/);
  assert.match(service, /materialRequestCreated: false/);
  const enoughBlock = service.split("if (availableQuantity >= quantity)", 2)[1]?.split("const existingActive", 1)[0] ?? "";
  assert.doesNotMatch(enoughBlock, /insert\(pmv2MaterialRequests\)/);
});

test("shortage creates only the missing quantity in waiting_warehouse", () => {
  assert.match(service, /Number\(\(quantity - availableQuantity\)\.toFixed\(3\)\)/);
  assert.match(service, /insert\(pmv2MaterialRequests\)/);
  assert.match(service, /insert\(pmv2MaterialRequestItems\)/);
  assert.match(service, /requestedQuantity: shortageQuantity/);
  assert.match(service, /status: "waiting_warehouse"/);
});

test("Material Request Item persistence uses the frozen write-boundary validator", () => {
  assert.match(service, /validatePmv2MaterialRequestItemWrite/);
  assert.match(validation, /الكمية المطلوبة يجب أن تكون أكبر من صفر/);
  assert.match(validation, /PMV2_MATERIAL_REQUEST_ITEM_STATUSES/);
});

test("active duplicate requests for the same material/item are rejected", () => {
  assert.match(service, /notInArray\(pmv2MaterialRequestItems\.status, \["consumed", "cancelled"\]\)/);
  assert.match(service, /يوجد بالفعل طلب مواد فعال لهذه المادة/);
});

test("Phase 4.1 never mutates stock and does not start Purchase/Ticket integration", () => {
  assert.doesNotMatch(service, /issueDelivery\(|inventoryTransactions|purchaseOrders|purchaseOrderItems|pmv2MaterialPurchaseLinks|pmv2TaskTicketLinks/);
});

test("material routing and request creation are audited", () => {
  assert.match(service, /material_need_routed_team_inventory/);
  assert.match(service, /material_request_created/);
  assert.match(audit, /"material_request"/);
});

test("technician API exposes catalog search, state, and submit Material Need behind technician procedure", () => {
  assert.match(router, /materialCatalog: pmv2TechnicianProcedure/);
  assert.match(router, /taskId: z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(router, /taskItemId: z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(router, /pmv2MaterialRequestService\.searchCatalog\(/);
  assert.match(router, /materialState: pmv2TechnicianProcedure/);
  assert.match(router, /submitMaterialNeed: pmv2TechnicianProcedure/);
  assert.match(router, /quantity: z\.number\(\)\.positive\(\)/);
  assert.match(router, /unit: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(50\)/);
});

test("My Tasks shows material intake only for needs_material waiting items", () => {
  assert.match(page, /item\.status === "waiting_material" && item\.result === "needs_material"/);
  assert.match(page, /MaterialNeedPanel/);
  assert.match(page, /materialCatalog\.useQuery/);
  assert.match(page, /submitMaterialNeed\.useMutation/);
  assert.match(page, /تسجيل الاحتياج/);
});

test("UI explains Team Warehouse fulfillment without PM V2 request and shows shortage request otherwise", () => {
  assert.match(page, /جاهز للاستلام من مخزن الفريق/);
  assert.match(page, /Inventory\/Delivery الحالي باسمك كمستلم فعلي/);
  assert.match(page, /تم إنشاء طلب #/);
  assert.match(page, /بانتظار قرار المستودع الرئيسي/);
});

test("UI shows Team Warehouse balance beside catalog items and a requested/available/shortage preview", () => {
  assert.match(page, /الرصيد:/);
  assert.match(page, /متاح:/);
  assert.match(page, /المطلوب/);
  assert.match(page, /المتاح/);
  assert.match(page, /الناقص/);
  assert.match(page, /shortageQuantity/);
  assert.match(page, /لن ينشأ طلب PM V2/);
  assert.match(page, /يمكنك استلامها الآن/);
  assert.match(page, /لن يتم صرف المتوفر جزئيًا كمسار افتراضي/);
});


test("technician feed carries previous non-final tasks forward without rewriting due dates", () => {
  const readService = read("server/pmv2/technician/read-service.ts");
  assert.match(readService, /lte\(pmv2Tasks\.dueDate, date\)/);
  assert.match(readService, /ne\(pmv2Tasks\.status, "completed"\)/);
  assert.match(readService, /sql<boolean>`exists \(/);
  assert.match(readService, /pmv2Visits\.taskId/);
  assert.match(readService, /pmv2Visits\.endedAt/);
  assert.match(readService, /ne\(pmv2Tasks\.status, "cancelled"\)/);
  assert.match(readService, /isCarryOver: String\(row\.dueDate\) < date/);
  assert.doesNotMatch(readService, /update\(pmv2Tasks\)[\s\S]*dueDate/);
});

test("technician feed reports today and carry-over counts separately", () => {
  const readService = read("server/pmv2/technician/read-service.ts");
  assert.match(readService, /todayCount: items\.filter\(item => !item\.isCarryOver\)\.length/);
  assert.match(readService, /carryOverCount: items\.filter\(item => item\.isCarryOver\)\.length/);
  assert.match(readService, /orderBy\(desc\(pmv2Tasks\.dueDate\), asc\(pmv2Tasks\.taskNumber\)\)/);
});

test("My Tasks separates today's work from previous open work and preserves original due date", () => {
  assert.match(page, /مهام سابقة مفتوحة/);
  assert.match(page, /تبقى هنا ما دام العمل غير نهائي أو توجد زيارة مفتوحة تحتاج إنهاء/);
  assert.match(page, /لا يتم تغيير تاريخ الاستحقاق الأصلي/);
  assert.match(page, /task\.isCarryOver/);
  assert.match(page, /الاستحقاق: \{task\.dueDate\}/);
  assert.match(page, /لا توجد مهام لليوم ولا مهام سابقة مفتوحة/);
});

test("Step 4.1 accepts an unlisted material without creating Catalog master data", () => {
  assert.match(service, /catalogItemId: number \| null/);
  assert.match(service, /unlistedItemName\?: string/);
  assert.match(service, /catalogItemId === null/);
  assert.match(service, /itemNameSnapshot/);
  assert.match(service, /unlistedCatalogItem: catalogItemId === null/);
  assert.doesNotMatch(service, /insert\(catalogItems\)|createCatalog|newCatalogItem/);
});

test("unlisted material skips unsafe stock guessing and requests the full need for warehouse review", () => {
  assert.match(service, /const availability = catalogItemId === null/);
  assert.match(service, /availableQuantity: 0/);
  assert.match(service, /if \(catalogItemId !== null && availableQuantity >= quantity\)/);
  assert.match(service, /catalogItemId === null[\s\S]*Number\(quantity\.toFixed\(3\)\)/);
  assert.match(service, /availabilityChecked: catalogItemId !== null/);
  assert.match(service, /availableTeamQuantity: catalogItemId === null \? null : availableQuantity/);
  assert.match(service, /status: "waiting_warehouse"/);
});

test("active duplicate unlisted requests are compared by normalized free-text name", () => {
  assert.match(service, /isNull\(pmv2MaterialRequestItems\.catalogItemId\)/);
  assert.match(service, /normalizeItemName\(row\.itemNameSnapshot\) === normalizeItemName\(itemNameSnapshot\)/);
  assert.match(service, /يوجد بالفعل طلب مواد فعال لهذه المادة/);
});

test("technician API allows null Catalog id only with an unlisted material name", () => {
  assert.match(router, /catalogItemId: z\.number\(\)\.int\(\)\.positive\(\)\.nullable\(\)/);
  assert.match(router, /unlistedItemName: z\.string\(\)\.trim\(\)\.max\(300\)\.optional\(\)/);
  assert.match(router, /value\.catalogItemId == null && !value\.unlistedItemName\?\.trim\(\)/);
  assert.match(router, /اسم المادة غير الموجودة في الدليل مطلوب/);
});

test("material UI offers an explicit unlisted-material path and labels saved requests", () => {
  assert.match(page, /لم تجد المادة في الدليل؟/);
  assert.match(page, /سجلها كمادة غير موجودة في الدليل/);
  assert.match(page, /اسم المادة المطلوبة كما تعرفها/);
  assert.match(page, /لن ينشئ PM V2 صنف Catalog جديدًا/);
  assert.match(page, /catalogItemId: entryMode === "catalog" \? Number\(catalogItemId\) : null/);
  assert.match(page, /غير موجود في الدليل/);
});

test("material intake closes and clears after a successful Material Request, then exposes an explicit add-another action", () => {
  assert.match(page, /setFormOpenOverride\(false\)/);
  assert.match(page, /resetMaterialEntry\(\)/);
  assert.match(page, /setCatalogItemId\(""\)/);
  assert.match(page, /setUnlistedItemName\(""\)/);
  assert.match(page, /setQuantity\(""\)/);
  assert.match(page, /setUnit\(""\)/);
  assert.match(page, /إضافة مادة أخرى/);
  assert.match(page, /const formOpen = formOpenOverride \?\? defaultFormOpen/);
});

test("active Catalog requests and persisted ready-to-issue handoffs are visibly blocked from duplicate selection", () => {
  assert.match(page, /activeCatalogRequestIds/);
  assert.match(page, /readyCatalogItemIds/);
  assert.match(page, /blockedCatalogItemIds/);
  assert.match(page, /const blocked = blockedCatalogItemIds\.has\(Number\(item\.id\)\)/);
  assert.match(page, /disabled=\{blocked\}/);
  assert.match(page, /مطلوب بالفعل/);
  assert.match(page, /جاهز للاستلام/);
  assert.match(page, /!blockedCatalogItemIds\.has\(Number\(catalogItemId\)\)/);
});

test("active unlisted material requests are client-guarded by normalized name in addition to the server duplicate guard", () => {
  assert.match(page, /normalizeMaterialName/);
  assert.match(page, /unlistedDuplicateActive/);
  assert.match(page, /هذه المادة لها طلب فعال بالفعل على نفس البند/);
  assert.match(page, /!unlistedDuplicateActive/);
  assert.match(service, /normalizeItemName\(row\.itemNameSnapshot\) === normalizeItemName\(itemNameSnapshot\)/);
  assert.match(service, /يوجد بالفعل طلب مواد فعال لهذه المادة/);
});


test("countable material units reject fractional quantities while divisible/unknown units remain decimal-capable", () => {
  for (const unit of ["قطعة", "حبة", "علبة", "لفة", "كيس", "وحدة", "piece", "box", "roll", "pack"]) {
    assert.match(quantityPolicy, new RegExp(`"${unit}"`));
  }
  assert.match(quantityPolicy, /pmv2MaterialUnitRequiresWholeQuantity/);
  assert.match(quantityPolicy, /Number\.isInteger\(quantity\)/);
  assert.match(quantityPolicy, /هذه الوحدة لا تقبل الكسور؛ أدخل عددًا صحيحًا/);
  assert.match(quantityPolicy, /Unknown\/free-text units are intentionally NOT assumed to be countable/);
});

test("Step 4.1 server enforces the shared quantity policy before material routing", () => {
  assert.match(service, /getPmv2MaterialQuantityValidationMessage/);
  assert.match(service, /const quantityValidationMessage = getPmv2MaterialQuantityValidationMessage\(quantity, unit\)/);
  assert.match(service, /throw new Pmv2MaterialFlowError\(quantityValidationMessage\)/);
});

test("Step 4.1 UI uses the same quantity policy, blocks submit, and switches number step for count units", () => {
  assert.match(page, /getPmv2MaterialQuantityValidationMessage/);
  assert.match(page, /pmv2MaterialUnitRequiresWholeQuantity/);
  assert.match(page, /step=\{requiresWholeQuantity \? "1" : "0\.001"\}/);
  assert.match(page, /aria-invalid=\{Boolean\(quantityValidationMessage\)\}/);
  assert.match(page, /quantityIsValid/);
  assert.match(page, /toast\.error\(nextQuantityValidationMessage\)/);
});

test("Step 4.1 persists Team Warehouse handoff as a PM V2 Item Action instead of transient UI state", () => {
  assert.match(service, /MATERIAL_ROUTE_DECISION_ACTION = "material_route_decision"/);
  assert.match(service, /insert\(pmv2ItemActions\)\.values/);
  assert.match(service, /action: MATERIAL_ROUTE_DECISION_ACTION/);
  assert.match(service, /route: "team_inventory"/);
  assert.match(service, /materialRequestId: null/);
  assert.match(service, /shortageQuantity: 0/);
});

test("material state restores the latest Catalog routing decision after refresh", () => {
  assert.match(service, /eq\(pmv2ItemActions\.action, MATERIAL_ROUTE_DECISION_ACTION\)/);
  assert.match(service, /parseMaterialRouteDecision/);
  assert.match(service, /latestCatalogRoute/);
  assert.match(service, /teamInventoryHandoffs:/);
  assert.match(service, /decision\.route === "team_inventory"/);
});

test("fully available material collapses intake and renders a persistent ready-to-receive card", () => {
  assert.match(page, /تم حفظ الاحتياج وهو جاهز للاستلام من مخزن الفريق/);
  assert.match(page, /setFormOpenOverride\(false\)/);
  assert.match(page, /teamInventoryHandoffs/);
  assert.match(page, /جاهز للاستلام من مخزن الفريق/);
  assert.match(page, /استلام المواد من مخزن الفريق/);
  assert.match(page, /readyCatalogItemIds/);
  assert.match(page, /readyCatalogItemIds\.has\(Number\(item\.id\)\)[\s\S]*"جاهز للاستلام"/);
});
