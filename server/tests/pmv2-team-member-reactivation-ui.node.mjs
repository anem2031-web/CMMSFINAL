import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ui = fs.readFileSync(new URL('../../client/src/pages/pmv2/ScheduledMaintenance.tsx', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../pmv2/organization/service.ts', import.meta.url), 'utf8');

test('disabled team member exposes a reactivation action in Scheduled Maintenance UI', () => {
  assert.match(ui, /إعادة تفعيل العضوية/);
  assert.match(ui, /Number\(member\.isActive\) === 1 \? \(/);
  assert.match(ui, /addMember\.mutate\(\{ teamId: Number\(selectedTeamId\), userId: Number\(member\.userId\) \}\)/);
});

test('reactivation reuses the existing membership row instead of inserting a duplicate', () => {
  assert.match(service, /if \(existing\[0\]\) \{/);
  assert.match(service, /action = "team_member\.reactivated"/);
  assert.match(service, /set\(\{ isActive: 1, joinedAt: sql`CURRENT_TIMESTAMP`, leftAt: null \}\)/);
  assert.match(service, /return \{ id, reactivated: !!existing\[0\] \}/);
});

test('UI reports reactivation distinctly from first-time member creation', () => {
  assert.match(ui, /data\.reactivated \? "تمت إعادة تفعيل عضوية الفريق" : "تمت إضافة عضو الفريق"/);
});
