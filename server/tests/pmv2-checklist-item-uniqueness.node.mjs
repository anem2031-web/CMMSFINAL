import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const validation = await import(
  pathToFileURL(path.join(process.cwd(), "server/pmv2/checklists/validation.ts")).href
);

const base = {
  id: 10,
  checklistId: 1,
  title: "فحص أسبوعي تجريبي",
  sortOrder: 4,
  isRequired: true,
  isActive: true,
  frequency: "weekly",
  frequencyValue: 1,
  weekday: 1,
  monthDay: null,
  anchorDate: null,
};

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

test("rejects duplicate active sort order inside the same checklist", () => {
  assert.throws(
    () => validation.assertPmv2ChecklistItemLogicalUniqueness(
      { ...base, id: undefined, title: "عنوان مختلف", frequency: "daily", weekday: null },
      [base],
    ),
    /الترتيب 4 مستخدم بالفعل/,
  );
});

test("allows the same title when recurrence meaning is different and sort order differs", () => {
  assert.doesNotThrow(() =>
    validation.assertPmv2ChecklistItemLogicalUniqueness(
      { ...base, id: undefined, sortOrder: 5, frequency: "daily", weekday: null },
      [base],
    ),
  );
});

test("rejects exact duplicate title plus recurrence even when sort order differs", () => {
  assert.throws(
    () => validation.assertPmv2ChecklistItemLogicalUniqueness(
      { ...base, id: undefined, sortOrder: 5, title: "  فحص   أسبوعي تجريبي  " },
      [base],
    ),
    /بنفس العنوان وإعدادات التكرار/,
  );
});

test("inactive historical items do not block a current active order", () => {
  assert.doesNotThrow(() =>
    validation.assertPmv2ChecklistItemLogicalUniqueness(
      { ...base, id: undefined },
      [{ ...base, isActive: false }],
    ),
  );
});

test("update excludes the current row from uniqueness comparison", () => {
  assert.doesNotThrow(() =>
    validation.assertPmv2ChecklistItemLogicalUniqueness(base, [base], 10),
  );
});

console.log(`PM V2 checklist item uniqueness: ${passed}/5 PASS`);
