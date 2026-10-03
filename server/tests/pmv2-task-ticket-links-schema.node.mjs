import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(
  new URL('../../drizzle/2026_09_08_pmv2_task_ticket_links.sql', import.meta.url),
  'utf8',
);

test('ticket link belongs internally to one PM V2 task item', () => {
  assert.match(sql, /FOREIGN KEY \(`taskItemId`\)/);
  assert.match(sql, /REFERENCES `pmv2_task_items` \(`id`\)/);
});

test('ticket and creator remain indexed external references without physical FKs', () => {
  assert.match(sql, /UNIQUE KEY `uq_pmv2_task_ticket_links_ticket` \(`ticketId`\)/);
  assert.match(sql, /KEY `idx_pmv2_task_ticket_links_created_by` \(`createdById`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`ticketId`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`createdById`\)/);
  assert.doesNotMatch(sql, /REFERENCES `tickets`|REFERENCES `users`/);
});

test('one existing ticket has one unambiguous PM V2 source link', () => {
  assert.match(sql, /UNIQUE KEY `uq_pmv2_task_ticket_links_ticket` \(`ticketId`\)/);
});

test('link does not duplicate ticket workflow state or maintenance path', () => {
  assert.doesNotMatch(sql, /`status`/);
  assert.doesNotMatch(sql, /maintenancePath|maintenance_path/);
});

test('taskId is intentionally not duplicated in the link table', () => {
  assert.doesNotMatch(sql, /`taskId`/);
});
