import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const page = read('client/src/pages/pmv2/ScheduledMaintenance.tsx');
const router = read('server/routers/pmv2/tasks.ts');
const taskRead = read('server/pmv2/tasks/read-service.ts');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('opens Scheduled Maintenance on tasks first', () => {
  assert.match(page, /const \[activeTab, setActiveTab\] = useState\("tasks"\)/);
  assert.match(page, /<Tabs value=\{activeTab\} onValueChange=\{changeMainTab\}/);
  const tabsBlock = page.slice(page.indexOf('<TabsList'), page.indexOf('</TabsList>'));
  assert.ok(tabsBlock.indexOf('value="tasks"') < tabsBlock.indexOf('value="programs"'));
});

test('adds six manager workload cards including all tasks', () => {
  for (const label of ['كل المهام', 'مهام اليوم', 'المتأخرة', 'غدًا', 'هذا الأسبوع', 'الأسبوع القادم']) {
    assert.ok(page.includes(label), label);
  }
});


test('keeps today as the default scope while all tasks has no date restriction', () => {
  assert.match(page, /useState<"all" \| "today"[\s\S]*?>\("today"\)/);
  assert.match(page, /if \(selectedScope === "all"\) return \{\};/);
  assert.match(page, /const allCount = trpc\.pmv2\.tasks\.list\.useQuery\(\{ page: 1, pageSize: 1 \}\)/);
});

test('uses dynamic active PM V2 teams in task filtering', () => {
  assert.match(page, /organization\.teams\.list\.useQuery/);
  assert.match(page, /Number\(team\.isActive\) === 1/);
  assert.match(page, /<option value="">كل الفرق<\/option>/);
});

test('task list supports server-side search, team, date and pagination', () => {
  for (const token of ['pageSize', 'search', 'teamId', 'dateFrom', 'dateTo', 'overdueBefore', 'excludeFinished']) {
    assert.ok(router.includes(token), token);
  }
  assert.match(taskRead, /\.offset\(offset\)/);
  assert.match(taskRead, /count\(\*\)/);
  assert.match(taskRead, /notInArray\(pmv2Tasks\.status/);
});

test('management tabs keep simple search/status filters and pagination', () => {
  for (const token of ['specialtySearch', 'teamSearch', 'checklistSearch', 'programSearch', 'SimplePager']) {
    assert.ok(page.includes(token), token);
  }
  assert.match(page, /programTeamFilter/);
});

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed++; console.log(`PASS ${name}`); }
  catch (error) { console.error(`FAIL ${name}`); console.error(error); process.exitCode = 1; }
}
console.log(`${passed}/${tests.length} passed`);
