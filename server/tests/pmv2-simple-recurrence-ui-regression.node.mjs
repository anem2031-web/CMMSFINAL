import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');
const label = fs.readFileSync('client/src/pages/pmv2/recurrence-label.ts', 'utf8');

test('normal recurrence UI hides technical cycle and anchor wording', () => {
  assert.doesNotMatch(page, />كل كم دورة</);
  assert.doesNotMatch(page, />تاريخ الارتكاز</);
  assert.match(page, /متى يتكرر الفحص؟/);
  assert.match(page, /كل أسبوعين/);
  assert.match(page, /مخصص/);
});

test('weekly custom UI lets maintenance manager select several weekdays', () => {
  assert.match(page, /اختر أيام التنفيذ/);
  assert.match(page, /customWeekdays/);
  assert.match(page, /toggleCustomWeekday/);
});

test('monthly custom UI supports several dates and explicit last-day option', () => {
  assert.match(page, /اختر أيام التنفيذ من الشهر/);
  assert.match(page, /إضافة يوم/);
  assert.match(page, /إضافة آخر يوم/);
  assert.match(page, /customMonthDays/);
});

test('quarterly and annual custom UI allow several appointments', () => {
  assert.match(page, /اختر مواعيد التنفيذ خلال فترة 3 أشهر/);
  assert.match(page, /اختر تواريخ التنفيذ خلال السنة/);
  assert.match(page, /customQuarterDates/);
  assert.match(page, /customYearDates/);
});

test('screen shows a plain-language preview before saving', () => {
  assert.match(page, /سيتم تنفيذ هذا الفحص:/);
  assert.match(page, /formatPmv2ScheduleConfigJsonLabel/);
});

test('historical task item label prefers the saved snapshot', () => {
  assert.match(label, /recurrenceLabelSnapshot/);
  assert.match(label, /if \(item\.recurrenceLabelSnapshot\?\.trim\(\)\)/);
});
