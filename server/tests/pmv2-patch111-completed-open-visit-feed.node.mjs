import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const service = read("server/pmv2/technician/read-service.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const execution = read("server/pmv2/technician/execution-service.ts");

test("Patch 111 keeps a completed carry-over task visible while its Visit is still open", () => {
  const method = service.match(/async listTodayTasks\([\s\S]*?\n  }\n\n  async getVisitState/)?.[0] ?? "";
  assert.match(method, /lte\(pmv2Tasks\.dueDate, date\)/);
  assert.match(method, /ne\(pmv2Tasks\.status, "cancelled"\)/);
  assert.match(method, /sql<boolean>`exists \(/);
  assert.match(method, /pmv2Visits\.taskId/);
  assert.match(method, /pmv2Visits\.endedAt/);
  assert.match(method, /is null/);
});

test("Patch 111 keeps explicit Visit closure separate from Task completion", () => {
  const endVisitMethod = execution.split("async endVisit", 2)[1]?.split("\n}\n\nexport const pmv2TechnicianExecutionService", 1)[0] ?? "";
  assert.match(endVisitMethod, /update\(pmv2Visits\)/);
  assert.doesNotMatch(endVisitMethod, /update\(pmv2Tasks\)/);
  assert.match(page, /إنهاء الزيارة/);
});

test("Patch 111 gives the technician a simple completed-but-open Visit cue", () => {
  assert.match(page, /اكتملت جميع البنود — الزيارة ما زالت مفتوحة/);
  assert.match(page, /أنهِ الزيارة عند مغادرة الموقع/);
  assert.match(page, /بانتظار قائد الزيارة لإنهائها/);
});
