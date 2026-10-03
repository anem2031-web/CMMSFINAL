import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const roles = read("shared/roles.ts");
const dashboard = read("client/src/components/layout/DashboardLayout.tsx");
const notifications = read("server/_core/db/notifications.ts");
const ticketRouter = read("server/routers/tickets/tickets.router.ts");
const schedulerRepo = read("server/pmv2/scheduler/repository.ts");
const handoff = read("server/pmv2/materials/team-issue-handoff-service.ts");
const organization = read("server/pmv2/organization/service.ts");
const policy = read("server/_core/authz/policy.ts");
const purchaseDb = read("server/_core/db/purchase.ts");
const ticketAccess = read("server/routers/tickets/tickets.access.ts");
const purchaseWorkflow = read("server/routers/purchase/ticket-purchase-workflow.ts");

// Phase 1: independent role, direct IT routing, and read-only oversight.
test("phase 1 IT ticket routing/access remains scoped", () => {
  assert.match(roles, /IT_MANAGER:\s*"it_manager"/);
  assert.match(roles, /IT:\s*"maintenance_report_department_it"/);
  assert.match(ticketRouter, /بلاغ تقنية معلومات جديد/);
  assert.match(ticketRouter, /allowItManager:\s*true/);
  assert.match(ticketAccess, /role === APP_ROLE\.IT_MANAGER/);
  assert.match(ticketAccess, /MAINTENANCE_RESPONSIBLE_DEPARTMENT\.IT/);
});

// Phase 2: same purchase workflow, own visibility, no reviewer promotion.
test("phase 2 purchase authority remains requester-only for IT", () => {
  assert.match(policy, /\[ROLE\.IT_MANAGER\]:\s*\{\s*kind:\s*"own"\s*\}/);
  assert.match(purchaseWorkflow, /APP_ROLE\.IT_MANAGER/);
  assert.doesNotMatch(policy, /reviewItems[^\n]*IT_MANAGER/);
  const managerFn = purchaseDb.match(/export async function getPurchaseManagerUsers\(\)[\s\S]*?\n\}/)?.[0] ?? "";
  assert.doesNotMatch(managerFn, /IT_MANAGER|it_manager/);
});

// Phase 3: execution access only; management remains unchanged.
test("IT manager executes PM V2 team tasks without PM V2 management", () => {
  assert.match(roles, /PMV2_TECHNICIAN_EXECUTION_ROLES = \[[\s\S]*APP_ROLE\.TECHNICIAN[\s\S]*APP_ROLE\.IT_MANAGER[\s\S]*\]/);
  const management = roles.match(/PMV2_MANAGEMENT_ROLES = \[[\s\S]*?\] as const;/)?.[0] ?? "";
  assert.doesNotMatch(management, /IT_MANAGER/);
  assert.match(dashboard, /labelKey: "nav\.pmv2MyTasks"[\s\S]*roles: \["technician","it_manager"\]/);
  assert.match(roles, /matchesPrefix\(normalizedPath, "\/scheduled-maintenance\/my-tasks"\)[\s\S]*canRoleExecutePmv2Technician/);
});


test("IT manager team membership is restricted to the specialty he manages", () => {
  assert.match(organization, /memberUser\.role === APP_ROLE\.IT_MANAGER/);
  assert.match(organization, /pmv2Specialties\.managerUserId/);
  assert.match(organization, /specialtyManagerUserId[\s\S]*Number\(userId\)/);
  assert.match(organization, /مدير تقنية المعلومات يمكن إضافته فقط إلى فريق تابع للتخصص الذي يديره/);
});

test("PM V2 material handoff uses execution roles and active team membership", () => {
  assert.match(handoff, /PMV2_TECHNICIAN_EXECUTION_ROLES/);
  assert.match(handoff, /inArray\(users\.role, \[\.\.\.PMV2_TECHNICIAN_EXECUTION_ROLES\] as any\)/);
  assert.match(handoff, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(handoff, /eq\(users\.isActive, 1\)/);
  assert.doesNotMatch(handoff, /eq\(users\.role, "technician"\)/);
});

test("IT notification policy is default-deny with only the two explicit exceptions", () => {
  assert.match(notifications, /allowItManager\?: boolean/);
  assert.match(notifications, /recipient\?\.role === APP_ROLE\.IT_MANAGER && !data\.allowItManager/);
  assert.match(ticketRouter, /title: "بلاغ تقنية معلومات جديد"[\s\S]*allowItManager: true/);
  assert.match(schedulerRepo, /title: "مهمة صيانة مجدولة جديدة"[\s\S]*allowItManager: true/);
  assert.match(schedulerRepo, /eq\(users\.role, APP_ROLE\.IT_MANAGER\)/);
  assert.match(schedulerRepo, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(schedulerRepo, /eq\(users\.isActive, 1\)/);
});
