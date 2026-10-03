import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("Patch 126 renders WIS added materials as a fixed bordered grid", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  assert.match(page, /table-fixed border-collapse/);
  assert.match(page, /<colgroup>/);
  assert.match(page, /border border-border px-3 text-right font-semibold">المادة/);
  assert.match(page, /border border-border px-3 text-center font-semibold">اللوت/);
  assert.match(page, /border border-border px-3 py-3 align-middle whitespace-normal text-right/);
  assert.match(page, /flex flex-wrap items-center justify-center gap-1\.5/);
});

test("Patch 126 is UI-only and keeps WIS issue behavior unchanged", async () => {
  const page = await read("client/src/pages/inventory/WarehouseIssue.tsx");
  assert.match(page, /trpc\.warehouseIssueBatches\.create\.useMutation/);
  assert.match(page, /createBatchMut\.mutate\(/);
  assert.match(page, /اعتماد وصرف/);
  assert.match(page, /buildIssueCostAllocationPayload/);
});
