import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(
  "client/src/pages/pmv2/ScheduledMaintenance.tsx",
  "utf8",
);

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

const resetStart = page.indexOf("function resetChecklistItemForm() {");
const resetEnd = page.indexOf("\n  const createChecklist", resetStart);
const resetBlock = page.slice(resetStart, resetEnd);
const createItemStart = page.indexOf("const createItem = trpc.pmv2.checklists.items.create.useMutation({");
const createItemEnd = page.indexOf("\n\n  const updateItem", createItemStart);
const createItemBlock = page.slice(createItemStart, createItemEnd);

test("checklist item form has one explicit reset helper", () => {
  assert.ok(resetStart >= 0 && resetEnd > resetStart);
});

test("successful checklist-item create invokes the reset helper", () => {
  assert.ok(createItemStart >= 0 && createItemEnd > createItemStart);
  assert.match(createItemBlock, /onSuccess:[\s\S]*resetChecklistItemForm\(\)/);
  assert.match(createItemBlock, /toast\.success\("تمت إضافة بند الصيانة"\)/);
});

test("reset clears the item title and restores the normal recurrence default", () => {
  assert.match(resetBlock, /setTitle\(""\)/);
  assert.match(resetBlock, /setRecurrencePreset\("monthly"\)/);
  assert.match(resetBlock, /setSimpleWeekday\("1"\)/);
  assert.match(resetBlock, /setSimpleDay\("1"\)/);
  assert.match(resetBlock, /setSimpleLastDay\(false\)/);
});

test("reset clears all custom monthly, quarterly, and annual selections", () => {
  assert.match(resetBlock, /setCustomMonthDays\(\[\]\)/);
  assert.match(resetBlock, /setCustomQuarterDates\(\[\]\)/);
  assert.match(resetBlock, /setCustomYearDates\(\[\]\)/);
  assert.match(resetBlock, /setCustomQuarterLast\(false\)/);
  assert.match(resetBlock, /setCustomYearLast\(false\)/);
});

test("reset restores custom interval/start helpers to safe defaults", () => {
  assert.match(resetBlock, /setCustomUnit\("week"\)/);
  assert.match(resetBlock, /setCustomInterval\("1"\)/);
  assert.match(resetBlock, /setCustomStartDate\(riyadhToday\(\)\)/);
  assert.match(resetBlock, /setCustomWeekdays\(\[1\]\)/);
});

test("successful reset keeps the currently selected checklist open", () => {
  assert.doesNotMatch(resetBlock, /setSelectedChecklistId/);
  assert.doesNotMatch(createItemBlock, /setSelectedChecklistId/);
  assert.match(createItemBlock, /selectedQuery\.refetch\(\)/);
});

console.log(`PM V2 checklist item form reset: ${passed}/6 PASS`);
