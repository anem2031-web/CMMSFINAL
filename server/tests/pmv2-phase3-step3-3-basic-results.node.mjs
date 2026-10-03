import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const execution = read("server/pmv2/technician/execution-service.ts");
const router = read("server/routers/pmv2/technician.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const workflow = read("docs/pmv2/04_WORKFLOWS.md");
const schema = read("drizzle/schema.ts");

test("Step 3.3 first slice reuses the frozen result/state schema without SQL", () => {
  assert.match(schema, /result: mysqlEnum\(\['ok','fixed','needs_material','needs_ticket'\]\)/);
  assert.match(schema, /status: mysqlEnum\(\['pending','in_progress','waiting_material','waiting_ticket','ready_to_complete','completed'\]\)/);
  assert.match(workflow, /ok\/fixed → completed/);
});

test("basic result submission is serialized per Task and rechecks active Team membership + exact ownership", () => {
  assert.match(execution, /submitBasicResult/);
  assert.match(execution, /SELECT id FROM pmv2_tasks WHERE id = \$\{input\.taskId\} FOR UPDATE/);
  assert.match(execution, /eq\(pmv2TeamMembers\.teamId, pmv2Tasks\.teamId\)/);
  assert.match(execution, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(execution, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(execution, /eq\(pmv2Tasks\.id, input\.taskId\)/);
  assert.match(execution, /eq\(pmv2TaskItems\.id, input\.taskItemId\)/);
});

test("only in-progress items can submit the ok/fixed slice while nonterminal Task summaries remain executable", () => {
  assert.match(execution, /isTaskOpenForResult\(row\.taskStatus as TaskStatus\)/);
  assert.match(execution, /row\.itemStatus !== "in_progress"/);
  assert.match(execution, /input\.result !== "ok" && input\.result !== "fixed"/);
  assert.match(router, /submitBasicResult:[\s\S]*result: z\.enum\(\["ok", "fixed"\]\)/);
});

test("result submission requires exactly one open Visit and can join the active technician to it", () => {
  assert.match(execution, /isNull\(pmv2Visits\.endedAt\)/);
  assert.match(execution, /if \(openVisits\.length !== 1\)/);
  assert.match(execution, /eq\(pmv2VisitMembers\.visitId, visitId\)/);
  assert.match(execution, /eq\(pmv2VisitMembers\.userId, userId\)/);
  assert.match(execution, /tx\.insert\(pmv2VisitMembers\)/);
});

test("ok/fixed completes the Item and stores an Item Action with optional note", () => {
  assert.match(execution, /status: "completed",\s*result: input\.result/);
  assert.match(execution, /action: "submit_result"/);
  assert.match(execution, /result: input\.result/);
  assert.match(execution, /note: normalizedNote/);
  assert.match(execution, /performedById: userId/);
  assert.match(router, /note: z\.string\(\)\.trim\(\)\.max\(2000\)\.optional\(\)/);
});

test("basic result reprojects cached Task state and preserves dependency summaries", () => {
  assert.match(execution, /function deriveTaskStatus/);
  assert.match(execution, /itemStatuses\.includes\("waiting_material"\)/);
  assert.match(execution, /itemStatuses\.includes\("waiting_ticket"\)/);
  assert.match(execution, /const taskStatus = deriveTaskStatus/);
  assert.match(execution, /update\(pmv2Tasks\)[\s\S]*set\(\{ status: taskStatus \}\)/);
});

test("result mutation writes PM V2 audit in the same transaction", () => {
  assert.match(execution, /writePmv2AuditWithDb\(tx,/);
  assert.match(execution, /action: "item_result_submitted"/);
  assert.match(execution, /entity: "task_item"/);
  assert.match(execution, /itemResult: input\.result/);
});

test("technician UI retains سليم and تم الإصلاح for in-progress items", () => {
  assert.match(page, /trpc\.pmv2\.technician\.submitBasicResult\.useMutation/);
  assert.match(page, /item\.status === "in_progress"/);
  assert.match(page, /result: "ok"/);
  assert.match(page, /result: "fixed"/);
  assert.match(page, />\s*سليم\s*</);
  assert.match(page, />\s*تم الإصلاح\s*</);
  assert.match(page, /ملاحظة التنفيذ \(اختياري\)/);
});

test("Visit ending is intentionally not introduced by this result slice", () => {
  const method = execution.split("async submitBasicResult", 2)[1]?.split("async submitDependencyResult", 1)[0] ?? "";
  assert.doesNotMatch(method, /update\(pmv2Visits\)[\s\S]*endedAt/);
});
