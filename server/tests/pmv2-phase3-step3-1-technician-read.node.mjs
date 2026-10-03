import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const schema = read("drizzle/schema.ts");
const roles = read("shared/roles.ts");
const policy = read("server/pmv2/security/policy.ts");
const procedures = read("server/pmv2/security/procedures.ts");
const service = read("server/pmv2/technician/read-service.ts");
const router = read("server/routers/pmv2/technician.ts");
const routerIndex = read("server/routers/pmv2/index.ts");
const app = read("client/src/App.tsx");
const dashboard = read("client/src/components/layout/DashboardLayout.tsx");
const page = read("client/src/pages/pmv2/Pmv2MyTasks.tsx");

test("snapshot schema includes Patch 078 program title without new SQL", () => {
  const block = schema.match(/export const pmv2Programs = mysqlTable\("pmv2_programs", \{[\s\S]*?\n\},\n\(table\)/)?.[0] ?? "";
  assert.match(block, /title: varchar\(\{ length: 200 \}\)/);
});

test("technician execution permission is separate from PM V2 management", () => {
  assert.match(roles, /PMV2_TECHNICIAN_EXECUTION_ROLES = \[[\s\S]*APP_ROLE\.TECHNICIAN[\s\S]*APP_ROLE\.IT_MANAGER[\s\S]*\]/);
  assert.match(roles, /PMV2_MANAGEMENT_ROLES = \[[\s\S]*APP_ROLE\.OWNER[\s\S]*APP_ROLE\.ADMIN[\s\S]*APP_ROLE\.MAINTENANCE_MANAGER[\s\S]*APP_ROLE\.GENERAL_MAINTENANCE_MANAGER/);
  assert.doesNotMatch(policy, /PMV2_FOUNDATION_MANAGEMENT_ROLES[\s\S]*APP_ROLE\.TECHNICIAN/);
  assert.match(procedures, /pmv2TechnicianProcedure = protectedProcedure\.use/);
  assert.match(procedures, /canAccessPmv2TechnicianExecution\(ctx\.user\.role\)/);
});

test("technician task feed is scoped by active team membership and Riyadh date boundary", () => {
  assert.match(service, /getRiyadhDateOnly/);
  assert.match(service, /eq\(pmv2TeamMembers\.teamId, pmv2Tasks\.teamId\)/);
  assert.match(service, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(service, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(service, /lte\(pmv2Tasks\.dueDate, date\)/);
  assert.match(service, /ne\(pmv2Tasks\.status, "completed"\)/);
  assert.match(service, /sql<boolean>`exists \(/);
  assert.match(service, /pmv2Visits\.taskId/);
  assert.match(service, /pmv2Visits\.endedAt/);
  assert.match(service, /ne\(pmv2Tasks\.status, "cancelled"\)/);
  assert.match(service, /completedItemCount/);
});

test("task item read rechecks membership to prevent cross-team access", () => {
  const method = service.match(/async listTaskItems\([\s\S]*?\n  \}\n\}/)?.[0] ?? "";
  assert.match(method, /eq\(pmv2TeamMembers\.userId, userId\)/);
  assert.match(method, /eq\(pmv2TeamMembers\.isActive, 1\)/);
  assert.match(method, /where\(eq\(pmv2Tasks\.id, taskId\)\)/);
  assert.match(method, /Pmv2TechnicianAccessError/);
  assert.match(router, /code: "NOT_FOUND"/);
});

test("technician API is registered under the PM V2 namespace", () => {
  assert.match(routerIndex, /technician: pmv2TechnicianRouter/);
  assert.match(router, /today: pmv2TechnicianProcedure/);
  assert.match(router, /items: pmv2TechnicianProcedure/);
});

test("mobile My Tasks surface remains routed to technician role with Step 3.1 reads preserved", () => {
  assert.match(app, /path="\/scheduled-maintenance\/my-tasks" component=\{Pmv2MyTasks\}/);
  assert.match(dashboard, /labelKey: "nav\.pmv2MyTasks"[\s\S]*roles: \["technician","it_manager"\]/);
  assert.match(roles, /matchesPrefix\(normalizedPath, "\/scheduled-maintenance\/my-tasks"\)/);
  assert.match(page, /مهامي اليوم/);
  assert.match(page, /trpc\.pmv2\.technician\.today\.useQuery/);
  assert.match(page, /trpc\.pmv2\.technician\.items\.useQuery/);
});
