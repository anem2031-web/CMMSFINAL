import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const layout = read('client/src/components/layout/DashboardLayout.tsx');
const app = read('client/src/App.tsx');
const page = read('client/src/pages/pmv2/ScheduledMaintenance.tsx');
const router = read('server/routers/pmv2/index.ts');
const tasksRouter = read('server/routers/pmv2/tasks.ts');
const taskRead = read('server/pmv2/tasks/read-service.ts');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('adds a separate Scheduled Maintenance sidebar route without replacing Legacy PM', () => {
  assert.match(layout, /id: "scheduled-maintenance"/);
  assert.match(layout, /path: "\/scheduled-maintenance"/);
  assert.match(layout, /path: "\/preventive"/);
  assert.match(app, /Route path="\/scheduled-maintenance" component=\{ScheduledMaintenance\}/);
  assert.match(app, /Route path="\/preventive" component=\{PreventiveMaintenance\}/);
});

test('exposes the four Phase 1-2 management/test tabs', () => {
  for (const label of ['التخصصات والفرق','قوائم الصيانة','البرامج والأهداف','المهام المجدولة']) {
    assert.ok(page.includes(label), label);
  }
});

test('uses only PM V2 API namespace from the new page', () => {
  assert.match(page, /trpc\.pmv2\.organization/);
  assert.match(page, /trpc\.pmv2\.checklists/);
  assert.match(page, /trpc\.pmv2\.programs/);
  assert.match(page, /trpc\.pmv2\.scheduler/);
  assert.match(page, /trpc\.pmv2\.tasks/);
  assert.doesNotMatch(page, /trpc\.preventive|trpc\.ticket|trpc\.purchase|trpc\.inventory/);
});

test('task browser is read-only and registered under PM V2', () => {
  assert.match(router, /tasks: pmv2TasksRouter/);
  assert.match(tasksRouter, /pmv2ManagementProcedure/);
  assert.doesNotMatch(tasksRouter, /\.mutation\(/);
  assert.match(taskRead, /\.from\(pmv2Tasks\)/);
  assert.match(taskRead, /pmv2TaskItems/);
});

test('the UI labels PM V2 as Scheduled Maintenance in all nav languages', () => {
  assert.match(read('client/src/i18n/ar.ts'), /scheduledMaintenance: "الصيانة المجدولة"/);
  assert.match(read('client/src/i18n/en.ts'), /scheduledMaintenance: "Scheduled Maintenance"/);
  assert.match(read('client/src/i18n/ur.ts'), /scheduledMaintenance: "شیڈول شدہ دیکھ بھال"/);
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} passed`);
