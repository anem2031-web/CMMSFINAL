import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Patch 129 allows the same lot on different cost targets in the UI", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  assert.match(page, /const sameLotLines = lines\.filter/);
  assert.match(page, /existingTarget\.beneficiarySiteId === newTarget\.beneficiarySiteId/);
  assert.match(page, /existingTarget\.beneficiarySectionId === newTarget\.beneficiarySectionId/);
  assert.match(page, /beneficiaryAssetId \?\? null/);
  assert.match(page, /هذا اللوت مضاف بالفعل لنفس الموقع والقسم والأصل/);
  assert.doesNotMatch(page, /هذا اللوت مضاف بالفعل؛ احذف السطر ثم أضفه بالكمية الصحيحة/);
});

test("Patch 129 protects aggregate requested quantity for repeated lot lines", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  const router = await read("server/routers/inventory/warehouse-issue-batches.router.ts");
  assert.match(page, /const alreadyReserved = sameLotLines\.reduce/);
  assert.match(page, /إجمالي الكمية المطلوبة من الدفعة/);
  assert.match(router, /const requestedQuantityByLot = new Map<string, number>\(\)/);
  assert.match(router, /requestedQuantity > Number\(lot\.lotBalanceQuantity \|\| 0\)/);
});

test("Patch 129 backend treats lot plus site section asset as the duplicate key", async () => {
  const router = await read("server/routers/inventory/warehouse-issue-batches.router.ts");
  assert.match(router, /const duplicateCostTargetKeys = new Set<string>\(\)/);
  assert.match(router, /const costTargetKey = `\$\{lotKey\}:\$\{allocation\.beneficiarySiteId\}:\$\{allocation\.beneficiarySectionId\}:\$\{allocation\.beneficiaryAssetId \?\? 0\}`/);
  assert.match(router, /duplicateCostTargetKeys\.has\(costTargetKey\)/);
});

test("Patch 129 keeps one purchase item delivery transition when a lot is split across targets", async () => {
  const router = await read("server/routers/inventory/warehouse-issue-batches.router.ts");
  assert.match(router, /const purchaseItemsMarkedDelivered = new Set<number>\(\)/);
  assert.match(router, /const markPurchaseOrderItemDelivered = !!purchaseOrderItemId && !purchaseItemsMarkedDelivered\.has\(purchaseOrderItemId\)/);
  assert.match(router, /markPurchaseOrderItemDelivered,/);
});

test("Patch 129 shows the beneficiary target on each WIS draft row", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  assert.match(page, /الجهة المستفيدة/);
  assert.match(page, /siteNames\.get/);
  assert.match(page, /sectionNames\.get/);
  assert.match(page, /assetNames\.get/);
  assert.match(page, /key=\{`\$\{line\.inventoryId\}-\$\{line\.lotId\}-\$\{index\}`\}/);
});
