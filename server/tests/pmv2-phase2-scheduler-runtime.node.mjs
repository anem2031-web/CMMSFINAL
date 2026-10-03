import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript");
const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pmv2-scheduler-runtime-"));

function compile(sourceRel, outName, rewrites = []) {
  const source = fs.readFileSync(path.join(root, sourceRel), "utf8");
  let js = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  for (const [from, to] of rewrites) js = js.replaceAll(from, to);
  fs.writeFileSync(path.join(temp, outName), js);
}

compile("server/pmv2/checklists/schedule-config.ts", "schedule-config.mjs");
compile("server/pmv2/checklists/validation.ts", "validation.mjs", [
  ['"./schedule-config"', '"./schedule-config.mjs"'],
]);
compile("server/pmv2/checklists/recurrence.ts", "recurrence.mjs", [
  ['"./validation"', '"./validation.mjs"'],
  ['"./schedule-config"', '"./schedule-config.mjs"'],
]);
compile("server/pmv2/scheduler/engine.ts", "engine.mjs", [
  ['"../checklists/recurrence"', '"./recurrence.mjs"'],
  ['"../checklists/validation"', '"./validation.mjs"'],
  ['"../checklists/schedule-config"', '"./schedule-config.mjs"'],
]);

const { Pmv2SchedulerEngine } = await import(pathToFileURL(path.join(temp, "engine.mjs")).href);

class FakeRepository {
  programs = [{ id: 1, teamId: 7, checklistId: 10, createdAt: "2026-09-01 08:00:00" }];
  items = [
    { id: 100, checklistId: 10, title: "فحص الفلتر", sortOrder: 1, isRequired: 1, isActive: 1, frequency: "daily", frequencyValue: null, weekday: null, monthDay: null, anchorDate: null },
    { id: 101, checklistId: 10, title: "فحص الضغط", sortOrder: 2, isRequired: 1, isActive: 1, frequency: "daily", frequencyValue: null, weekday: null, monthDay: null, anchorDate: null },
  ];
  targets = [
    { id: 201, siteId: 11, sectionId: null, assetId: null },
    { id: 202, siteId: null, sectionId: 22, assetId: null },
  ];
  taskSeq = 1;
  tasks = new Map();
  taskItems = new Map();

  async listActivePrograms() { return this.programs; }
  async listActiveChecklistItems(checklistId) { return this.items.filter(i => i.checklistId === checklistId && i.isActive === 1); }
  async listProgramTargets(programId) { return programId === 1 ? this.targets : []; }
  async getOrCreateTask(input) {
    const key = `${input.programId}:${input.programTargetId}:${input.dueDate}`;
    if (this.tasks.has(key)) return { id: this.tasks.get(key).id, created: false };
    const task = { id: this.taskSeq++, ...input };
    this.tasks.set(key, task);
    return { id: task.id, created: true };
  }
  async ensureTaskItem(input) {
    const key = `${input.taskId}:${input.sourceChecklistItemId}:${input.scheduledDate}`;
    if (this.taskItems.has(key)) return false;
    this.taskItems.set(key, { ...input });
    return true;
  }
}

const targetAdapter = {
  async listSites() { return []; },
  async listSections() { return []; },
  async listAssets() { return []; },
  async validateTarget() { return true; },
};

let passed = 0;
async function test(name, fn) {
  await fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

await test("first scheduler run creates one task per target and groups due items", async () => {
  const repo = new FakeRepository();
  const engine = new Pmv2SchedulerEngine(repo, targetAdapter);
  const result = await engine.runForDate("2026-09-08");
  assert.deepEqual(
    { createdTasks: result.createdTasks, existingTasks: result.existingTasks, createdTaskItems: result.createdTaskItems, errors: result.errors.length },
    { createdTasks: 2, existingTasks: 0, createdTaskItems: 4, errors: 0 },
  );
  assert.equal(repo.tasks.size, 2);
  assert.equal(repo.taskItems.size, 4);
});

await test("second scheduler run is idempotent and creates no duplicates", async () => {
  const repo = new FakeRepository();
  const engine = new Pmv2SchedulerEngine(repo, targetAdapter);
  await engine.runForDate("2026-09-08");
  const second = await engine.runForDate("2026-09-08");
  assert.equal(second.createdTasks, 0);
  assert.equal(second.existingTasks, 2);
  assert.equal(second.createdTaskItems, 0);
  assert.equal(repo.tasks.size, 2);
  assert.equal(repo.taskItems.size, 4);
});

await test("task and item snapshots preserve team, title and order", async () => {
  const repo = new FakeRepository();
  const engine = new Pmv2SchedulerEngine(repo, targetAdapter);
  await engine.runForDate("2026-09-08");
  const task = [...repo.tasks.values()][0];
  assert.equal(task.teamId, 7);
  const items = [...repo.taskItems.values()].filter(i => i.taskId === task.id);
  assert.deepEqual(items.map(i => [i.titleSnapshot, i.sortOrderSnapshot]), [["فحص الفلتر", 1], ["فحص الضغط", 2]]);
  assert.deepEqual(
    items.map(i => [i.frequencySnapshot, i.frequencyValueSnapshot, i.weekdaySnapshot, i.monthDaySnapshot, i.anchorDateSnapshot]),
    [["daily", null, null, null, null], ["daily", null, null, null, null]],
  );
});

await test("scheduler does not generate before program creation date", async () => {
  const repo = new FakeRepository();
  const engine = new Pmv2SchedulerEngine(repo, targetAdapter);
  const result = await engine.runForDate("2026-08-31");
  assert.equal(result.createdTasks, 0);
  assert.equal(repo.tasks.size, 0);
});

await test("invalid current target is skipped rather than becoming an orphan task", async () => {
  const repo = new FakeRepository();
  const adapter = { ...targetAdapter, async validateTarget(target) { return target.type !== "section"; } };
  const engine = new Pmv2SchedulerEngine(repo, adapter);
  const result = await engine.runForDate("2026-09-08");
  assert.equal(result.createdTasks, 1);
  assert.equal(result.errors.length, 1);
  assert.equal(repo.tasks.size, 1);
});

console.log(`PM V2 Phase 2 scheduler runtime simulation: ${passed}/5 PASS`);
