import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const execution = read("server/pmv2/technician/execution-service.ts");
const router = read("server/routers/pmv2/technician.ts");
const timeline = read("server/pmv2/tracking/timeline-service.ts");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");

const resumeSlice = execution.slice(execution.indexOf("async resumeItem("), execution.indexOf("async submitBasicResult("));

test("PATCH138 resumes only the same material-blocked Task Item after materials are ready", () => {
  assert.match(resumeSlice, /row\.itemStatus !== "ready_to_complete" \|\| row\.itemResult !== "needs_material"/);
  assert.match(resumeSlice, /continuationOfSameTask: true/);
  assert.match(resumeSlice, /status: "in_progress"/);
  assert.match(resumeSlice, /action: "resume_execution"/);
  assert.doesNotMatch(resumeSlice, /insert\(pmv2Tasks\)/);
});

test("PATCH138 reuses an open visit or creates a continuation visit on the same task", () => {
  assert.match(resumeSlice, /eq\(pmv2Visits\.taskId, row\.taskId\)/);
  assert.match(resumeSlice, /isNull\(pmv2Visits\.endedAt\)/);
  assert.match(resumeSlice, /insert\(pmv2Visits\)\.values\(\{ taskId: row\.taskId \}\)/);
  assert.match(resumeSlice, /insert\(pmv2VisitMembers\)/);
});

test("resumed material completion still declares usage and returns before closing the item", () => {
  assert.match(execution, /resumedMaterialCompletion = row\.itemStatus === "in_progress" && row\.itemResult === "needs_material"/);
  assert.match(execution, /row\.itemStatus === "ready_to_complete" \|\| resumedMaterialCompletion/);
  assert.match(execution, /declareConsumptionWithDb\(/);
  assert.match(execution, /itemStatus: "completed"/);
});

test("technician router exposes continuation and timeline through PM V2 only", () => {
  assert.match(router, /timeline: pmv2TechnicianProcedure/);
  assert.match(router, /pmv2TaskTimelineService\.getForTechnician/);
  assert.match(router, /resumeItem: pmv2TechnicianProcedure/);
  assert.match(router, /pmv2TechnicianExecutionService\.resumeItem/);
});

test("timeline derives current responsibility from material, purchase and ticket source truth", () => {
  for (const token of [
    "pmv2MaterialRequestItems",
    "pmv2MaterialPurchaseLinks",
    "purchaseOrderItems",
    "purchaseOrders",
    "pmv2TaskTicketLinks",
    "ticketStatusHistory",
    "tickets",
    "auditLogs",
  ]) assert.ok(timeline.includes(token), `missing timeline source: ${token}`);
  assert.match(timeline, /بانتظار الشراء من المندوب/);
  assert.match(timeline, /بانتظار اعتماد الحسابات/);
  assert.match(timeline, /بانتظار اعتماد الإدارة العليا/);
  assert.match(timeline, /تم الشراء — بانتظار استكمال المستودع/);
  assert.match(timeline, /المواد جاهزة — بانتظار استكمال الفني/);
  assert.match(timeline, /purchaseLinksByRequest\.get\(Number\(activeRequest\.requestItemId\)\)/);
  assert.match(timeline, /ticket_closed_completion/);
});

test("timeline is read-only toward existing purchase, ticket and inventory workflows", () => {
  assert.doesNotMatch(timeline, /\.insert\(purchaseOrders\)|\.update\(purchaseOrders\)|\.delete\(purchaseOrders\)/);
  assert.doesNotMatch(timeline, /\.insert\(purchaseOrderItems\)|\.update\(purchaseOrderItems\)|\.delete\(purchaseOrderItems\)/);
  assert.doesNotMatch(timeline, /\.insert\(tickets\)|\.update\(tickets\)|\.delete\(tickets\)/);
  assert.doesNotMatch(timeline, /\.insert\(ticketStatusHistory\)|\.update\(ticketStatusHistory\)|\.delete\(ticketStatusHistory\)/);
});

test("timeline reports stage durations and current role/person without declaring lateness", () => {
  assert.match(timeline, /type TimelineSegment/);
  assert.match(timeline, /stageSegments/);
  assert.match(timeline, /responsibilityDurations/);
  assert.match(timeline, /responsibleUserName/);
  assert.match(timeline, /currentResponsibility/);
  assert.doesNotMatch(timeline, /متأخر|متأخرة|\\blate\\b|\\boverdue\\b/i);
});

test("technician UI makes continuation explicit and exposes responsibility/time history", () => {
  for (const text of [
    "استكمال العمل",
    "المواد جاهزة — يمكن استكمال نفس المهمة",
    "مسار المهمة والزمن",
    "العالق الآن:",
    "الجهة:",
    "المسؤول:",
    "الوقت حسب الجهة / المسؤول",
    "تفصيل مدد مراحل المهمة",
    "لا تُصنّف كتأخير إلا بعد اعتماد SLA",
  ]) assert.ok(page.includes(text), `missing PATCH138 UI text: ${text}`);
});

test("PATCH138 requires no new schema or SQL migration", () => {
  assert.match(timeline, /pmv2Visits/);
  assert.match(timeline, /pmv2ItemActions/);
  assert.match(execution, /action: "resume_execution"/);
  // Existing varchar action + visits are intentionally reused; the patch test itself
  // protects against introducing a separate Task/Timeline persistence model here.
  assert.doesNotMatch(resumeSlice, /timeline_events|followup_tasks|continuation_tasks/);
});
