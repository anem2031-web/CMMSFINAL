import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ui = fs.readFileSync(new URL('../../client/src/pages/pmv2/ScheduledMaintenance.tsx', import.meta.url), 'utf8');

const expectedDays = [
  ['0', 'الأحد'],
  ['1', 'الاثنين'],
  ['2', 'الثلاثاء'],
  ['3', 'الأربعاء'],
  ['4', 'الخميس'],
  ['5', 'الجمعة'],
  ['6', 'السبت'],
];

test('weekly recurrence uses weekday names instead of numeric input', () => {
  assert.match(ui, /<Label>يوم الأسبوع<\/Label>/);
  assert.match(ui, /weekdayOptions\.map/);
  assert.doesNotMatch(ui, /يوم الأسبوع \(0 الأحد - 6 السبت\)/);
  assert.doesNotMatch(ui, /type="number" min="0" max="6" value=\{weekday\}/);
});

test('all seven weekdays are present with the existing 0-6 scheduler values', () => {
  for (const [value, label] of expectedDays) {
    assert.match(ui, new RegExp(`\\{ value: "${value}", label: "${label}" \\}`));
  }
});

test('saved weekly items display the weekday name', () => {
  assert.match(ui, /weekdayLabels\[Number\(item\.weekday\)\]/);
});
