import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("client/src/pages/pmv2/ScheduledMaintenance.tsx");

test("PATCH140 prioritizes maintenance-manager intervention before the rest of open work", () => {
  assert.match(page, /const needsManagerIntervention = \(item: any\) => item\.sla\?\.status === "overdue" \|\| item\.currentResponsibility\?\.roleKey === "maintenance_manager"/);
  assert.ok(page.includes("تحتاج تدخلك الآن"));
  assert.ok(page.includes("معلقة وتحت الإجراء"));
  assert.ok(page.indexOf("تحتاج تدخلك الآن") < page.indexOf("معلقة وتحت الإجراء"));
});

test("PATCH140 keeps the manager summary focused on actionable operational signals", () => {
  for (const text of ["المهام المعلقة", "تحتاج تدخلك الآن", "تجاوز SLA", "أقدم تعليق"]) {
    assert.ok(page.includes(text), `missing manager summary: ${text}`);
  }
});

test("PATCH140 keeps existing search and all PATCH139 filters but moves advanced filters behind progressive disclosure", () => {
  assert.ok(page.includes("بحث بالمهمة أو الأصل أو المسؤول"));
  assert.ok(page.includes("بحث وفلاتر متقدمة"));
  for (const text of ["كل الجهات", "كل المسؤولين", "كل الفرق", "كل حالات SLA"]) {
    assert.ok(page.includes(text), `missing retained filter: ${text}`);
  }
});

test("PATCH140 keeps every PATCH139 task-row fact in the compact task card", () => {
  for (const text of ["سبب التعليق / الحالة", "المرحلة الحالية", "المسؤول الحالي", "عنده منذ:", "عمر المهمة:", "عرض المسار"]) {
    assert.ok(page.includes(text), `missing retained task fact: ${text}`);
  }
  assert.match(page, /current\?\.reason/);
  assert.match(page, /current\?\.stageLabel/);
  assert.match(page, /current\?\.roleLabel/);
  assert.match(page, /current\?\.responsibleUserName/);
  assert.match(page, /item\.currentMinutes/);
  assert.match(page, /item\.summary\?\.totalAgeMinutes/);
  assert.match(page, /slaBadge\(item\.sla\)/);
});

test("PATCH140 preserves timeline, owner indicators, SLA configuration and alert controls", () => {
  for (const text of [
    "تفصيل مراحل المهمة والمسؤولية",
    "الوقت حسب الجهة / الشخص",
    "الأحداث التفصيلية للمهمة",
    "مؤشرات المالك التنفيذية",
    "أين العمل عالق الآن؟",
    "المسؤولون الحاليون",
    "إعدادات SLA والتذكيرات",
    "فحص التنبيهات الآن",
  ]) assert.ok(page.includes(text), `missing preserved PATCH139 feature: ${text}`);
});

test("PATCH140 is a manager UI reorganization and does not add a second workflow path", () => {
  assert.doesNotMatch(page, /createPurchase|updatePurchase|createTicket|updateTicket|inventoryTransfer/);
});
