import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const validationPath = path.join(root, "server/pmv2/checklists/validation.ts");
const servicePath = path.join(root, "server/pmv2/checklists/service.ts");
const routerPath = path.join(root, "server/routers/pmv2/checklists.ts");
const indexPath = path.join(root, "server/routers/pmv2/index.ts");
const auditPath = path.join(root, "server/pmv2/audit/service.ts");

const validation = await import(pathToFileURL(validationPath).href);
const service = fs.readFileSync(servicePath, "utf8");
const router = fs.readFileSync(routerPath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");
const audit = fs.readFileSync(auditPath, "utf8");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

const base = {
  checklistId: 1,
  title: "فحص الفلتر",
  sortOrder: 0,
  isRequired: true,
  isActive: true,
  frequencyValue: null,
  weekday: null,
  monthDay: null,
  anchorDate: null,
};

test("all frozen recurrence frequency values are accepted with their required shape", () => {
  const configs = {
    daily: { ...base, frequency: "daily" },
    weekly: { ...base, frequency: "weekly", weekday: 1 },
    monthly: { ...base, frequency: "monthly", monthDay: 15 },
    quarterly: { ...base, frequency: "quarterly", anchorDate: "2026-01-31" },
    biannual: { ...base, frequency: "biannual", anchorDate: "2026-01-31" },
    annual: { ...base, frequency: "annual", anchorDate: "2024-02-29" },
  };
  for (const frequency of validation.PMV2_CHECKLIST_FREQUENCIES) {
    const result = validation.validatePmv2ChecklistItemWrite(configs[frequency]);
    assert.equal(result.frequency, frequency);
  }
});

test("invalid TiDB-unenforced recurrence ranges are rejected by PM V2", () => {
  assert.throws(() => validation.validatePmv2ChecklistItemWrite({ ...base, frequency: "daily", frequencyValue: 0 }));
  assert.throws(() => validation.validatePmv2ChecklistItemWrite({ ...base, frequency: "weekly", weekday: 7 }));
  assert.throws(() => validation.validatePmv2ChecklistItemWrite({ ...base, frequency: "monthly", monthDay: 32 }));
});

test("checklist service is reusable and soft-state based", () => {
  assert.match(service, /createChecklist\(/);
  assert.match(service, /updateChecklist\(/);
  assert.match(service, /listChecklists\(/);
  assert.match(service, /createItem\(/);
  assert.match(service, /updateItem\(/);
  assert.match(service, /patch\.isActive = input\.isActive \? 1 : 0/);
  assert.doesNotMatch(service, /delete\(pmv2Checklists\)/);
  assert.doesNotMatch(service, /delete\(pmv2ChecklistItems\)/);
});

test("every checklist-item write reuses the central validation boundary", () => {
  const calls = service.match(/validatePmv2ChecklistItemWrite\(/g) || [];
  assert.equal(calls.length, 2);
});

test("configuration mutations are audited in the shared CMMS audit log", () => {
  assert.match(service, /action: "checklist\.created"/);
  assert.match(service, /action: "checklist\.updated"/);
  assert.match(service, /action: "checklist_item\.created"/);
  assert.match(service, /action: "checklist_item\.updated"/);
  assert.match(audit, /\| "checklist"/);
  assert.match(audit, /\| "checklist_item"/);
});

test("PM V2 API namespace exposes the checklist router without touching legacy routers", () => {
  assert.match(router, /pmv2ManagementProcedure/);
  assert.match(index, /checklists: pmv2ChecklistsRouter/);
  assert.doesNotMatch(router, /preventive|legacy/i);
});

console.log(`PM V2 Phase 2 checklist contract: ${passed}/6 PASS`);
