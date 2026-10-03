import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');
const router = fs.readFileSync('server/routers/pmv2/tasks.ts', 'utf8');
const readService = fs.readFileSync('server/pmv2/tasks/read-service.ts', 'utf8');

test('all-tasks scope exposes date-from/date-to controls only for all tasks', () => {
  assert.match(page, /scope === "all"/);
  assert.match(page, /<Label>من تاريخ<\/Label>/);
  assert.match(page, /<Label>إلى تاريخ<\/Label>/);
  assert.match(page, /type="date" value=\{dateFrom\}/);
  assert.match(page, /type="date" value=\{dateTo\}/);
});

test('date range is sent to the existing task list query only in all-tasks scope', () => {
  assert.match(page, /\.\.\.\(scope === "all" \? \{/);
  assert.match(page, /dateFrom: dateFrom \|\| undefined/);
  assert.match(page, /dateTo: dateTo \|\| undefined/);
  assert.match(router, /dateFrom: isoDate\.optional\(\)/);
  assert.match(router, /dateTo: isoDate\.optional\(\)/);
  assert.match(readService, /gte\(pmv2Tasks\.dueDate, filters\.dateFrom\)/);
  assert.match(readService, /lte\(pmv2Tasks\.dueDate, filters\.dateTo\)/);
});

test('date inputs prevent an inverted visible range', () => {
  assert.match(page, /max=\{dateTo \|\| undefined\}/);
  assert.match(page, /min=\{dateFrom \|\| undefined\}/);
});

test('all-tasks filters can be cleared in one action', () => {
  assert.match(page, /مسح الفلاتر/);
  assert.match(page, /setSearch\(""\); setTeamFilter\(""\); setDateFrom\(""\); setDateTo\(""\); setPage\(1\); setSelectedTaskId\(""\);/);
});
