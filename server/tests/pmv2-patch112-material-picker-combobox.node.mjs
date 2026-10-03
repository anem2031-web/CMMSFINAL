import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../../client/src/pages/pmv2/Pmv2MyTasks.tsx", import.meta.url), "utf8");

test("Patch 112 replaces the separate material search + select with one searchable combobox", () => {
  assert.match(page, /role="combobox"/);
  assert.match(page, /<Popover[\s\S]*<Command shouldFilter=\{false\}>/);
  assert.match(page, /<CommandInput[\s\S]*value=\{search\}[\s\S]*onValueChange=\{setSearch\}/);
  assert.match(page, /ابحث واختر المادة بالاسم أو الكود/);
  assert.match(page, /اكتب اسم المادة أو الكود/);
  assert.doesNotMatch(page, /<select[\s\S]{0,1200}اختر المادة من الدليل الحالي/);
});

test("material results expose the operational identity and Team-Warehouse balance in the same list", () => {
  assert.match(page, /الكود: \{item\.code\}/);
  assert.match(page, /const balanceLabel = availability\?\.ambiguous/);
  assert.match(page, /الرصيد: \$\{Math\.max\(0, Number\(availability\?\.availableQuantity \|\| 0\)\)\}/);
  assert.match(page, /disabled=\{blocked\}/);
  assert.match(page, /مطلوب بالفعل/);
  assert.match(page, /جاهز للاستلام/);
});

test("selecting a combobox result preserves existing PM V2 quantity and availability workflow", () => {
  assert.match(page, /setCatalogItemId\(String\(item\.id\)\)/);
  assert.match(page, /setSelectedCatalogItemSnapshot\(item\)/);
  assert.match(page, /const preferredUnit = item\.teamAvailability\?\.unit \|\| item\.unit/);
  assert.match(page, /if \(preferredUnit\) setUnit\(preferredUnit\)/);
  assert.match(page, /تسجيل الاحتياج/);
});

test("unlisted-material fallback remains a secondary explicit action", () => {
  assert.match(page, /لم تجد المادة في الدليل؟/);
  assert.match(page, /سجلها كمادة غير موجودة في الدليل/);
  assert.match(page, /onClick=\{switchToUnlisted\}/);
});
