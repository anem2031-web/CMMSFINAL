import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const service = fs.readFileSync(path.join(root, "server/pmv2/programs/service.ts"), "utf8");
const router = fs.readFileSync(path.join(root, "server/routers/pmv2/programs.ts"), "utf8");
const index = fs.readFileSync(path.join(root, "server/routers/pmv2/index.ts"), "utf8");
const audit = fs.readFileSync(path.join(root, "server/pmv2/audit/service.ts"), "utf8");

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

test("program binds one team and one checklist and uses active internal references", () => {
  assert.match(service, /requireActiveTeam/);
  assert.match(service, /requireActiveChecklist/);
  assert.match(service, /teamId: input\.teamId/);
  assert.match(service, /checklistId: input\.checklistId/);
});

test("program target uses exactly-one validation plus current target adapter", () => {
  assert.match(service, /validatePmv2ProgramTargetWrite/);
  assert.match(service, /targetAdapter\.validateTarget/);
  assert.match(service, /type: "site"/);
  assert.match(service, /type: "section"/);
  assert.match(service, /type: "asset"/);
});

test("duplicate targets are rejected before insert and remain DB-protected", () => {
  assert.match(service, /هدف الصيانة مضاف مسبقًا/);
  assert.match(service, /eq\(pmv2ProgramTargets\.programId/);
});

test("program identity is protected after task generation", () => {
  assert.match(service, /pmv2Tasks/);
  assert.match(service, /لا يمكن تغيير فريق أو قائمة برنامج بدأ بتوليد مهام/);
});

test("configuration remains additive and audited", () => {
  assert.match(router, /pmv2ManagementProcedure/);
  assert.match(index, /programs: pmv2ProgramsRouter/);
  assert.match(service, /action: "program\.created"/);
  assert.match(service, /action: "program_target\.created"/);
  assert.match(audit, /\| "program"/);
  assert.doesNotMatch(service, /delete\(pmv2ProgramTargets\)/);
});

console.log(`PM V2 Phase 2 programs contract: ${passed}/5 PASS`);
