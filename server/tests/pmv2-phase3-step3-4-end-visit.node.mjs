import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const execution = read("server/pmv2/technician/execution-service.ts");
const readService = read("server/pmv2/technician/read-service.ts");
const audit = read("server/pmv2/audit/service.ts");
const router = read("server/routers/pmv2/technician.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const workflow = read("docs/pmv2/04_WORKFLOWS.md");
const schema = read("drizzle/schema.ts");

const endVisitMethod = execution.split("async endVisit", 2)[1]?.split("\n}\n\nexport const pmv2TechnicianExecutionService", 1)[0] ?? "";

test("Step 3.4 reuses the existing Visit endedAt field with no schema extension", () => {
  const block = schema.match(/export const pmv2Visits = mysqlTable\("pmv2_visits", \{[\s\S]*?\n\},\n\(table\)/)?.[0] ?? "";
  assert.match(block, /endedAt: timestamp\(\{ mode: 'string' \}\)/);
  assert.match(workflow, /Visit لا تغلق Task تلقائيًا/);
});

test("Visit-state read remains scoped to active Team membership and exposes Leader state", () => {
  const method = readService.split("async getVisitState", 2)[1]?.split("async listTaskItems", 1)[0] ?? "";
  assert.match(method, /eq\(pmv2TeamMembers\.teamId, pmv2Tasks\.teamId\)/);
  assert.match(method, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(method, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(method, /isNull\(pmv2Visits\.endedAt\)/);
  assert.match(method, /eq\(pmv2VisitMembers\.userId, userId\)/);
  assert.match(method, /isLeader:/);
  assert.match(router, /visitState: pmv2TechnicianProcedure/);
});

test("endVisit serializes by Task and rechecks active Team membership", () => {
  assert.match(endVisitMethod, /SELECT id FROM pmv2_tasks WHERE id = \$\{input\.taskId\} FOR UPDATE/);
  assert.match(endVisitMethod, /eq\(pmv2TeamMembers\.teamId, pmv2Tasks\.teamId\)/);
  assert.match(endVisitMethod, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(endVisitMethod, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(endVisitMethod, /where\(eq\(pmv2Tasks\.id, input\.taskId\)\)/);
});

test("exactly one open Visit is required and repeated ending is rejected", () => {
  assert.match(endVisitMethod, /isNull\(pmv2Visits\.endedAt\)/);
  assert.match(endVisitMethod, /if \(openVisits\.length !== 1\)/);
  assert.match(endVisitMethod, /لا توجد زيارة مفتوحة للمهمة/);
  assert.match(endVisitMethod, /توجد أكثر من زيارة مفتوحة للمهمة/);
});

test("only the recorded Visit Leader may end the Visit", () => {
  assert.match(endVisitMethod, /eq\(pmv2VisitMembers\.visitId, visit\.id\)/);
  assert.match(endVisitMethod, /eq\(pmv2VisitMembers\.userId, userId\)/);
  assert.match(endVisitMethod, /eq\(pmv2VisitMembers\.isLeader, 1\)/);
  assert.match(endVisitMethod, /Pmv2TechnicianLeaderRequiredError/);
  assert.match(router, /Pmv2TechnicianLeaderRequiredError/);
  assert.match(router, /code: "FORBIDDEN"/);
});

test("Visit cannot end while any Task Item remains in_progress", () => {
  assert.match(endVisitMethod, /eq\(pmv2TaskItems\.status, "in_progress"\)/);
  assert.match(endVisitMethod, /لا يمكن إنهاء الزيارة بينما يوجد بند قيد التنفيذ/);
});

test("ending sets endedAt and writes same-transaction Visit audit without forcing Task or Item state", () => {
  assert.match(endVisitMethod, /update\(pmv2Visits\)/);
  assert.match(endVisitMethod, /endedAt: sql`CURRENT_TIMESTAMP`/);
  assert.match(endVisitMethod, /writePmv2AuditWithDb\(tx,/);
  assert.match(endVisitMethod, /action: "visit_ended"/);
  assert.match(endVisitMethod, /entity: "visit"/);
  assert.match(audit, /\| "visit"/);
  assert.doesNotMatch(endVisitMethod, /update\(pmv2Tasks\)/);
  assert.doesNotMatch(endVisitMethod, /update\(pmv2TaskItems\)/);
});

test("technician router exposes scoped endVisit mutation with audit context", () => {
  assert.match(router, /endVisit: pmv2TechnicianProcedure/);
  assert.match(router, /taskId: z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(router, /pmv2TechnicianExecutionService\.endVisit\(ctx\.user\.id, input/);
  assert.match(router, /ipAddress: ctx\.req\.ip/);
  assert.match(router, /userAgent: ctx\.req\.headers\["user-agent"\]/);
});

test("My Tasks shows End Visit only for the open Visit Leader and blocks while an Item is active", () => {
  assert.match(page, /trpc\.pmv2\.technician\.visitState\.useQuery/);
  assert.match(page, /trpc\.pmv2\.technician\.endVisit\.useMutation/);
  assert.match(page, /visitStateQuery\.data\.isLeader/);
  assert.match(page, /hasInProgressItem/);
  assert.match(page, /إنهاء الزيارة/);
  assert.match(page, /سجّل نتيجة كل بند قيد التنفيذ قبل إنهاء الزيارة/);
});
