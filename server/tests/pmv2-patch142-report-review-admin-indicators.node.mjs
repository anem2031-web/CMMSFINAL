import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const schema = read("drizzle/schema.ts");
const sql = read("drizzle/2026_09_26_pmv2_daily_report_reviews.sql");
const reportService = read("server/pmv2/reports/daily-report-service.ts");
const reportRouter = read("server/routers/pmv2/reports.ts");
const reportsPage = read("client/src/pages/pmv2/Pmv2MaintenanceReports.tsx");
const monitoringService = read("server/pmv2/monitoring/service.ts");
const scheduledPage = read("client/src/pages/pmv2/ScheduledMaintenance.tsx");

test("PATCH142 persists daily report review inside PM V2 only", () => {
  assert.match(schema, /pmv2DailyReportReviews = mysqlTable\("pmv2_daily_report_reviews"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS `pmv2_daily_report_reviews`/);
  assert.match(sql, /UNIQUE KEY `uq_pmv2_daily_report_reviews_date_team`/);
  assert.doesNotMatch(sql, /ALTER TABLE `?(purchase|inventory|tickets|users)/i);
});

test("PATCH142 review is team-and-date scoped and records reviewer/time", () => {
  for (const token of ["reportDate", "teamId", "reviewedById", "reviewedAt", "note"]) {
    assert.ok(schema.includes(token), `missing ${token}`);
  }
  assert.match(reportService, /getReview\(date: string, teamId: number\)/);
  assert.match(reportService, /markReviewed/);
  assert.match(reportService, /clearReview/);
});

test("PATCH142 exposes management-only review mutations", () => {
  assert.match(reportRouter, /markReviewed: pmv2ManagementProcedure/);
  assert.match(reportRouter, /clearReview: pmv2ManagementProcedure/);
  assert.match(reportRouter, /reviewedById: ctx\.user\.id/);
});

test("PATCH142 reports page shows review status without changing technician workflow", () => {
  for (const text of ["مراجعة مدير الصيانة لتقرير الفريق", "تمت المراجعة", "لم تتم المراجعة", "تمت مراجعة التقرير", "ملاحظة المراجع"]) {
    assert.ok(reportsPage.includes(text), `missing review UI: ${text}`);
  }
  assert.ok(reportsPage.includes("تسجيل المراجعة يخص تقرير الفريق كاملًا"));
});

test("PATCH142 adds current workload indicators by specialty/status and average responsibility wait", () => {
  assert.match(monitoringService, /bySpecialty/);
  assert.match(monitoringService, /byStatus/);
  assert.match(monitoringService, /averageMinutes/);
  for (const text of ["المهام المفتوحة حسب التخصص", "توزيع الحالات المفتوحة", "متوسط"]) {
    assert.ok(scheduledPage.includes(text), `missing admin indicator: ${text}`);
  }
});

test("PATCH142 adds 30-day completion indicators by specialty and team", () => {
  assert.match(monitoringService, /recent30Days/);
  assert.match(monitoringService, /recentByTeam/);
  assert.match(monitoringService, /recentBySpecialty/);
  assert.ok(scheduledPage.includes("إنجاز آخر 30 يومًا"));
  assert.ok(scheduledPage.includes("حسب التخصص"));
  assert.ok(scheduledPage.includes("حسب الفريق"));
});

test("PATCH142 remains a PM V2 overlay and does not write external workflows", () => {
  const combined = `${reportService}\n${monitoringService}`;
  assert.doesNotMatch(combined, /insert\(purchaseOrders\)|update\(purchaseOrders\)|insert\(tickets\)|update\(tickets\)|insert\(inventoryTransactions\)|update\(inventoryTransactions\)/);
});
