import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Patch 128 names WIS screen as multi-item warehouse issue", async () => {
  const ar = await read("client/src/i18n/ar.ts");
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  assert.match(ar, /warehouseIssue: "الصرف المخزني المتعدد"/);
  assert.match(page, /الصرف المخزني المتعدد/);
  assert.match(page, /مخصص لصرف مادتين أو أكثر/);
});

test("Patch 128 prevents creating WIS with fewer than two lines in UI and backend", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  const router = await read("server/routers/inventory/warehouse-issue-batches.router.ts");
  assert.match(page, /if \(lines\.length < 2\)/);
  assert.match(page, /disabled=\{createBatchMut\.isPending \|\| lines\.length < 2\}/);
  assert.match(page, /الصرف المخزني المتعدد يتطلب إضافة مادتين على الأقل/);
  assert.match(router, /z\.array\(lineSchema\)\.min\(2, "الصرف المخزني المتعدد يتطلب مادتين على الأقل"\)/);
});

test("Patch 128 keeps existing WIS issue engine and history behavior unchanged", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  const router = await read("server/routers/inventory/warehouse-issue-batches.router.ts");
  assert.match(page, /trpc\.warehouseIssueBatches\.create\.useMutation/);
  assert.match(page, /TabsTrigger value="history"/);
  assert.match(router, /await db\.issueDelivery\([\s\S]*?\}, tx\)/);
  assert.match(router, /transactionResult = await database\.transaction/);
});
