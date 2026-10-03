import assert from "node:assert/strict";
import {
  getNextPmv2DueDate,
  isPmv2RecurrenceDueOnDate,
} from "../pmv2/checklists/recurrence.ts";
import {
  Pmv2ChecklistValidationError,
  validatePmv2ChecklistItemWrite,
} from "../pmv2/checklists/validation.ts";

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const baseWrite = {
  checklistId: 1,
  title: "بند",
  sortOrder: 0,
  isRequired: true,
  isActive: true,
  frequencyValue: null,
  weekday: null,
  monthDay: null,
  anchorDate: null,
};

test("daily and interval-daily schedules are deterministic", () => {
  assert.equal(isPmv2RecurrenceDueOnDate({ ...baseWrite, frequency: "daily" }, "2026-09-08"), true);
  const every2 = { ...baseWrite, frequency: "daily", frequencyValue: 2, anchorDate: "2026-09-01" };
  assert.equal(isPmv2RecurrenceDueOnDate(every2, "2026-09-07"), true);
  assert.equal(isPmv2RecurrenceDueOnDate(every2, "2026-09-08"), false);
});

test("weekly recurrence uses weekday and interval weeks", () => {
  const weekly = { ...baseWrite, frequency: "weekly", weekday: 1 };
  assert.equal(isPmv2RecurrenceDueOnDate(weekly, "2026-09-07"), true);
  assert.equal(isPmv2RecurrenceDueOnDate(weekly, "2026-09-08"), false);
  const every2 = { ...weekly, frequencyValue: 2, anchorDate: "2026-09-07" };
  assert.equal(isPmv2RecurrenceDueOnDate(every2, "2026-09-21"), true);
  assert.equal(isPmv2RecurrenceDueOnDate(every2, "2026-09-14"), false);
});

test("monthly recurrence clamps day 31 to the last valid day", () => {
  const monthly = { ...baseWrite, frequency: "monthly", monthDay: 31 };
  assert.equal(isPmv2RecurrenceDueOnDate(monthly, "2027-02-28"), true);
  assert.equal(isPmv2RecurrenceDueOnDate(monthly, "2027-02-27"), false);
  assert.equal(isPmv2RecurrenceDueOnDate(monthly, "2026-04-30"), true);
});

test("quarterly, biannual and annual schedules follow anchor month/day", () => {
  const q = { ...baseWrite, frequency: "quarterly", anchorDate: "2026-01-31" };
  assert.equal(isPmv2RecurrenceDueOnDate(q, "2026-04-30"), true);
  assert.equal(isPmv2RecurrenceDueOnDate(q, "2026-05-31"), false);

  const h = { ...baseWrite, frequency: "biannual", anchorDate: "2026-01-31" };
  assert.equal(isPmv2RecurrenceDueOnDate(h, "2026-07-31"), true);

  const y = { ...baseWrite, frequency: "annual", anchorDate: "2024-02-29" };
  assert.equal(isPmv2RecurrenceDueOnDate(y, "2025-02-28"), true);
  assert.equal(isPmv2RecurrenceDueOnDate(y, "2025-03-01"), false);
});

test("disabled items never become due and next-due is date-only deterministic", () => {
  const disabled = { ...baseWrite, frequency: "daily", isActive: false };
  assert.equal(isPmv2RecurrenceDueOnDate(disabled, "2026-09-08"), false);
  const weekly = { ...baseWrite, frequency: "weekly", weekday: 1 };
  assert.equal(getNextPmv2DueDate(weekly, "2026-09-08"), "2026-09-14");
});

test("write validation enforces frequency-specific recurrence shape", () => {
  assert.throws(
    () => validatePmv2ChecklistItemWrite({ ...baseWrite, frequency: "weekly" }),
    error => error instanceof Pmv2ChecklistValidationError && error.field === "weekday",
  );
  assert.throws(
    () => validatePmv2ChecklistItemWrite({ ...baseWrite, frequency: "monthly" }),
    error => error instanceof Pmv2ChecklistValidationError && error.field === "monthDay",
  );
  assert.throws(
    () => validatePmv2ChecklistItemWrite({ ...baseWrite, frequency: "quarterly" }),
    error => error instanceof Pmv2ChecklistValidationError && error.field === "anchorDate",
  );
  assert.throws(
    () => validatePmv2ChecklistItemWrite({ ...baseWrite, frequency: "daily", frequencyValue: 2 }),
    error => error instanceof Pmv2ChecklistValidationError && error.field === "anchorDate",
  );
});

console.log(`PM V2 Phase 2 recurrence contract: ${passed}/6 PASS`);
