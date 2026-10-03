import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../drizzle/2026_09_08_pmv2_item_actions.sql', import.meta.url), 'utf8');

test('item actions belong to a PM V2 task item', () => {
  assert.match(sql, /FOREIGN KEY \(`taskItemId`\)/);
  assert.match(sql, /REFERENCES `pmv2_task_items` \(`id`\)/);
});

test('item actions belong to a PM V2 visit', () => {
  assert.match(sql, /FOREIGN KEY \(`visitId`\)/);
  assert.match(sql, /REFERENCES `pmv2_visits` \(`id`\)/);
});

test('item actions preserve the four frozen technician results', () => {
  for (const result of ['ok', 'fixed', 'needs_material', 'needs_ticket']) {
    assert.match(sql, new RegExp(`'${result}'`));
  }
});

test('performer is an indexed external user reference, not an external FK', () => {
  assert.match(sql, /KEY `idx_pmv2_item_actions_performed_by` \(`performedById`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`performedById`\)/);
  assert.doesNotMatch(sql, /REFERENCES `users`/);
});

test('evidence stays on the existing attachment service, not a parallel PM V2 attachment table', () => {
  assert.doesNotMatch(sql, /REFERENCES `attachments`/);
  assert.doesNotMatch(sql, /CREATE TABLE `pmv2_.*attachments/);
});
