import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const handoff = read("server/pmv2/materials/warehouse-purchase-handoff-service.ts");
const createPage = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");
const detailPage = read("client/src/pages/purchase/PurchaseOrderDetail.tsx");

test("Patch 119 treats only Catalog Item unit linkage as authoritative for Purchase prefill", () => {
  assert.match(handoff, /const activeCatalogUnit = await resolveActiveCatalogUnit\(db, catalogItem!\.unit\)/);
  assert.doesNotMatch(
    handoff,
    /resolveActiveCatalogUnit\(\s*db,\s*catalogItem!\.unit,\s*availability\.unit,\s*context\.unitSnapshot/s,
  );
  assert.match(handoff, /const purchaseUnitId = activeCatalogUnit \? Number\(activeCatalogUnit\.id\) : null/);
});

test("Patch 119 accepts an explicit active Purchase unit when Catalog Item has no active unit linkage", () => {
  assert.match(handoff, /const expectedPurchaseCatalogUnit = await resolveActiveCatalogUnit\(db, linkedCatalogItem!\.unit\)/);
  assert.match(handoff, /const purchaseCatalogUnit = purchaseUnit[\s\S]*?resolveActiveCatalogUnit\(db, purchaseUnit\)/);
  assert.match(handoff, /if \(!purchaseCatalogUnit\)[\s\S]*?اختر وحدة قياس فعالة/);
  assert.match(handoff, /if \(\s*expectedPurchaseCatalogUnit &&\s*Number\(expectedPurchaseCatalogUnit\.id\) !== Number\(purchaseCatalogUnit\.id\)/s);
  assert.doesNotMatch(handoff, /unitsEquivalent\(db, purchaseItem\.unit, context\.unitSnapshot\)/);
});

test("Patch 119 does not infer an authoritative PM V2 Purchase unit from free-text names in the create page", () => {
  assert.match(createPage, /if \(!hasPmv2PurchaseContext \|\| !catalogUnits\?\.length \|\| !pmv2UnitId\) return null/);
  assert.match(createPage, /Number\(unit\.id\) === pmv2UnitId/);
  assert.doesNotMatch(createPage, /const unitKey = pmv2Unit\.trim\(\)\.toLocaleLowerCase\(\)/);
});

test("Patch 121 supersedes the Patch 119 manual relink UI with atomic PM V2 Purchase creation", () => {
  assert.match(detailPage, /const pmv2PurchaseContext = useMemo/);
  assert.match(detailPage, /طلب شراء مرتبط آليًا بعجز PM V2/);
  assert.match(detailPage, /لا توجد خطوة ربط يدوية/);
  assert.doesNotMatch(detailPage, /trpc\.pmv2\.warehouse\.linkPurchaseOrder\.useMutation/);
  assert.doesNotMatch(detailPage, /ربط \/ إعادة ربط PM V2/);
});
