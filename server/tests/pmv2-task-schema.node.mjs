import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_tasks.sql", import.meta.url),
  "utf8",
);

test("Task uses only internal PM V2 foreign keys", () => {
  assert.match(sql, /REFERENCES `pmv2_programs` \(`id`\)/);
  assert.match(sql, /REFERENCES `pmv2_program_targets` \(`id`\)/);
  assert.match(sql, /REFERENCES `pmv2_teams` \(`id`\)/);
  assert.doesNotMatch(sql, /REFERENCES `(users|sites|sections|assets|warehouses)`/);
});

test("Task number is unique", () => {
  assert.match(sql, /UNIQUE KEY `uq_pmv2_tasks_task_number` \(`taskNumber`\)/);
});

test("Scheduler idempotency key is frozen", () => {
  assert.match(
    sql,
    /UNIQUE KEY `uq_pmv2_tasks_generation` \(`programId`, `programTargetId`, `dueDate`\)/,
  );
});

test("Task states match the frozen state machine", () => {
  for (const state of [
    "pending",
    "in_progress",
    "waiting_material",
    "waiting_ticket",
    "ready_to_complete",
    "completed",
    "cancelled",
  ]) {
    assert.match(sql, new RegExp(`'${state}'`));
  }
});
