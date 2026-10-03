import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const page = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');

test('program target selector derives linked ids from the selected program', () => {
  assert.match(page, /const linkedTargetIds = new Set/);
  assert.match(page, /programQuery\.data\?\.targets \?\? \[\]/);
  assert.match(page, /target\.siteId/);
  assert.match(page, /target\.sectionId/);
  assert.match(page, /target\.assetId/);
});

test('already-linked targets are excluded from the target dropdown', () => {
  assert.match(page, /availableTargets\.filter\(\(item: any\) => !linkedTargetIds\.has\(Number\(item\.id\)\)\)/);
});

test('target options refresh when selected program target data changes', () => {
  assert.match(page, /programQuery\.data\?\.targets,/);
  assert.match(page, /onSuccess: async \(\) => \{/);
  assert.match(page, /await programQuery\.refetch\(\)/);
});

test('switching programs clears any stale selected target', () => {
  assert.match(page, /setSelectedProgramId\(String\(program\.id\)\); setTargetId\(""\);/);
});

test('empty target type clearly states there are no unlinked options', () => {
  assert.match(page, /disabled=\{targetOptions\.length === 0\}/);
  assert.match(page, /لا توجد أهداف غير مرتبطة من هذا النوع/);
});
