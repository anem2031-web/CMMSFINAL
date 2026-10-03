import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const purchaseHandoff = read("server/pmv2/materials/warehouse-purchase-handoff-service.ts");
const warehousePage = read("client/src/pages/pmv2/Pmv2WarehouseQueue.tsx");
const purchasePage = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");


test("Patch 116 resolves the PM V2 purchase unit through existing Catalog Unit master data", () => {
  assert.match(purchaseHandoff, /findCatalogUnitByName/);
  assert.match(purchaseHandoff, /resolveActiveCatalogUnit/);
  assert.match(purchaseHandoff, /activeCatalogUnit/);
  assert.match(purchaseHandoff, /unitId: purchaseUnitId/);
  assert.match(purchaseHandoff, /unit: purchaseUnit \|\| null/);
});


test("Patch 116 keeps bilingual Catalog Unit aliases equivalent for operational availability checks", () => {
  assert.match(purchaseHandoff, /async function unitsEquivalent/);
  assert.match(purchaseHandoff, /Number\(leftUnit\.id\) === Number\(rightUnit\.id\)/);
  assert.match(purchaseHandoff, /await unitsEquivalent\(db, availability\.unit, context\.unitSnapshot\)/);
});


test("warehouse purchase handoff passes the stable resolved unit id into the existing purchase page", () => {
  assert.match(warehousePage, /handoff\.unitId/);
  assert.match(warehousePage, /params\.set\("pmv2UnitId", String\(handoff\.unitId\)\)/);
  assert.match(warehousePage, /pmv2Unit: handoff\.unit \|\| ""/);
});


test("existing purchase page resolves PM V2 unit by id first and canonicalizes the bound item", () => {
  assert.match(purchasePage, /pmv2UnitIdRaw/);
  assert.match(purchasePage, /Number\(unit\.id\) === pmv2UnitId/);
  assert.match(purchasePage, /pmv2ResolvedCatalogUnit/);
  assert.match(purchasePage, /canonicalUnit = String\(pmv2ResolvedCatalogUnit\.nameAr\)/);
  assert.match(purchasePage, /itemIndex === idx \? \{ \.\.\.item, unit: canonicalUnit \}/);
});


test("PM V2 purchase unit is locked only when Master Data resolved it, otherwise manual fallback remains available", () => {
  assert.match(purchasePage, /disabled=\{isPmv2BoundItem && Boolean\(pmv2ResolvedCatalogUnit\)\}/);
  assert.match(purchasePage, /لم تُحسم وحدة الصنف تلقائيًا من Master Data/);
  assert.match(purchasePage, /تعذر تحديد وحدة PM V2 تلقائيًا؛ اختر وحدة القياس من القائمة قبل حفظ طلب الشراء/);
});
