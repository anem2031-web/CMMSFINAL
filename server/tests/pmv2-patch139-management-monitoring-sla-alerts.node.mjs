import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const timeline = read("server/pmv2/tracking/timeline-service.ts");
const monitoring = read("server/pmv2/monitoring/service.ts");
const sla = read("server/pmv2/monitoring/sla-service.ts");
const alerts = read("server/pmv2/monitoring/alert-service.ts");
const scheduler = read("server/pmv2/monitoring/alert-scheduler.ts");
const router = read("server/routers/pmv2/monitoring.ts");
const pmv2Index = read("server/routers/pmv2/index.ts");
const page = read("client/src/pages/pmv2/ScheduledMaintenance.tsx");
const schema = read("drizzle/schema.ts");
const migration = read("drizzle/2026_09_26_pmv2_monitoring_sla_alerts.sql");

test("PATCH139 adds management timeline access without weakening technician membership checks", () => {
  assert.match(timeline, /private async buildTimeline\(taskId: number, technicianUserId: number \| null, enforceTechnicianMembership: boolean\)/);
  assert.match(timeline, /async getForTechnician\(userId: number, taskId: number\)/);
  assert.match(timeline, /return this\.buildTimeline\(taskId, userId, true\)/);
  assert.match(timeline, /async getForManagement\(taskId: number\)/);
  assert.match(timeline, /return this\.buildTimeline\(taskId, null, false\)/);
});

test("PATCH139 monitoring derives open-task responsibility and executive metrics from PM V2 timeline", () => {
  assert.match(monitoring, /notInArray\(pmv2Tasks\.status, \["completed", "cancelled"\]\)/);
  assert.match(monitoring, /pmv2TaskTimelineService\.getForManagement/);
  assert.match(monitoring, /currentResponsibility/);
  assert.match(monitoring, /byRole/);
  assert.match(monitoring, /byPerson/);
  assert.match(monitoring, /byTeam/);
  assert.match(monitoring, /byAsset/);
  assert.match(monitoring, /totalWorkMinutes/);
  assert.match(monitoring, /totalWaitingMinutes/);
});

test("PATCH139 exposes manager monitoring, detail, SLA settings and alert sweep through PM V2 management guard", () => {
  assert.match(router, /overview: pmv2ManagementProcedure/);
  assert.match(router, /taskDetail: pmv2ManagementProcedure/);
  assert.match(router, /slaRules: pmv2ManagementProcedure/);
  assert.match(router, /updateSlaRule: pmv2ManagementProcedure/);
  assert.match(router, /runAlertSweep: pmv2ManagementProcedure/);
  assert.match(pmv2Index, /monitoring: pmv2MonitoringRouter/);
});

test("PATCH139 SLA stays unclassified until a PM V2 rule is explicitly configured", () => {
  assert.match(sla, /slaMinutes: row\?\.slaMinutes == null \? null/);
  assert.match(sla, /status: "not_configured"/);
  assert.match(sla, /status: breachMinutes > 0 \? "overdue"/);
  assert.match(sla, /reminderMinutes/);
  assert.ok(sla.includes("يلزم تطبيق ترحيل PATCH139"));
});

test("PATCH139 alerts reuse the existing notification system and dedupe PM V2 deliveries", () => {
  assert.match(alerts, /createNotification/);
  assert.match(alerts, /pmv2AlertDeliveries/);
  assert.match(alerts, /dedupeKey/);
  assert.match(alerts, /alertType: "responsibility"/);
  assert.match(alerts, /alertType: "reminder"/);
  assert.match(alerts, /alertType: "sla"/);
  assert.doesNotMatch(alerts, /insert\(purchaseOrders\)|update\(purchaseOrders\)|insert\(tickets\)|update\(tickets\)|insert\(inventory\)|update\(inventory\)/);
});

test("PATCH139 runs a PM V2-scoped periodic alert sweep without changing the global scheduler", () => {
  assert.match(scheduler, /5 \* 60 \* 1000/);
  assert.match(scheduler, /pmv2AlertService\.sweep/);
  assert.match(pmv2Index, /ensurePmv2AlertScheduler\(\)/);
});

test("PATCH139 management UI shows responsibility, elapsed time, owner indicators, timeline and SLA controls", () => {
  for (const text of [
    "متابعة المهام المعلقة",
    "من بيده الإجراء الآن",
    "المسؤول الحالي",
    "منذ",
    "مؤشرات المالك التنفيذية",
    "أين العمل عالق الآن؟",
    "المسؤولون الحاليون",
    "تفصيل مراحل المهمة والمسؤولية",
    "الوقت حسب الجهة / الشخص",
    "SLA والتذكيرات",
    "SLA غير محدد",
    "فحص التنبيهات الآن",
  ]) assert.ok(page.includes(text), `missing PATCH139 UI text: ${text}`);
});

test("PATCH139 owner indicators are role-aware and do not label asset tasks as confirmed downtime", () => {
  assert.match(page, /userRole === "owner" \|\| userRole === "admin"/);
  assert.ok(page.includes("الأصول الأكثر لديها مهام مفتوحة"));
  assert.ok(!page.includes("الأصول المتوقفة عن العمل"));
});

test("PATCH139 persistence is bounded to new PM V2 SLA and alert-delivery tables", () => {
  assert.match(schema, /export const pmv2SlaRules = mysqlTable\("pmv2_sla_rules"/);
  assert.match(schema, /export const pmv2AlertDeliveries = mysqlTable\("pmv2_alert_deliveries"/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `pmv2_sla_rules`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `pmv2_alert_deliveries`/);
  assert.doesNotMatch(migration, /ALTER TABLE `purchase_orders`|ALTER TABLE `tickets`|ALTER TABLE `inventory`/);
});

test("PATCH139 keeps manager dashboard read-only toward external workflow state", () => {
  for (const source of [monitoring, timeline]) {
    assert.doesNotMatch(source, /\.insert\(purchaseOrders\)|\.update\(purchaseOrders\)|\.delete\(purchaseOrders\)/);
    assert.doesNotMatch(source, /\.insert\(tickets\)|\.update\(tickets\)|\.delete\(tickets\)/);
  }
});
