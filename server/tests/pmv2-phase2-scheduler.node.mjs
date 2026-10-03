import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  buildPmv2TaskNumber,
  getRiyadhDateOnly,
} from "../pmv2/scheduler/utils.ts";

const root = process.cwd();
const service = fs.readFileSync(path.join(root, "server/pmv2/scheduler/engine.ts"), "utf8");
const repository = fs.readFileSync(path.join(root, "server/pmv2/scheduler/repository.ts"), "utf8");
const job = fs.readFileSync(path.join(root, "server/jobs/pmv2-scheduler.ts"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "server/_core/index.ts"), "utf8");
const router = fs.readFileSync(path.join(root, "server/routers/pmv2/scheduler.ts"), "utf8");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test("task number is deterministic for program target and due date", () => {
  assert.equal(buildPmv2TaskNumber("2026-09-08", 12, 34), "PMV2-20260908-P12-T34");
  assert.ok(buildPmv2TaskNumber("2026-09-08", 12, 34).length <= 50);
});

test("scheduler date uses Riyadh calendar day", () => {
  assert.equal(getRiyadhDateOnly(new Date("2026-09-08T22:30:00Z")), "2026-09-09");
});

test("scheduler uses recurrence and active program/specialty/team/checklist/item filters", () => {
  assert.match(service, /isPmv2RecurrenceDueOnDate/);
  assert.match(repository, /eq\(pmv2Programs\.isActive, 1\)/);
  assert.match(repository, /innerJoin\(pmv2Specialties, eq\(pmv2Specialties\.id, pmv2Teams\.specialtyId\)\)/);
  assert.match(repository, /eq\(pmv2Teams\.isActive, 1\)/);
  assert.match(repository, /eq\(pmv2Specialties\.isActive, 1\)/);
  assert.match(repository, /eq\(pmv2Checklists\.isActive, 1\)/);
  assert.match(repository, /eq\(pmv2ChecklistItems\.isActive, 1\)/);
});

test("task generation preserves team and checklist-item snapshots", () => {
  assert.match(service, /teamId: program\.teamId/);
  assert.match(service, /titleSnapshot: item\.title/);
  assert.match(service, /sortOrderSnapshot: item\.sortOrder/);
  assert.match(service, /sourceChecklistItemId: item\.id/);
});

test("reruns are idempotent and repair partially generated task items", () => {
  assert.match(repository, /getOrCreateTask/);
  assert.match(repository, /ensureTaskItem/);
  assert.match(repository, /ER_DUP_ENTRY/);
  assert.match(service, /existingTasks/);
});


test("scheduler revalidates external targets and blocks dates before program creation", () => {
  assert.match(service, /targetAdapter\.validateTarget/);
  assert.match(service, /programStartDate/);
  assert.match(service, /if \(date < programStartDate\) return \[\]/);
});

test("scheduler is independent from legacy PM job and guarded against overlap", () => {
  assert.match(job, /pmv2SchedulerRunning/);
  assert.doesNotMatch(job, /runPMAutomationJob|preventivePlans|pmWorkOrders/);
  assert.match(bootstrap, /runPmv2SchedulerJob/);
  assert.match(bootstrap, /PMV2_ONE_HOUR/);
  assert.match(router, /pmv2ManagementProcedure/);
});

console.log(`PM V2 Phase 2 scheduler contract: ${passed}/7 PASS`);
