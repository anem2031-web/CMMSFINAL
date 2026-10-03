import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync(
  new URL("../../drizzle/2026_09_08_pmv2_task_items.sql", import.meta.url),
  "utf8",
);

test("Task Item uses internal PM V2 foreign keys only", () => {
  assert.match(sql, /REFERENCES `pmv2_tasks` \(`id`\)/);
  assert.match(sql, /REFERENCES `pmv2_checklist_items` \(`id`\)/);
  assert.doesNotMatch(sql, /REFERENCES `(users|sites|sections|assets|warehouses)`/);
});

test("Task Item generation key matches the frozen contract", () => {
  assert.match(
    sql,
    /UNIQUE KEY `uq_pmv2_task_items_generation`\s*\n\s*\(`taskId`, `sourceChecklistItemId`, `scheduledDate`\)/,
  );
});

test("Task Item states match the frozen state machine", () => {
  for (const state of [
    "pending",
    "in_progress",
    "waiting_material",
    "waiting_ticket",
    "ready_to_complete",
    "completed",
  ]) {
    assert.match(sql, new RegExp(`'${state}'`));
  }
  assert.doesNotMatch(sql, /'cancelled'/);
});

test("Task Item results match the frozen technician outcomes", () => {
  for (const result of ["ok", "fixed", "needs_material", "needs_ticket"]) {
    assert.match(sql, new RegExp(`'${result}'`));
  }
});

test("Task Item stores frozen checklist snapshots", () => {
  assert.match(sql, /`titleSnapshot` VARCHAR\(300\) NOT NULL/);
  assert.match(sql, /`sortOrderSnapshot` INT NOT NULL DEFAULT 0/);
  assert.match(sql, /`scheduledDate` DATE NOT NULL/);
});
