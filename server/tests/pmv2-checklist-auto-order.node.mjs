import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const order = await import(
  pathToFileURL(path.join(process.cwd(), "server/pmv2/checklists/order.ts")).href
);

const page = fs.readFileSync(
  "client/src/pages/pmv2/ScheduledMaintenance.tsx",
  "utf8",
);
const service = fs.readFileSync(
  "server/pmv2/checklists/service.ts",
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

test("first checklist item starts at one", () => {
  assert.equal(order.nextPmv2ChecklistItemSortOrder([]), 1);
});

test("legacy zero does not force the next item back to zero", () => {
  assert.equal(order.nextPmv2ChecklistItemSortOrder([{ sortOrder: 0 }]), 1);
});

test("new item takes the next highest stable order", () => {
  assert.equal(
    order.nextPmv2ChecklistItemSortOrder([
      { sortOrder: 1 },
      { sortOrder: 2 },
      { sortOrder: 4 },
    ]),
    5,
  );
});

test("historical or inactive positions are not silently reused", () => {
  assert.equal(
    order.nextPmv2ChecklistItemSortOrder([
      { sortOrder: 1 },
      { sortOrder: 5 },
    ]),
    6,
  );
});

test("manager UI no longer asks for a manual sort-order number", () => {
  assert.doesNotMatch(page, /<Label>الترتيب<\/Label>/);
  assert.match(page, /يتم ترتيب البنود تلقائيًا حسب إضافتها/);
});

test("manager create request leaves sort order for the service to assign", () => {
  const submitStart = page.indexOf("function submitItem() {");
  const submitEnd = page.indexOf("\n  return (", submitStart);
  const submitBlock = page.slice(submitStart, submitEnd);
  assert.ok(submitStart >= 0 && submitEnd > submitStart);
  assert.doesNotMatch(submitBlock, /sortOrder\s*:/);
  assert.match(service, /if \(sortOrder === undefined\)/);
  assert.match(service, /nextPmv2ChecklistItemSortOrder\(existingItems\)/);
});

test("checklist list shows human ordinal positions starting from one", () => {
  assert.match(page, /map\(\(item: any, itemIndex: number\) =>/);
  assert.match(page, /\{itemIndex \+ 1\}\. \{item\.title\}/);
});

console.log(`PM V2 checklist automatic ordering: ${passed}/7 PASS`);
