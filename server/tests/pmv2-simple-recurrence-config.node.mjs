import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const schedule = await import(pathToFileURL(path.join(process.cwd(), 'server/pmv2/checklists/schedule-config.ts')).href);
const recurrence = await import(pathToFileURL(path.join(process.cwd(), 'server/pmv2/checklists/recurrence.ts')).href);
const validation = await import(pathToFileURL(path.join(process.cwd(), 'server/pmv2/checklists/validation.ts')).href);

function json(config) {
  return JSON.stringify({
    version: 1,
    startDate: '2026-09-09',
    weekdays: [],
    monthDays: [],
    quarterDates: [],
    halfYearDates: [],
    yearDates: [],
    ...config,
  });
}

const baseWrite = {
  checklistId: 1,
  title: 'بند',
  sortOrder: 1,
  isRequired: true,
  isActive: true,
  frequencyValue: null,
  weekday: null,
  monthDay: null,
  anchorDate: null,
};

test('custom weekly schedule supports several weekdays', () => {
  const scheduleConfigJson = json({ unit: 'week', interval: 1, weekdays: [0, 2, 4] });
  const config = { ...baseWrite, frequency: 'weekly', scheduleConfigJson };
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-13'), true); // Sunday
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-15'), true); // Tuesday
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-17'), true); // Thursday
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-16'), false);
});

test('every two weeks alternates whole weeks from the configured start', () => {
  const scheduleConfigJson = json({ unit: 'week', interval: 2, startDate: '2026-09-14', weekdays: [1] });
  const config = { ...baseWrite, frequency: 'weekly', frequencyValue: 2, weekday: 1, anchorDate: '2026-09-14', scheduleConfigJson };
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-14'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-21'), false);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-28'), true);
});

test('custom monthly schedule supports several days and the last day', () => {
  const scheduleConfigJson = json({ unit: 'month', interval: 1, monthDays: [5, 15, 25, 'last'] });
  const config = { ...baseWrite, frequency: 'monthly', monthDay: 5, scheduleConfigJson };
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-10-05'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-10-15'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-10-25'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-10-31'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-02-28'), true);
});

test('quarterly schedule can place several dates inside each calendar quarter', () => {
  const scheduleConfigJson = json({
    unit: 'quarter', interval: 1,
    quarterDates: [{ monthInQuarter: 1, day: 5 }, { monthInQuarter: 3, day: 25 }],
  });
  const config = { ...baseWrite, frequency: 'quarterly', scheduleConfigJson };
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-01-05'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-03-25'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-04-05'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-05-05'), false);
});

test('annual custom schedule supports several dates in one year', () => {
  const scheduleConfigJson = json({
    unit: 'year', interval: 1,
    yearDates: [{ month: 3, day: 15 }, { month: 7, day: 1 }, { month: 12, day: 20 }],
  });
  const config = { ...baseWrite, frequency: 'annual', scheduleConfigJson };
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-03-15'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-07-01'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-12-20'), true);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2027-12-21'), false);
});

test('new schedules do not backfill before their hidden start date', () => {
  const scheduleConfigJson = json({ unit: 'day', interval: 1, startDate: '2026-09-09' });
  const config = { ...baseWrite, frequency: 'daily', scheduleConfigJson };
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-08'), false);
  assert.equal(recurrence.isPmv2RecurrenceDueOnDate(config, '2026-09-09'), true);
});

test('write validation accepts new quarterly config without legacy anchor and rejects frequency mismatch', () => {
  const scheduleConfigJson = json({ unit: 'quarter', interval: 1, quarterDates: [{ monthInQuarter: 2, day: 10 }] });
  const valid = validation.validatePmv2ChecklistItemWrite({ ...baseWrite, frequency: 'quarterly', scheduleConfigJson });
  assert.ok(valid.scheduleConfigJson);
  assert.throws(
    () => validation.validatePmv2ChecklistItemWrite({ ...baseWrite, frequency: 'monthly', scheduleConfigJson }),
    /نوع التكرار لا يطابق إعداد الجدول/,
  );
});

test('Arabic labels explain the actual schedule instead of technical fields', () => {
  const weekly = schedule.parsePmv2ScheduleConfigJson(json({ unit: 'week', interval: 1, weekdays: [0, 2, 4] }));
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(weekly), 'كل أسبوع • الأحد، الثلاثاء والخميس');
  const annual = schedule.parsePmv2ScheduleConfigJson(json({ unit: 'year', interval: 1, yearDates: [{ month: 3, day: 15 }, { month: 7, day: 1 }] }));
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(annual), 'سنويًا • 15 مارس و1 يوليو');
});
