import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const handoff = read("server/pmv2/materials/warehouse-purchase-handoff-service.ts");
const purchaseRouter = read("server/routers/purchase/purchase-orders.router.ts");
const createPage = read("client/src/pages/purchase/CreatePurchaseOrder.tsx");
const detailPage = read("client/src/pages/purchase/PurchaseOrderDetail.tsx");

test("Patch 121 serializes PM V2 Purchase creation on the material request item", () => {
  assert.match(handoff, /prepareAtomicPurchaseCreation/);
  assert.match(handoff, /SELECT id FROM pmv2_material_request_items WHERE id = \$\{requestItemId\} FOR UPDATE/);
  assert.match(handoff, /يوجد طلب شراء مرتبط يغطي العجز الحالي؛ لا تنشئ طلب شراء مكررًا/);
});

test("Patch 121 creates Purchase rows and the PM V2 link in the same DB transaction", () => {
  assert.match(purchaseRouter, /pmv2RequestItemId: z\.number\(\)\.int\(\)\.positive\(\)\.optional\(\)/);
  assert.match(purchaseRouter, /db\.withTransaction\(async \(tx: any\) =>/);
  assert.match(purchaseRouter, /prepareAtomicPurchaseCreation\(tx/);
  assert.match(purchaseRouter, /db\.createPurchaseOrder\([\s\S]*?, tx\)/);
  assert.match(purchaseRouter, /db\.createPOItems\(itemsData, tx\)/);
  assert.match(purchaseRouter, /linkAtomicCreatedPurchase\(tx/);
  assert.match(handoff, /tx\.insert\(pmv2MaterialPurchaseLinks\)/);
  assert.match(handoff, /atomicPurchaseCreation: true/);
});

test("Patch 121 enforces one PM V2 item, Catalog identity, fixed shortage quantity, and active unit before creation", () => {
  assert.match(purchaseRouter, /طلب الشراء المرتبط بـ PM V2 يجب أن يحتوي على صنف واحد فقط/);
  assert.match(handoff, /بند طلب الشراء لا يطابق مادة PM V2/);
  assert.match(handoff, /expectedPurchaseQuantity = Math\.max\(1, Math\.ceil/);
  assert.match(handoff, /كمية طلب الشراء المرتبط بـ PM V2 يجب أن تكون/);
  assert.match(handoff, /validatePurchaseUnitForCatalogItem/);
});

test("Patch 121 removes the post-create client relink gap and keeps PM V2 out of the draft-only path", () => {
  assert.match(createPage, /pmv2RequestItemId: hasPmv2PurchaseContext \? pmv2RequestItemId : undefined/);
  assert.match(createPage, /تم الربط بـ PM V2 آليًا/);
  assert.doesNotMatch(createPage, /linkCreatedPurchaseToPmv2/);
  assert.doesNotMatch(createPage, /linkPmv2PurchaseMut/);
  assert.doesNotMatch(createPage, /purchaseOrders\.getById\.fetch/);
  assert.match(createPage, /!hasPmv2PurchaseContext && \(/);
});

test("Patch 121 removes manual PM V2 relink from Purchase details", () => {
  assert.match(detailPage, /طلب شراء مرتبط آليًا بعجز PM V2/);
  assert.match(detailPage, /لا توجد خطوة ربط يدوية/);
  assert.doesNotMatch(detailPage, /ربط \/ إعادة ربط PM V2/);
  assert.doesNotMatch(detailPage, /relinkPmv2PurchaseMut/);
});
