import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript");
const root = process.cwd();
let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`PASS ${name}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

test("DDL adds structured recurrence snapshot columns to task items", () => {
  const sql = read("drizzle/2026_09_09_pmv2_task_item_recurrence_snapshot.sql");
  assert.match(sql, /ALTER TABLE `pmv2_task_items`/);
  assert.match(sql, /`frequencySnapshot` ENUM\('daily','weekly','monthly','quarterly','biannual','annual'\)/);
  assert.match(sql, /`frequencyValueSnapshot` INT NULL/);
  assert.match(sql, /`weekdaySnapshot` TINYINT NULL/);
  assert.match(sql, /`monthDaySnapshot` TINYINT NULL/);
  assert.match(sql, /`anchorDateSnapshot` DATE NULL/);
});

test("scheduler persists recurrence configuration when generating a task item", () => {
  const engine = read("server/pmv2/scheduler/engine.ts");
  const repo = read("server/pmv2/scheduler/repository.ts");
  for (const token of ["frequencySnapshot", "frequencyValueSnapshot", "weekdaySnapshot", "monthDaySnapshot", "anchorDateSnapshot"]) {
    assert.match(engine, new RegExp(`${token}: item\\.`));
    assert.match(repo, new RegExp(`${token}:`));
  }
  assert.match(repo, /db\.insert\(pmv2TaskItems\)\.values\(\{\s*\.\.\.input,/s);
});

test("historical reader imports the checklist-item table it joins", () => {
  const source = read("server/pmv2/tasks/read-service.ts");
  const schemaImport = source.match(/import\s*\{([\s\S]*?)\}\s*from "\.\.\/\.\.\/\.\.\/drizzle\/schema";/);
  assert.ok(schemaImport, "drizzle/schema import block is missing");
  assert.match(schemaImport[1], /\bpmv2ChecklistItems\b/);
});

test("historical reader prefers persisted snapshot and falls back for pre-patch rows", () => {
  const source = read("server/pmv2/tasks/read-service.ts");
  assert.match(source, /coalesce\(\$\{pmv2TaskItems\.frequencySnapshot\}, \$\{pmv2ChecklistItems\.frequency\}\)/);
  assert.match(source, /case when \$\{pmv2TaskItems\.frequencySnapshot\} is null then \$\{pmv2ChecklistItems\.weekday\}/);
  assert.match(source, /innerJoin\(pmv2ChecklistItems/);
});

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "pmv2-recurrence-label-"));
const helperSource = read("client/src/pages/pmv2/recurrence-label.ts");
const helperJs = ts.transpileModule(helperSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
fs.writeFileSync(path.join(temp, "recurrence-label.mjs"), helperJs);
const { formatPmv2RecurrenceLabel } = await import(pathToFileURL(path.join(temp, "recurrence-label.mjs")).href);

test("Arabic recurrence badge labels are manager-readable", () => {
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "daily" }), "يوميًا");
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "weekly", frequencyValueSnapshot: 1, weekdaySnapshot: 1 }), "كل أسبوع • الاثنين");
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "weekly", frequencyValueSnapshot: 2, weekdaySnapshot: 1 }), "كل أسبوعين • الاثنين");
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "monthly", monthDaySnapshot: 10 }), "كل شهر • يوم 10");
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "monthly", monthDaySnapshot: 31 }), "كل شهر • يوم 31 (نهاية الشهر عند الحاجة)");
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "quarterly" }), "كل 3 أشهر");
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "biannual" }), "كل 6 أشهر");
  assert.equal(formatPmv2RecurrenceLabel({ frequencySnapshot: "annual" }), "سنويًا");
});

test("Scheduled Maintenance renders the recurrence badge beside each historical item", () => {
  const ui = read("client/src/pages/pmv2/ScheduledMaintenance.tsx");
  assert.match(ui, /formatPmv2RecurrenceLabel\(item\)/);
  assert.match(ui, /<Badge variant="outline">\{formatPmv2RecurrenceLabel\(item\)\}<\/Badge>/);
});

console.log(`PM V2 task-item recurrence snapshot: ${passed}/6 PASS`);
