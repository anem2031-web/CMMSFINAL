import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const root = process.cwd();
const page = fs.readFileSync(path.join(root, 'client/src/pages/pmv2/ScheduledMaintenance.tsx'), 'utf8');
const clientLabel = fs.readFileSync(path.join(root, 'client/src/pages/pmv2/recurrence-label.ts'), 'utf8');
const serverSource = fs.readFileSync(path.join(root, 'server/pmv2/checklists/schedule-config.ts'), 'utf8');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pmv2-manager-recurrence-'));
const compileTs = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const serverModule = path.join(temp, 'schedule-config.mjs');
const clientModule = path.join(temp, 'recurrence-label.mjs');
fs.writeFileSync(serverModule, compileTs(serverSource));
fs.writeFileSync(clientModule, compileTs(clientLabel));
const schedule = await import(pathToFileURL(serverModule).href);
const client = await import(pathToFileURL(clientModule).href);

function config(unit, interval, extra = {}) {
  return {
    version: 1,
    unit,
    interval,
    startDate: '2026-09-12',
    weekdays: [],
    monthDays: [],
    quarterDates: [],
    halfYearDates: [],
    yearDates: [],
    ...extra,
  };
}

test('custom recurrence UI reads as two simple manager questions instead of technical fields', () => {
  assert.match(page, /متى يتكرر الفحص؟/);
  assert.match(page, /تخصيص التكرار/);
  assert.match(page, /يتكرر الفحص كل/);
  assert.match(page, /النتيجة:/);
  assert.match(page, /متى يتم التنفيذ؟/);
  assert.match(page, /اختر يومًا واحدًا أو عدة أيام من الأسبوع/);
  assert.match(page, /اختر يومًا واحدًا أو عدة أيام من الشهر/);
  assert.match(page, /اختر موعدًا واحدًا أو عدة مواعيد خلال فترة الثلاثة أشهر/);
  assert.match(page, /اختر تاريخًا واحدًا أو عدة تواريخ خلال السنة/);
  assert.match(page, /يبدأ هذا النمط من/);
  assert.doesNotMatch(page, /التكرار حسب/);
  assert.doesNotMatch(page, /فترة التكرار/);
  assert.doesNotMatch(page, /المعنى:/);
  assert.doesNotMatch(page, /<Label>كرر كل<\/Label>/);
  assert.doesNotMatch(page, /<Label>نوع الجدول المخصص<\/Label>/);
});

test('manager labels explain day week month quarter and year intervals in plain Arabic', () => {
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(config('day', 1)), 'يوميًا');
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(config('day', 2)), 'كل يومين');
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(config('week', 3, { weekdays: [1] })), 'كل 3 أسابيع • الاثنين');
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(config('month', 2, { monthDays: [5, 15, 25] })), 'كل شهرين • أيام 5، 15 و25');
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(config('quarter', 2, { quarterDates: [{ monthInQuarter: 1, day: 10 }, { monthInQuarter: 2, day: 20 }] })), 'كل 6 أشهر • الشهر الأول، يوم 10 والشهر الثاني، يوم 20');
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(config('quarter', 4, { quarterDates: [{ monthInQuarter: 1, day: 10 }] })), 'كل سنة • الشهر الأول، يوم 10');
  assert.equal(schedule.formatPmv2ScheduleConfigLabel(config('year', 2, { yearDates: [{ month: 3, day: 15 }] })), 'كل سنتين • 15 مارس');
});

test('client recurrence labels match the manager-facing interval conversions', () => {
  assert.equal(client.formatPmv2ManagerIntervalLabel('day', 1), 'يوميًا');
  assert.equal(client.formatPmv2ManagerIntervalLabel('week', 2), 'كل أسبوعين');
  assert.equal(client.formatPmv2ManagerIntervalLabel('month', 2), 'كل شهرين');
  assert.equal(client.formatPmv2ManagerIntervalLabel('quarter', 2), 'كل 6 أشهر');
  assert.equal(client.formatPmv2ManagerIntervalLabel('quarter', 4), 'كل سنة');
  assert.equal(client.formatPmv2ManagerIntervalLabel('year', 2), 'كل سنتين');

  const quarterJson = JSON.stringify(config('quarter', 2, { quarterDates: [{ monthInQuarter: 1, day: 10 }] }));
  assert.equal(client.formatPmv2ScheduleConfigJsonLabel(quarterJson), 'كل 6 أشهر • الشهر الأول، يوم 10');
});
