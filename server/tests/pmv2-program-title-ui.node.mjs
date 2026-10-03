import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schema = fs.readFileSync('drizzle/schema.ts', 'utf8');
const migration = fs.readFileSync('drizzle/2026_09_12_pmv2_program_title.sql', 'utf8');
const router = fs.readFileSync('server/routers/pmv2/programs.ts', 'utf8');
const service = fs.readFileSync('server/pmv2/programs/service.ts', 'utf8');
const ui = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');

test('program title schema and API are optional and bounded', () => {
  assert.match(schema, /export const pmv2Programs = mysqlTable\("pmv2_programs"[\s\S]*title: varchar\(\{ length: 200 \}\)/);
  assert.match(migration, /ADD COLUMN `title` VARCHAR\(200\) NULL AFTER `id`/);
  assert.match(router, /title: z\.string\(\)\.trim\(\)\.max\(200\)\.nullable\(\)\.optional\(\)/);
  assert.match(service, /title: pmv2Programs\.title/);
  assert.match(service, /title: input\.title\?\.trim\(\) \|\| null/);
  assert.match(service, /patch\.title = input\.title\?\.trim\(\) \|\| null/);
});

test('program title is manager-friendly, editable, searchable, and keeps number fallback', () => {
  assert.match(ui, /عنوان البرنامج — اختياري/);
  assert.match(ui, /title: programTitle\.trim\(\) \|\| null/);
  assert.match(ui, /title: editProgramTitle\.trim\(\) \|\| null/);
  assert.match(ui, /program\.title\?\.trim\(\) \|\| `برنامج #\$\{program\.id\}`/);
  assert.match(ui, /program\.title \?\? ""/);
  assert.match(ui, /يمكن تعديله حتى بعد توليد المهام لأنه لا يغيّر التاريخ التشغيلي/);
});
