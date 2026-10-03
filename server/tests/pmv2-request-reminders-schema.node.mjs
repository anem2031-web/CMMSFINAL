import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(resolve(here, "../../drizzle/2026_09_08_pmv2_request_reminders.sql"), "utf8");

test("request reminder belongs to one PM V2 material request", () => {
  assert.match(sql, /FOREIGN KEY \(`requestId`\)/);
  assert.match(sql, /REFERENCES `pmv2_material_requests` \(`id`\)/);
});

test("recipient, notification and creator stay external indexed references", () => {
  assert.match(sql, /idx_pmv2_request_reminders_recipient_user/);
  assert.match(sql, /idx_pmv2_request_reminders_notification/);
  assert.match(sql, /idx_pmv2_request_reminders_created_by/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`recipientUserId`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`notificationId`\)/);
  assert.doesNotMatch(sql, /FOREIGN KEY \(`createdById`\)/);
  assert.doesNotMatch(sql, /REFERENCES `(users|notifications)`/);
});

test("reminder trace is extensible without freezing notification workflow states", () => {
  assert.match(sql, /`reminderType` VARCHAR\(50\) NOT NULL/);
  assert.doesNotMatch(sql, /`status`/);
  assert.doesNotMatch(sql, /ENUM\(/);
});

test("multiple historical reminders remain allowed", () => {
  assert.doesNotMatch(sql, /UNIQUE KEY/);
});

test("schema does not duplicate notification title or message payload", () => {
  assert.doesNotMatch(sql, /`title`|`message`|`body`/);
});
