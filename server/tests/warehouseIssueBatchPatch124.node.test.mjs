import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Patch 124 keeps legacy issueDelivery default path while allowing an outer transaction", async () => {
  const source = await read("server/_core/db/warehouse-returns.ts");
  assert.match(source, /export async function issueDelivery\([\s\S]*?\}, existingTx\?: any\)/);
  assert.match(source, /const result = existingTx\s*\? await executeIssue\(existingTx\)\s*:\s*await db\.transaction\(executeIssue\)/);
});

test("Patch 124 creates all WIS issue lines inside one outer transaction", async () => {
  const source = await read("server/routers/inventory/warehouse-issue-batches.router.ts");
  assert.match(source, /transactionResult = await database\.transaction\(async \(tx: any\) =>/);
  assert.match(source, /await db\.issueDelivery\([\s\S]*?\}, tx\)/);
  assert.match(source, /await db\.createWarehouseIssueBatchItem\([\s\S]*?\}, tx\)/);
  assert.match(source, /if \(duplicateCostTargetKeys\.has\(costTargetKey\)\)/);
  assert.match(source, /requestedQuantityByLot/);
  assert.match(source, /sourcePoNumber/);
});

test("Patch 124/125 schema keeps WIS as a grouping layer without external physical FKs", async () => {
  const schema = await read("drizzle/schema.ts");
  const block = schema.slice(
    schema.indexOf('export const warehouseIssueBatches'),
    schema.indexOf('export const externalMaintenanceJobs'),
  );
  assert.match(block, /warehouse_issue_batches/);
  assert.match(block, /warehouse_issue_batch_items/);
  assert.match(block, /warehouse_issue_batch_number_counter/);
  assert.match(block, /batchId: int\(\)\.notNull\(\)/);
  assert.match(block, /inventoryLotId: int\(\)\.notNull\(\)/);
  assert.match(block, /referenceType: varchar/);
  assert.doesNotMatch(block, /deliveryDocumentId:[^\n]*references/);
  assert.doesNotMatch(block, /inventoryId:[^\n]*references/);
  assert.doesNotMatch(block, /inventoryLotId:[^\n]*references/);
});

test("Patch 124 UI requires a source warehouse and provides multi-lot add flow", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  assert.match(page, /المخزن المصدر \*/);
  assert.match(page, /الفني المستلم \*/);
  assert.match(page, /إضافة مادة/);
  assert.match(page, /QR الدفعة \/ رقم اللوت \*/);
  assert.match(page, /اعتماد وصرف/);
  assert.match(page, /حد أقصى \{MAX_LINES\} بندًا/);
});

test("Patch 124 exposes WIS in Documents Center", async () => {
  const docs = await read("client/src/pages/DocumentsCenter.tsx");
  assert.match(docs, /warehouse_issue/);
  assert.match(docs, /سند صرف مخزني/);
  assert.match(docs, /warehouseIssueBatches\.getById/);
  assert.match(docs, /buildWarehouseIssueHtml/);
});
