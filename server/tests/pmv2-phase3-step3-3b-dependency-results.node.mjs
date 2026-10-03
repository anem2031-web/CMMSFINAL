import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const execution = read("server/pmv2/technician/execution-service.ts");
const router = read("server/routers/pmv2/technician.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");
const workflow = read("docs/pmv2/04_WORKFLOWS.md");
const schema = read("drizzle/schema.ts");

test("Step 3.3B reuses frozen dependency result and waiting-state schema without SQL", () => {
  assert.match(schema, /result: mysqlEnum\(\['ok','fixed','needs_material','needs_ticket'\]\)/);
  assert.match(schema, /status: mysqlEnum\(\['pending','in_progress','waiting_material','waiting_ticket','ready_to_complete','completed'\]\)/);
  assert.match(workflow, /needs_material → waiting_material/);
  assert.match(workflow, /needs_ticket → waiting_ticket/);
});

test("dependency result submission is serialized per Task and rechecks active Team membership + exact ownership", () => {
  assert.match(execution, /submitDependencyResult/);
  assert.match(execution, /SELECT id FROM pmv2_tasks WHERE id = \$\{input\.taskId\} FOR UPDATE/);
  assert.match(execution, /eq\(pmv2TeamMembers\.teamId, pmv2Tasks\.teamId\)/);
  assert.match(execution, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(execution, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(execution, /eq\(pmv2Tasks\.id, input\.taskId\)/);
  assert.match(execution, /eq\(pmv2TaskItems\.id, input\.taskItemId\)/);
});

test("dependency results are allowed only from an in-progress Item and only for needs_material/needs_ticket", () => {
  assert.match(execution, /row\.itemStatus !== "in_progress"/);
  assert.match(execution, /input\.result !== "needs_material" && input\.result !== "needs_ticket"/);
  assert.match(router, /submitDependencyResult:[\s\S]*result: z\.enum\(\["needs_material", "needs_ticket"\]\)/);
  assert.match(router, /note: z\.string\(\)\.trim\(\)\.max\(2000\)\.optional\(\)/);
});

test("dependency result requires exactly one open Visit and may join the active technician", () => {
  const method = execution.split("async submitDependencyResult", 2)[1] ?? "";
  assert.match(method, /isNull\(pmv2Visits\.endedAt\)/);
  assert.match(method, /if \(openVisits\.length !== 1\)/);
  assert.match(method, /eq\(pmv2VisitMembers\.visitId, visitId\)/);
  assert.match(method, /eq\(pmv2VisitMembers\.userId, userId\)/);
  assert.match(method, /tx\.insert\(pmv2VisitMembers\)/);
});

test("needs_material and needs_ticket map to their frozen Task Item waiting states", () => {
  assert.match(execution, /input\.result === "needs_material"[\s\S]*\? "waiting_material"[\s\S]*: "waiting_ticket"/);
  assert.match(execution, /status: itemStatus,[\s\S]*result: input\.result/);
  assert.match(execution, /eq\(pmv2TaskItems\.status, "in_progress"\)/);
});

test("dependency result writes the standard submit_result Item Action and PM V2 audit atomically", () => {
  const method = execution.split("async submitDependencyResult", 2)[1] ?? "";
  assert.match(method, /tx\.insert\(pmv2ItemActions\)/);
  assert.match(method, /action: "submit_result"/);
  assert.match(method, /result: input\.result/);
  assert.match(method, /note: normalizedNote/);
  assert.match(method, /performedById: userId/);
  assert.match(method, /writePmv2AuditWithDb\(tx,/);
  assert.match(method, /action: "item_result_submitted"/);
  assert.match(method, /externalIntegrationCreated: false/);
});

test("Task cached projection uses fixed material-before-ticket dependency priority", () => {
  const material = execution.indexOf('itemStatuses.includes("waiting_material")');
  const ticket = execution.indexOf('itemStatuses.includes("waiting_ticket")');
  const progress = execution.indexOf('itemStatuses.includes("in_progress")');
  const ready = execution.indexOf('itemStatuses.includes("ready_to_complete")');
  assert.ok(material >= 0 && ticket > material && progress > ticket && ready > progress);
  assert.match(execution, /itemStatuses\.every\(status => status === "completed"\)/);
});

test("Task remains executable while another Item makes the summary waiting_material/waiting_ticket", () => {
  assert.match(execution, /function isTaskOpenForStart\(status: TaskStatus\)[\s\S]*status !== "completed" && status !== "cancelled"/);
  assert.match(execution, /function isTaskOpenForResult\(status: TaskStatus\)[\s\S]*status !== "pending" && status !== "completed" && status !== "cancelled"/);
  assert.match(execution, /const nextTaskStatus = row\.taskStatus === "pending" \? "in_progress" : row\.taskStatus/);
});

test("basic ok/fixed results now reproject around existing dependency states instead of erasing them", () => {
  const method = execution.split("async submitBasicResult", 2)[1]?.split("async submitDependencyResult", 1)[0] ?? "";
  assert.match(method, /const taskStatus = deriveTaskStatus/);
  assert.doesNotMatch(method, /remainingItems\[0\] \? "in_progress" : "completed"/);
});

test("technician UI exposes all four frozen Core result choices only while Item is in_progress", () => {
  assert.match(page, /item\.status === "in_progress"/);
  assert.match(page, /trpc\.pmv2\.technician\.submitDependencyResult\.useMutation/);
  assert.match(page, /result: "needs_material"/);
  assert.match(page, /result: "needs_ticket"/);
  assert.match(page, />\s*تحتاج مواد\s*</);
  assert.match(page, />\s*تحتاج بلاغ صيانة\s*</);
  assert.match(page, /resultMutationPending/);
});

test("Step 3.3B does not create Material Requests, Tickets, Inventory movements, or end the Visit", () => {
  const method = execution.split("async submitDependencyResult", 2)[1]?.split("async endVisit", 1)[0] ?? "";
  assert.doesNotMatch(method, /pmv2MaterialRequests|pmv2TaskTicketLinks|inventory|purchase|ticketId|endedAt\s*:/i);
  assert.match(method, /externalIntegrationCreated: false/);
});
