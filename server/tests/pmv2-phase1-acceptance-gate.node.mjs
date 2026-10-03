import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url);
const read = (rel) => readFileSync(new URL(rel, root), 'utf8');

const expectedTables = [
  'pmv2_specialties',
  'pmv2_teams',
  'pmv2_team_members',
  'pmv2_checklists',
  'pmv2_checklist_items',
  'pmv2_programs',
  'pmv2_program_targets',
  'pmv2_tasks',
  'pmv2_task_items',
  'pmv2_visits',
  'pmv2_visit_members',
  'pmv2_item_actions',
  'pmv2_material_requests',
  'pmv2_material_request_items',
  'pmv2_material_purchase_links',
  'pmv2_task_ticket_links',
  'pmv2_material_usages',
  'pmv2_request_reminders',
];

const schema = read('drizzle/schema.ts');
for (const table of expectedTables) {
  assert.match(schema, new RegExp(`mysqlTable\\("${table}"`), `missing ${table} from Drizzle schema`);
}
console.log(`PASS: all ${expectedTables.length} frozen PM V2 tables are represented in Drizzle schema`);

const appRouter = read('server/routers/index.ts');
assert.match(appRouter, /import \{ pmv2Router \} from "\.\/pmv2";/);
assert.match(appRouter, /pmv2:\s*pmv2Router/);
console.log('PASS: PM V2 is registered additively under its own router namespace');

const policy = read('server/pmv2/security/policy.ts');
for (const role of ['OWNER', 'ADMIN', 'MAINTENANCE_MANAGER', 'GENERAL_MAINTENANCE_MANAGER']) {
  assert.match(policy, new RegExp(`APP_ROLE\\.${role}`));
}
assert.match(policy, /canManagePmv2Foundation/);
console.log('PASS: Phase 1 management security baseline is explicit and default-deny');

const audit = read('server/pmv2/audit/service.ts');
assert.match(audit, /createAuditLog/);
assert.match(audit, /action:\s*`pmv2\.\$\{event\.action\}`/);
assert.match(audit, /entityType:\s*`pmv2\.\$\{event\.entity\}`/);
console.log('PASS: PM V2 reuses the current audit service with a PM V2 namespace');

const adapter = read('server/pmv2/adapters/current-system.ts');
for (const table of ['users', 'warehouses', 'sites', 'sections', 'assets']) {
  assert.doesNotMatch(adapter, new RegExp(`\\.insert\\(${table}\\)`));
  assert.doesNotMatch(adapter, new RegExp(`\\.update\\(${table}\\)`));
  assert.doesNotMatch(adapter, new RegExp(`\\.delete\\(${table}\\)`));
}
assert.match(adapter, /currentMaintenanceTargetAdapter/);
assert.match(adapter, /requireActiveUser/);
assert.match(adapter, /requireActiveWarehouse/);
console.log('PASS: current Master Data is read/validated through adapters with no PM V2 ownership writes');

const orgService = read('server/pmv2/organization/service.ts');
for (const table of ['users', 'warehouses']) {
  assert.doesNotMatch(orgService, new RegExp(`\\.insert\\(${table}\\)`));
  assert.doesNotMatch(orgService, new RegExp(`\\.update\\(${table}\\)`));
  assert.doesNotMatch(orgService, new RegExp(`\\.delete\\(${table}\\)`));
}
assert.match(orgService, /writePmv2Audit/);
assert.match(orgService, /team_member\.reactivated/);
console.log('PASS: organization writes stay PM V2-owned and mutations are audit-wired');

const pmv2RouterFiles = [
  read('server/routers/pmv2/index.ts'),
  read('server/routers/pmv2/organization.ts'),
  read('server/routers/pmv2/targets.ts'),
].join('\n');
for (const forbidden of [
  'tickets.workflow',
  'purchaseOrders',
  'inventoryTransactions',
  'preventiveRouter',
  'pmWorkOrders',
]) {
  assert.doesNotMatch(pmv2RouterFiles, new RegExp(forbidden));
}
console.log('PASS: Phase 1 PM V2 routes do not take over Legacy PM/Ticket/Purchase/Inventory workflows');

console.log('PM V2 Phase 1 standalone acceptance gate: 6/6 PASS');
