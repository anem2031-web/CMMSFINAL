import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Patch 127 enriches WIS history/detail from the existing cost-allocation records without schema changes", async () => {
  const db = await read("server/_core/db/warehouse-issues.ts");
  assert.match(db, /inventoryIssueCostAllocations/);
  assert.match(db, /beneficiarySiteName: sites\.name/);
  assert.match(db, /beneficiarySectionName: sections\.name/);
  assert.match(db, /getWarehouseIssueCostTargetsForBatchIds/);
  assert.match(db, /summarizeWarehouseIssueCostTargets/);
  assert.match(db, /targetByTransactionId/);
});

test("Patch 127 WIS print shows location and department and preserves per-line target visibility", async () => {
  const print = await read("client/src/lib/printWarehouseIssueDocument.ts");
  assert.match(print, /beneficiarySiteName\?: string/);
  assert.match(print, /beneficiarySectionName\?: string/);
  assert.match(print, />الموقع<\/div>/);
  assert.match(print, />القسم<\/div>/);
  assert.match(print, /الموقع \/ القسم/);
});

test("Patch 127 adds a dedicated issue history tab with open and print actions", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  assert.match(page, /TabsTrigger value="history"/);
  assert.match(page, /سجل الصرف/);
  assert.match(page, /trpc\.warehouseIssueBatches\.list\.useQuery/);
  assert.match(page, /beneficiarySiteName/);
  assert.match(page, /beneficiarySectionName/);
  assert.match(page, /printHistoryDocument/);
  assert.match(page, /setHistoryDetailId/);
});

