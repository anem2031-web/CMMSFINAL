import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Patch 125 auto-suggests issue cost target from ticket, PM V2, then purchase context", async () => {
  const source = await read("server/routers/inventory/warehouse-issue-batches.router.ts");
  assert.match(source, /resolveCostTargetSuggestion/);
  assert.match(source, /الأولوية: البلاغ > PM V2 > بيانات طلب الشراء/);
  assert.match(source, /ticketSiteId/);
  assert.match(source, /getPmv2WarehouseIssueContext/);
  assert.match(source, /purchaseSiteId/);
  assert.match(source, /costTargetSuggestion/);
});

test("Patch 125 keeps cost allocation editable but blocks missing site or section", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  const editor = await read("client/src/components/inventory/IssueCostAllocationEditor.tsx");
  assert.match(page, /createCostAllocationDraftsFromSuggestion/);
  assert.match(page, /يمكنك تعديل الموقع أو القسم أو الأصل يدويًا عند الحاجة/);
  assert.match(page, /buildIssueCostAllocationPayload\(costAllocationDrafts, qty\)/);
  assert.match(editor, /اختر الموقع المستفيد/);
  assert.match(editor, /اختر القسم المستفيد/);
});

test("Patch 125 reconciles WIS item model with the three manual production tables", async () => {
  const schema = await read("drizzle/schema.ts");
  const dbSource = await read("server/_core/db/warehouse-issues.ts");
  const sql = await read("drizzle/2026_09_21_warehouse_issue_batches.sql");
  assert.match(schema, /inventoryLotId: int\(\)\.notNull\(\)/);
  assert.match(schema, /referenceNumber: varchar\(\{ length: 100 \}\)/);
  assert.match(dbSource, /inventoryLotId: data\.inventoryLotId/);
  assert.match(dbSource, /referenceType: data\.referenceType/);
  assert.match(sql, /`inventoryLotId` int NOT NULL/);
  assert.match(sql, /`referenceType` varchar\(50\) DEFAULT NULL/);
  assert.doesNotMatch(sql, /fk_warehouse_issue_batch_items_batch/);
});

test("Patch 125 WIS print uses the generic reference snapshot", async () => {
  const print = await read("client/src/lib/printWarehouseIssueDocument.ts");
  assert.match(print, /referenceType\?: string/);
  assert.match(print, /item\.referenceType === "pmv2"/);
  assert.match(print, /item\.referenceNumber/);
});
