import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const execution = read("server/pmv2/technician/execution-service.ts");
const audit = read("server/pmv2/audit/service.ts");
const router = read("server/routers/pmv2/technician.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const workflow = read("docs/pmv2/04_WORKFLOWS.md");
const schema = read("drizzle/schema.ts");

test("Step 3.2 uses the already-existing Visit/Member/Item Action schema with no schema extension", () => {
  for (const name of ["pmv2Visits", "pmv2VisitMembers", "pmv2ItemActions"]) {
    assert.match(schema, new RegExp(`export const ${name} = mysqlTable`));
  }
  assert.match(workflow, /pending → in_progress/);
});

test("start mutation serializes writes per task and runs in one DB transaction", () => {
  assert.match(execution, /db\.transaction\(async \(tx: any\) =>/);
  assert.match(execution, /SELECT id FROM pmv2_tasks WHERE id = \$\{input\.taskId\} FOR UPDATE/);
});

test("start mutation rechecks active team membership and exact task-item ownership server-side", () => {
  assert.match(execution, /eq\(pmv2TeamMembers\.teamId, pmv2Tasks\.teamId\)/);
  assert.match(execution, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(execution, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(execution, /eq\(pmv2Tasks\.id, input\.taskId\)/);
  assert.match(execution, /eq\(pmv2TaskItems\.id, input\.taskItemId\)/);
  assert.match(execution, /Pmv2TechnicianAccessError/);
});

test("Step 3.2 start transition remains pending-item-only while later waiting summaries stay executable", () => {
  assert.match(execution, /row\.itemStatus !== "pending"/);
  assert.match(execution, /isTaskOpenForStart\(row\.taskStatus as TaskStatus\)/);
  assert.match(execution, /const nextTaskStatus = row\.taskStatus === "pending" \? "in_progress" : row\.taskStatus/);
});

test("one open Visit is reused; a new Visit creator is leader and later technicians join as members", () => {
  assert.match(execution, /isNull\(pmv2Visits\.endedAt\)/);
  assert.match(execution, /if \(openVisits\.length > 1\)/);
  assert.match(execution, /tx\.insert\(pmv2Visits\)/);
  assert.match(execution, /isLeader: 1/);
  assert.match(execution, /eq\(pmv2VisitMembers\.userId, userId\)/);
  assert.match(execution, /tx\.insert\(pmv2VisitMembers\)/);
  assert.match(execution, /isLeader: isLeader \? 1 : 0/);
});

test("starting an item mutates the Item to in_progress, updates a pending Task, and writes an Item Action", () => {
  assert.match(execution, /update\(pmv2TaskItems\)[\s\S]*status: "in_progress"/);
  assert.match(execution, /update\(pmv2Tasks\)[\s\S]*set\(\{ status: nextTaskStatus \}\)/);
  assert.match(execution, /tx\.insert\(pmv2ItemActions\)/);
  assert.match(execution, /action: "start_execution"/);
  assert.match(execution, /performedById: userId/);
});

test("PM V2 audit is committed through the same transaction without replacing the existing audit wrapper", () => {
  assert.match(audit, /writePmv2Audit\(event: Pmv2AuditEvent\)/);
  assert.match(audit, /createAuditLog\(buildPmv2AuditRecord\(event\)\)/);
  assert.match(audit, /writePmv2AuditWithDb/);
  assert.match(audit, /db\.insert\(auditLogs\)/);
  assert.match(execution, /writePmv2AuditWithDb\(tx,/);
  assert.match(execution, /action: "item_start_execution"/);
  assert.match(execution, /entity: "task_item"/);
  assert.match(router, /ipAddress: ctx\.req\.ip/);
  assert.match(router, /userAgent: ctx\.req\.headers\["user-agent"\]/);
});

test("technician router/UI expose only the scoped Start Execution action for pending items", () => {
  assert.match(router, /startItem: pmv2TechnicianProcedure/);
  assert.match(router, /taskItemId: z\.number\(\)\.int\(\)\.positive\(\)/);
  assert.match(router, /code: "NOT_FOUND"/);
  assert.match(router, /code: "BAD_REQUEST"/);
  assert.match(page, /trpc\.pmv2\.technician\.startItem\.useMutation/);
  assert.match(page, /item\.status === "pending"/);
  assert.match(page, /بدء التنفيذ/);
  assert.doesNotMatch(page, /submitResult\.useMutation|completeItem\.useMutation|materialRequest\.useMutation|ticket\.useMutation/);
});
