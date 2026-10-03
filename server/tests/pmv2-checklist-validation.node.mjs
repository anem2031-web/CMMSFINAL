import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Pmv2ChecklistValidationError,
  validatePmv2ChecklistItemWrite,
} from "../pmv2/checklists/validation.ts";

const valid = {
  checklistId: 11,
  title: "فحص الفلتر",
  sortOrder: 0,
  isRequired: true,
  isActive: true,
  frequency: "monthly",
  frequencyValue: 1,
  weekday: null,
  monthDay: 15,
  anchorDate: "2026-09-08",
};

function assertInvalid(patch, field) {
  assert.throws(
    () => validatePmv2ChecklistItemWrite({ ...valid, ...patch }),
    error =>
      error instanceof Pmv2ChecklistValidationError && error.field === field,
  );
}

test("accepts and normalizes a valid checklist item write", () => {
  assert.deepEqual(validatePmv2ChecklistItemWrite(valid), valid);
  assert.equal(
    validatePmv2ChecklistItemWrite({ ...valid, title: "  فحص الفلتر  " }).title,
    "فحص الفلتر",
  );
});

test("replaces the TiDB CHECK rules at the PM V2 write boundary", () => {
  assertInvalid({ sortOrder: -1 }, "sortOrder");
  assertInvalid({ isRequired: 1 }, "isRequired");
  assertInvalid({ isActive: 0 }, "isActive");
  assertInvalid({ frequencyValue: 0 }, "frequencyValue");
  assertInvalid({ weekday: 7 }, "weekday");
  assertInvalid({ monthDay: 32 }, "monthDay");
});

test("rejects non-integer range values and invalid core fields", () => {
  assertInvalid({ checklistId: 0 }, "checklistId");
  assertInvalid({ sortOrder: 1.5 }, "sortOrder");
  assertInvalid({ frequencyValue: 1.2 }, "frequencyValue");
  assertInvalid({ weekday: 2.5 }, "weekday");
  assertInvalid({ monthDay: 0 }, "monthDay");
  assertInvalid({ frequency: "hourly" }, "frequency");
  assertInvalid({ title: "   " }, "title");
});

test("validates optional anchor dates used by Phase 2 recurrence semantics", () => {
  assertInvalid({ anchorDate: "2026-02-30" }, "anchorDate");
  assertInvalid({ anchorDate: "08-09-2026" }, "anchorDate");
  assert.equal(validatePmv2ChecklistItemWrite({ ...valid, anchorDate: null }).anchorDate, null);
});


test("keeps the executable TiDB baseline free of unsupported CHECK assumptions", () => {
  const sql = readFileSync(
    new URL("../../drizzle/2026_09_08_pmv2_checklist_items.sql", import.meta.url),
    "utf8",
  );
  const schema = readFileSync(
    new URL("../../drizzle/schema.ts", import.meta.url),
    "utf8",
  );
  const pmv2Schema = schema.split('export const pmv2ChecklistItems =')[1].split('// ═')[0];

  assert.doesNotMatch(sql, /\bCHECK\s*\(/);
  assert.doesNotMatch(pmv2Schema, /\bcheck\s*\(/);
  assert.match(sql, /FOREIGN KEY \(`checklistId`\)/);
  assert.match(sql, /REFERENCES `pmv2_checklists` \(`id`\)/);
});
