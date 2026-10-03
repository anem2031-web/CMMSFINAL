import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../drizzle/2026_09_08_pmv2_material_requests.sql', import.meta.url), 'utf8');

test('material request header belongs to task item and visit with internal PM V2 FKs', () => {
  assert.match(sql, /FOREIGN KEY \(`taskItemId`\)/);
  assert.match(sql, /REFERENCES `pmv2_task_items` \(`id`\)/);
  assert.match(sql, /FOREIGN KEY \(`visitId`\)/);
  assert.match(sql, /REFERENCES `pmv2_visits` \(`id`\)/);
});

test('material request header snapshots the responsible PM V2 team with an internal FK', () => {
  assert.match(sql, /FOREIGN KEY \(`teamId`\)/);
  assert.match(sql, /REFERENCES `pmv2_teams` \(`id`\)/);
});

test('requester and team warehouse are indexed external references without external FKs', () => {
  assert.match(sql, /KEY `idx_pmv2_material_requests_requested_by` \(`requestedById`\)/);
  assert.match(sql, /KEY `idx_pmv2_material_requests_team_warehouse` \(`teamWarehouseId`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`requestedById`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`teamWarehouseId`\)/);
  assert.doesNotMatch(sql, /REFERENCES `users`/);
  assert.doesNotMatch(sql, /REFERENCES `warehouses`/);
});

test('material request header has no independent status column', () => {
  assert.doesNotMatch(sql, /`status`/);
});

test('multiple historical material requests remain allowed for the same task item', () => {
  assert.doesNotMatch(sql, /UNIQUE KEY[^\n]*taskItemId/);
});
