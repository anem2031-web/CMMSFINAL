import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const plan = read('docs/pmv2/01_PLAN.md');
const status = read('docs/pmv2/06_IMPLEMENTATION_STATUS.md');
const decisions = read('docs/pmv2/08_DECISIONS.md');
const testing = read('docs/pmv2/09_TESTING.md');
const checkpoint = read('docs/pmv2/14_HANDOFF_CHECKPOINT.md');
const readme = read('docs/pmv2/README.md');

test('Phase 2 final closure is authoritative across primary PM V2 docs', () => {
  assert.match(plan, /Phase 2 CLOSED\/PASS — final acceptance بتاريخ 2026-09-12/);
  assert.match(status, /Phase 2 CLOSED \/ PASS \(final acceptance\)/);
  assert.match(status, /المرحلة 2 — إعداد خطط الصيانة وتوليد المهام — CLOSED \/ PASS/);
  assert.match(readme, /المرحلة 2:\*\* \*\*CLOSED \/ PASS\*\* — final acceptance بتاريخ 2026-09-12/);
  assert.match(checkpoint, /Phase 2 = \*\*CLOSED\/PASS \(final acceptance\)\*\*/);
});

test('skipped manual checks stay explicitly SKIPPED rather than PASS', () => {
  assert.match(testing, /SKIPPED by explicit user decision:[\s\S]*كل 3 أيام/);
  assert.match(testing, /SKIPPED by explicit user decision:[\s\S]*multiple dates inside one cycle/);
  assert.match(testing, /Skipped items above are intentionally \*\*not counted as PASS\*\*/);
  assert.match(decisions, /tests the user chose not to execute are recorded as \*\*SKIPPED\*\*, never silently promoted to PASS/);
});

test('Phase 3 remains ready and not started', () => {
  assert.match(status, /Phase 3 READY \/ NOT STARTED/);
  assert.match(checkpoint, /Phase 3 = \*\*READY \/ NOT STARTED\*\*/);
  assert.match(decisions, /Phase 3 remains \*\*READY \/ NOT STARTED\*\*/);
});
