import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../client/src/pages/pmv2/Pmv2MyTasks.tsx", import.meta.url), "utf8");

test("Patch 113 uses the concise technician material submit label", () => {
  assert.match(page, /"تسجيل الاحتياج"/);
  assert.match(page, /"جارٍ تسجيل الاحتياج\.\.\."/);
  assert.doesNotMatch(page, /تحقق من التوفر وسجّل الاحتياج/);
});
