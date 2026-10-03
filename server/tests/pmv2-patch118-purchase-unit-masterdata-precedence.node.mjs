import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const purchaseHandoff = read("server/pmv2/materials/warehouse-purchase-handoff-service.ts");
const purchasePage = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");


test("Patch 118/119 resolves authoritative PM V2 Purchase unit from current Catalog Item Master Data when linked", () => {
  assert.match(
    purchaseHandoff,
    /const activeCatalogUnit = await resolveActiveCatalogUnit\(db, catalogItem!\.unit\)/,
  );
  assert.match(purchaseHandoff, /unitId: purchaseUnitId/);
  assert.match(purchaseHandoff, /unit: purchaseUnit \|\| null/);
});


test("Patch 118/119 validates against the resolved Catalog Item unit when one exists", () => {
  assert.match(purchaseHandoff, /linkedCatalogItem = await currentCatalogAdapter\.requireActiveItem\(catalogItemId\)/);
  assert.match(
    purchaseHandoff,
    /const expectedPurchaseCatalogUnit = await resolveActiveCatalogUnit\(db, linkedCatalogItem!\.unit\)/,
  );
  assert.match(purchaseHandoff, /resolveActiveCatalogUnit\(db, purchaseUnit\)/);
  assert.match(purchaseHandoff, /Number\(expectedPurchaseCatalogUnit\.id\) !== Number\(purchaseCatalogUnit\.id\)/);
});


test("Patch 118 keeps Patch 117 single-item linked Purchase behavior intact", () => {
  assert.match(purchasePage, /مرتبط بمهمة صيانة مجدولة PM V2/);
  assert.match(purchasePage, /\{!hasPmv2PurchaseContext && \(/);
  assert.match(purchasePage, /disabled=\{isPmv2BoundItem\}/);
  assert.match(purchasePage, /disabled=\{isPmv2BoundItem && Boolean\(pmv2ResolvedCatalogUnit\)\}/);
});
