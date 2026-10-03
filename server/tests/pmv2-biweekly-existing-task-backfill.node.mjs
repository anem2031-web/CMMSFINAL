import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript");
const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pmv2-biweekly-existing-task-"));

function compile(sourceRel, outName, rewrites = []) {
  const source = fs.readFileSync(path.join(root, sourceRel), "utf8");
  let js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  for (const [from, to] of rewrites) js = js.replaceAll(from, to);
  fs.writeFileSync(path.join(temp, outName), js);
}

compile("server/pmv2/checklists/validation.ts", "validation.mjs");
compile("server/pmv2/checklists/recurrence.ts", "recurrence.mjs");
compile("server/pmv2/scheduler/engine.ts", "engine.mjs", [
  ['"../checklists/recurrence"', '"./recurrence.mjs"'],
  ['"../checklists/validation"', '"./validation.mjs"'],
]);
const { Pmv2SchedulerEngine } = await import(pathToFileURL(path.join(temp, "engine.mjs")).href);

class FakeRepository {
  programs = [{ id: 1, teamId: 1, checklistId: 1, createdAt: "2026-09-08 08:00:00" }];
  items = [
    { id: 1, checklistId: 1, title: "فحص الفلتر", sortOrder: 1, isRequired: 1, isActive: 1, frequency: "daily", frequencyValue: null, weekday: null, monthDay: null, anchorDate: null },
    { id: 2, checklistId: 1, title: "فحص التسريب", sortOrder: 2, isRequired: 1, isActive: 1, frequency: "daily", frequencyValue: null, weekday: null, monthDay: null, anchorDate: null },
    { id: 3, checklistId: 1, title: "فحص درجة الحرارة", sortOrder: 3, isRequired: 1, isActive: 1, frequency: "daily", frequencyValue: null, weekday: null, monthDay: null, anchorDate: null },
  ];
  targets = [
    { id: 1, siteId: null, sectionId: null, assetId: 100 },
    { id: 2, siteId: null, sectionId: null, assetId: 200 },
  ];
  tasks = new Map();
  taskItems = new Map();
  taskSeq = 1;

  async listActivePrograms() { return this.programs; }
  async listActiveChecklistItems() { return this.items.filter(item => item.isActive === 1); }
  async listProgramTargets() { return this.targets; }
  async getOrCreateTask(input) {
    const key = `${input.programId}:${input.programTargetId}:${input.dueDate}`;
    if (this.tasks.has(key)) return { id: this.tasks.get(key), created: false };
    const id = this.taskSeq++;
    this.tasks.set(key, id);
    return { id, created: true };
  }
  async ensureTaskItem(input) {
    const key = `${input.taskId}:${input.sourceChecklistItemId}:${input.scheduledDate}`;
    if (this.taskItems.has(key)) return false;
    this.taskItems.set(key, { ...input });
    return true;
  }
}

const targetAdapter = { async validateTarget() { return true; } };
const repo = new FakeRepository();
const engine = new Pmv2SchedulerEngine(repo, targetAdapter);

// Historical tasks already existed before the biweekly item was created.
const first = await engine.runForDate("2026-09-21");
assert.deepEqual(
  { createdTasks: first.createdTasks, existingTasks: first.existingTasks, createdTaskItems: first.createdTaskItems, errors: first.errors.length },
  { createdTasks: 2, existingTasks: 0, createdTaskItems: 6, errors: 0 },
);

// Add exactly the item used in manual acceptance: every 2 weeks, Monday, anchor 2026-06-01.
repo.items.push({
  id: 11,
  checklistId: 1,
  title: "فحص كل أسبوعين",
  sortOrder: 11,
  isRequired: 1,
  isActive: 1,
  frequency: "weekly",
  frequencyValue: 2,
  weekday: 1,
  monthDay: null,
  anchorDate: "2026-06-01",
});

const rerunDue = await engine.runForDate("2026-09-21");
assert.deepEqual(
  { createdTasks: rerunDue.createdTasks, existingTasks: rerunDue.existingTasks, createdTaskItems: rerunDue.createdTaskItems, errors: rerunDue.errors.length },
  { createdTasks: 0, existingTasks: 2, createdTaskItems: 2, errors: 0 },
);
assert.equal(
  [...repo.taskItems.values()].filter(item => item.sourceChecklistItemId === 11).length,
  2,
  "due rerun must backfill the biweekly item into both existing tasks",
);

const beforeNonDueBiweekly = [...repo.taskItems.values()].filter(item => item.sourceChecklistItemId === 11).length;
const nonDue = await engine.runForDate("2026-09-14");
assert.equal(nonDue.errors.length, 0);
assert.equal(
  [...repo.taskItems.values()].filter(item => item.sourceChecklistItemId === 11).length,
  beforeNonDueBiweekly,
  "non-due week must not create the biweekly item",
);

console.log("PM V2 biweekly existing-task runtime regression: 2/2 PASS");
