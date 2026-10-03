import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');

test('manual scheduler test panel is placed above the scheduled task list', () => {
  const searchIndex = source.indexOf('<Label>بحث</Label>');
  const schedulerIndex = source.indexOf('تشغيل الجدولة اليدوي للاختبار');
  const taskListIndex = source.indexOf('<CardTitle className="text-lg">المهام المجدولة</CardTitle>');

  assert.ok(searchIndex >= 0, 'search controls should exist');
  assert.ok(schedulerIndex >= 0, 'manual scheduler panel should exist');
  assert.ok(taskListIndex >= 0, 'scheduled task list should exist');
  assert.ok(searchIndex < schedulerIndex, 'scheduler panel should follow search/team controls');
  assert.ok(schedulerIndex < taskListIndex, 'scheduler panel should appear before the task list');
});
