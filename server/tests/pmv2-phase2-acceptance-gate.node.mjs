import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isPmv2RecurrenceDueOnDate } from "../pmv2/checklists/recurrence.ts";

const root = process.cwd();
const scheduler = fs.readFileSync(path.join(root, "server/pmv2/scheduler/engine.ts"), "utf8");
const schedulerRepo = fs.readFileSync(path.join(root, "server/pmv2/scheduler/repository.ts"), "utf8");
const programService = fs.readFileSync(path.join(root, "server/pmv2/programs/service.ts"), "utf8");
const job = fs.readFileSync(path.join(root, "server/jobs/pmv2-scheduler.ts"), "utf8");
const taskSql = fs.readFileSync(path.join(root, "drizzle/2026_09_08_pmv2_tasks.sql"), "utf8");
const taskItemSql = fs.readFileSync(path.join(root, "drizzle/2026_09_08_pmv2_task_items.sql"), "utf8");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test("all six recurrence families produce expected due examples", () => {
  const examples = [
    [{ frequency: "daily", frequencyValue: null, weekday: null, monthDay: null, anchorDate: null }, "2026-09-08"],
    [{ frequency: "weekly", frequencyValue: null, weekday: 1, monthDay: null, anchorDate: null }, "2026-09-07"],
    [{ frequency: "monthly", frequencyValue: null, weekday: null, monthDay: 8, anchorDate: null }, "2026-09-08"],
    [{ frequency: "quarterly", frequencyValue: null, weekday: null, monthDay: null, anchorDate: "2026-03-08" }, "2026-09-08"],
    [{ frequency: "biannual", frequencyValue: null, weekday: null, monthDay: null, anchorDate: "2026-03-08" }, "2026-09-08"],
    [{ frequency: "annual", frequencyValue: null, weekday: null, monthDay: null, anchorDate: "2025-09-08" }, "2026-09-08"],
  ];
  for (const [config, date] of examples) {
    assert.equal(isPmv2RecurrenceDueOnDate(config, date), true);
  }
});

test("disabled checklist items never become due", () => {
  assert.equal(
    isPmv2RecurrenceDueOnDate(
      { frequency: "daily", frequencyValue: null, weekday: null, monthDay: null, anchorDate: null, isActive: false },
      "2026-09-08",
    ),
    false,
  );
});

test("programs validate current targets and do not own external master data", () => {
  assert.match(programService, /targetAdapter\.validateTarget/);
  assert.doesNotMatch(programService, /insert\(sites\)|insert\(sections\)|insert\(assets\)/);
});

test("DB and scheduler jointly enforce idempotent task generation", () => {
  assert.match(taskSql, /UNIQUE KEY `uq_pmv2_tasks_generation`/);
  assert.match(taskItemSql, /UNIQUE KEY `uq_pmv2_task_items_generation`/);
  assert.match(schedulerRepo, /ER_DUP_ENTRY/);
  assert.match(schedulerRepo, /getOrCreateTask/);
  assert.match(schedulerRepo, /ensureTaskItem/);
});

test("generated tasks preserve required operational snapshots", () => {
  assert.match(scheduler, /teamId: program\.teamId/);
  assert.match(scheduler, /titleSnapshot: item\.title/);
  assert.match(scheduler, /sortOrderSnapshot: item\.sortOrder/);
  assert.match(scheduler, /sourceChecklistItemId: item\.id/);
});

test("PM V2 scheduler remains independent from Legacy PM automation", () => {
  assert.doesNotMatch(job, /preventivePlans|pmWorkOrders|runPMAutomationJob|pmSubPlans/);
  assert.match(job, /pmv2SchedulerService\.runForDate/);
});

console.log(`PM V2 Phase 2 standalone acceptance gate: ${passed}/6 PASS`);
