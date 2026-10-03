import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const validation = await import(
  pathToFileURL(path.join(process.cwd(), 'server/pmv2/checklists/validation.ts')).href
);
const page = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');

const weeklyBase = {
  checklistId: 1,
  title: 'اختبار التكرار',
  sortOrder: 99,
  isRequired: true,
  isActive: true,
  frequency: 'weekly',
  weekday: 1,
  monthDay: null,
  anchorDate: null,
  scheduleConfigJson: null,
};

test('legacy backend boundary still rejects frequencyValue zero', () => {
  assert.throws(
    () => validation.validatePmv2ChecklistItemWrite({ ...weeklyBase, frequencyValue: 0 }),
    /كل كم دورة يجب أن يكون رقمًا صحيحًا 1 أو أكثر/,
  );
});

test('legacy backend boundary still rejects negative and fractional frequencyValue', () => {
  assert.throws(
    () => validation.validatePmv2ChecklistItemWrite({ ...weeklyBase, frequencyValue: -1 }),
    /كل كم دورة يجب أن يكون رقمًا صحيحًا 1 أو أكثر/,
  );
  assert.throws(
    () => validation.validatePmv2ChecklistItemWrite({ ...weeklyBase, frequencyValue: 1.5 }),
    /كل كم دورة يجب أن يكون رقمًا صحيحًا 1 أو أكثر/,
  );
});

test('manager UI no longer exposes the technical frequencyValue control', () => {
  assert.doesNotMatch(page, />كل كم دورة</);
  assert.match(page, /متى يتكرر الفحص؟/);
  assert.match(page, /كرر كل/); // only inside the explicit custom mode
});
