import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');
const readService = fs.readFileSync('server/pmv2/tasks/read-service.ts', 'utf8');

test('same-day range uses exact DATE equality on task dueDate', () => {
  assert.match(readService, /filters\.dateFrom && filters\.dateTo && filters\.dateFrom === filters\.dateTo/);
  assert.match(readService, /eq\(pmv2Tasks\.dueDate, filters\.dateFrom\)/);
});

test('multi-day and one-sided ranges retain inclusive bounds', () => {
  assert.match(readService, /gte\(pmv2Tasks\.dueDate, filters\.dateFrom\)/);
  assert.match(readService, /lte\(pmv2Tasks\.dueDate, filters\.dateTo\)/);
});

test('all-tasks date inputs are part of the task query input', () => {
  assert.match(page, /const taskListInput = useMemo/);
  assert.match(page, /dateFrom: dateFrom \|\| undefined/);
  assert.match(page, /dateTo: dateTo \|\| undefined/);
  assert.match(page, /pmv2\.tasks\.list\.useQuery\(taskListInput\)/);
});

test('date changes explicitly refresh the all-tasks result set', () => {
  assert.match(page, /useEffect\(\(\) => \{/);
  assert.match(page, /scope === "all" && \(dateFrom \|\| dateTo\)/);
  assert.match(page, /void tasksQuery\.refetch\(\)/);
});

test('task-list query errors are shown instead of masquerading as zero results', () => {
  assert.match(page, /tasksQuery\.isError/);
  assert.match(page, /تعذر تحميل المهام/);
  assert.match(page, /tasksQuery\.error\.message/);
});
