import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextPmv2DueDate,
  isPmv2RecurrenceDueOnDate,
} from "../pmv2/checklists/recurrence.ts";

const biweeklyMonday = {
  frequency: "weekly",
  frequencyValue: 2,
  weekday: 1,
  monthDay: null,
  anchorDate: "2026-06-01",
  isActive: true,
};

test("anchor Monday itself is due", () => {
  assert.equal(isPmv2RecurrenceDueOnDate(biweeklyMonday, "2026-06-01"), true);
});

test("one week after anchor is not due", () => {
  assert.equal(isPmv2RecurrenceDueOnDate(biweeklyMonday, "2026-06-08"), false);
});

test("two weeks after anchor is due", () => {
  assert.equal(isPmv2RecurrenceDueOnDate(biweeklyMonday, "2026-06-15"), true);
});

test("2026-09-07 is due on the even-week cycle", () => {
  assert.equal(isPmv2RecurrenceDueOnDate(biweeklyMonday, "2026-09-07"), true);
});

test("2026-09-14 is correctly excluded because it is week 15 from anchor", () => {
  assert.equal(isPmv2RecurrenceDueOnDate(biweeklyMonday, "2026-09-14"), false);
});

test("next due date from 2026-09-14 is 2026-09-21", () => {
  assert.equal(getNextPmv2DueDate(biweeklyMonday, "2026-09-14"), "2026-09-21");
  assert.equal(isPmv2RecurrenceDueOnDate(biweeklyMonday, "2026-09-21"), true);
});
