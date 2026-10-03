import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const engine = fs.readFileSync('server/pmv2/scheduler/engine.ts', 'utf8');
const repository = fs.readFileSync('server/pmv2/scheduler/repository.ts', 'utf8');
const readService = fs.readFileSync('server/pmv2/tasks/read-service.ts', 'utf8');
const schema = fs.readFileSync('drizzle/schema.ts', 'utf8');

test('scheduler snapshots a human-readable recurrence label', () => {
  assert.match(engine, /recurrenceLabelSnapshot: formatPmv2ChecklistScheduleLabel\(item\)/);
  assert.match(repository, /recurrenceLabelSnapshot: string \| null/);
});

test('task read service returns the recurrence label snapshot', () => {
  assert.match(readService, /recurrenceLabelSnapshot: pmv2TaskItems\.recurrenceLabelSnapshot/);
});

test('schema contains new schedule config and label snapshot columns', () => {
  assert.match(schema, /scheduleConfigJson: text\(\)/);
  assert.match(schema, /recurrenceLabelSnapshot: varchar\(\{ length: 500 \}\)/);
});
