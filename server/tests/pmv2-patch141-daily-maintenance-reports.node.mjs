import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("client/src/pages/pmv2/Pmv2MaintenanceReports.tsx");
const app = read("client/src/App.tsx");
const layout = read("client/src/components/layout/DashboardLayout.tsx");
const ar = read("client/src/i18n/ar.ts");
const service = read("server/pmv2/reports/daily-report-service.ts");
const router = read("server/routers/pmv2/reports.ts");
const index = read("server/routers/pmv2/index.ts");


test("PATCH141 adds a dedicated Scheduled Maintenance reports page and navigation entry", () => {
  assert.ok(page.includes("تقارير الصيانة المجدولة"));
  assert.match(app, /scheduled-maintenance\/reports/);
  assert.match(layout, /nav\.pmv2MaintenanceReports/);
  assert.ok(ar.includes('pmv2MaintenanceReports: "تقارير الصيانة المجدولة"'));
  assert.ok(app.indexOf('/scheduled-maintenance/reports') < app.indexOf('<Route path="/scheduled-maintenance" component={ScheduledMaintenance}'));
});

test("PATCH141 report is management-scoped and stays inside PM V2", () => {
  assert.match(router, /pmv2ManagementProcedure/);
  assert.match(router, /daily: pmv2ManagementProcedure/);
  assert.match(index, /reports: pmv2ReportsRouter/);
  assert.doesNotMatch(service, /insert\(purchaseOrders\)|update\(purchaseOrders\)|insert\(tickets\)|update\(tickets\)|insert\(inventory\)|update\(inventory\)/);
});

test("PATCH141 compares daily team assignment with execution and carry-over work", () => {
  assert.match(service, /eq\(pmv2Tasks\.dueDate, filters\.date\)/);
  assert.match(service, /carryOverOpen/);
  assert.match(service, /completedToday/);
  assert.match(service, /workedPending/);
  assert.match(service, /notStarted/);
  for (const text of ["المكلف اليوم", "المنجز", "بدأ ومعلق", "لم يبدأ", "نسبة الإنجاز"]) {
    assert.ok(page.includes(text), `missing report summary: ${text}`);
  }
});

test("PATCH141 shows technician notes directly on every task card", () => {
  assert.match(service, /note: pmv2ItemActions\.note/);
  assert.match(service, /dayNotes/);
  assert.ok(page.includes("ملاحظات الفني"));
  assert.ok(page.includes("لا توجد ملاحظة فنية مسجلة اليوم لهذه المهمة"));
});

test("PATCH141 exposes current blocking location and responsibility using PATCH138 timeline", () => {
  assert.match(service, /pmv2TaskTimelineService\.getForManagement/);
  assert.match(service, /currentResponsibility/);
  for (const text of ["الوضع الحالي للمهمة", "الجهة صاحبة الإجراء", "عرض المسار الكامل", "المسار الزمني"]) {
    assert.ok(page.includes(text), `missing current-responsibility UI: ${text}`);
  }
});

test("PATCH141 supports team and technician comparison without inventing per-technician assignment", () => {
  assert.match(service, /PM V2 يكلّف المهمة على مستوى الفريق/);
  assert.match(service, /technicianParticipatedToday/);
  assert.ok(page.includes("مشاركة الفني المحدد اليوم"));
  assert.ok(page.includes("شارك الفني في مهام اليوم"));
});

test("PATCH141 keeps visit-close visibility in the daily management report", () => {
  assert.match(service, /hasOpenVisit/);
  assert.ok(page.includes("زيارة ما زالت مفتوحة"));
  assert.ok(page.includes("مهام بها زيارة مفتوحة"));
});
