import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('client/src/pages/pmv2/ScheduledMaintenance.tsx', 'utf8');
const router = fs.readFileSync('server/routers/pmv2/programs.ts', 'utf8');
const service = fs.readFileSync('server/pmv2/programs/service.ts', 'utf8');

assert.match(ui, /تعديل البرنامج/);
assert.match(ui, /المدة التقديرية للمهمة \(دقيقة\)/);
assert.match(ui, /حفظ التعديلات/);
assert.match(ui, /estimatedDurationMinutes: durationText \? Number\(durationText\) : null/);
assert.match(ui, /formatEstimatedDuration/);
assert.match(router, /estimatedDurationMinutes: z\.number\(\)\.int\(\)\.positive\(\)\.nullable\(\)\.optional\(\)/);
assert.match(service, /estimatedDurationMinutes: pmv2Programs\.estimatedDurationMinutes/);
assert.match(service, /patch\.estimatedDurationMinutes = input\.estimatedDurationMinutes/);
console.log('PM V2 program duration edit UI regression: PASS');
