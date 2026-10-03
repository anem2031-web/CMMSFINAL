import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const warehousePage = read("client/src/pages/pmv2/Pmv2WarehouseQueue.tsx");
const purchasePage = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");
const purchaseHandoff = read("server/pmv2/materials/warehouse-purchase-handoff-service.ts");


test("Patch 117 forwards task-need and Team-Warehouse snapshot context into the PM V2 Purchase reference", () => {
  assert.match(warehousePage, /pmv2TaskNeedQuantity/);
  assert.match(warehousePage, /pmv2TeamAvailableAtRequest/);
  assert.match(warehousePage, /String\(item\.taskNeedQuantity\)/);
  assert.match(warehousePage, /String\(item\.teamAvailableAtRequest\)/);
  assert.match(warehousePage, /لا تُضاف أصناف أخرى إلى نفس الطلب/);
});


test("PM V2-linked Purchase clearly identifies its maintenance reference and shortage context", () => {
  assert.match(purchasePage, /مرتبط بمهمة صيانة مجدولة PM V2/);
  assert.match(purchasePage, /مرجع الطلب:/);
  assert.match(purchasePage, /المهمة المرتبطة:/);
  assert.match(purchasePage, /سبب الطلب:/);
  assert.match(purchasePage, /عجز مواد صيانة مجدولة/);
  assert.match(purchasePage, /احتياج المهمة:/);
  assert.match(purchasePage, /المتوفر بمخزن الفريق عند إنشاء العجز:/);
  assert.match(purchasePage, /الكمية المطلوب شراؤها:/);
});


test("PM V2-linked Purchase is hardened to one Catalog item with the exact linked shortage quantity", () => {
  assert.match(purchasePage, /PM V2-linked Purchase is intentionally one shortage item = one Purchase item/);
  assert.match(purchasePage, /prev\.length === 1/);
  assert.match(purchasePage, /catalogItemId: pmv2CatalogItemId/);
  assert.match(purchasePage, /quantity: pmv2MinimumPurchaseUnits/);
  assert.match(purchasePage, /items\.length !== 1/);
  assert.match(purchasePage, /Number\(boundItem\.quantity \|\| 0\) !== pmv2MinimumPurchaseUnits/);
  assert.match(purchasePage, /طلب الشراء المرتبط بـPM V2 يجب أن يحتوي على الصنف الناقص فقط/);
});


test("linked item identity, exact quantity and resolved unit are locked while normal Purchase behavior stays available outside PM V2", () => {
  assert.match(purchasePage, /disabled=\{isPmv2BoundItem\}/);
  assert.match(purchasePage, /readOnly=\{item\.sourceType === "catalog"\}/);
  assert.match(purchasePage, /disabled=\{isPmv2BoundItem && Boolean\(pmv2ResolvedCatalogUnit\)\}/);
  assert.match(purchasePage, /\{!hasPmv2PurchaseContext && \(/);
  assert.match(purchasePage, /setItems\(prev => \[\.\.\.prev, emptyItem\(\)\]\)/);
});


test("submit payload itself collapses PM V2-linked Purchase to the single bound item", () => {
  assert.match(purchasePage, /const purchaseItemsForSubmit = \(\) =>/);
  assert.match(purchasePage, /items\.find\(i => Number\(i\.catalogItemId\) === pmv2CatalogItemId\)/);
  assert.match(purchasePage, /return boundItem \? \[\{ \.\.\.boundItem, quantity: pmv2MinimumPurchaseUnits \}\] : \[\]/);
  assert.match(purchasePage, /quantity:\s+hasPmv2PurchaseContext \? pmv2MinimumPurchaseUnits : i\.quantity/);
});


test("Patch 117 does not move Purchase ownership into PM V2 or add Purchase mutations to the handoff service", () => {
  assert.doesNotMatch(purchaseHandoff, /insert\(purchaseOrders\)|update\(purchaseOrders\)|insert\(purchaseOrderItems\)|update\(purchaseOrderItems\)/);
  assert.match(purchasePage, /trpc\.purchaseOrders\.create\.useMutation/);
  assert.match(purchasePage, /trpc\.purchaseOrders\.saveDraft\.useMutation/);
});
