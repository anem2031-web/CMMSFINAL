import assert from "node:assert/strict";
import fs from "node:fs";

const ui = fs.readFileSync("client/src/pages/pmv2/ScheduledMaintenance.tsx", "utf8");
const service = fs.readFileSync("server/pmv2/tasks/read-service.ts", "utf8");
const router = fs.readFileSync("server/routers/pmv2/tasks.ts", "utf8");

assert.match(ui, /function WorkloadTab\(\{ onOpenOverdue \}/);
assert.match(ui, /value="workload"/);
assert.match(ui, />حمل الفرق</);
assert.match(ui, /pmv2\.tasks\.dailyWorkload\.useQuery/);
assert.match(ui, /الأسبوع السابق/);
assert.match(ui, /هذا الأسبوع/);
assert.match(ui, /الأسبوع التالي/);
assert.match(ui, /متاح/);
assert.match(ui, /متوسط/);
assert.match(ui, /مرتفع/);
assert.match(ui, /تعارض/);
assert.match(ui, /مدة ناقصة/);
assert.match(ui, /مهام اليوم المختار/);
assert.match(ui, /selectedCell\.teamId/);
assert.match(ui, /dateFrom: selectedCell\.date/);
assert.match(ui, /dateTo: selectedCell\.date/);
assert.match(ui, /excludeCancelled: true/);

// Patch 069: keep the weekly view simple but operational for the manager.
assert.match(ui, /useState<"remaining" \| "full">\("remaining"\)/);
assert.match(ui, /من اليوم وما بعده/);
assert.match(ui, /الأسبوع كامل/);
assert.match(ui, /date >= today/);
assert.match(ui, /كل الفرق/);
assert.match(ui, /teamId: selectedTeamId/);
assert.match(ui, /overdueBefore: today/);
assert.match(ui, /excludeFinished: true/);
assert.match(ui, /enabled: isCurrentWeek/);
assert.match(ui, /لا تُضاف تلقائيًا إلى حمل اليوم/);
assert.match(ui, /المهام المجدولة ← المتأخرة/);
assert.match(ui, /date < today/);
assert.match(ui, /اليوم/);

// Patch 070: overdue alert is actionable and preserves the selected team when opening task details.
assert.match(ui, /onClick=\{\(\) => onOpenOverdue\(teamFilter\)\}/);
assert.match(ui, /اضغط لعرضها مباشرة في «المهام المجدولة ← المتأخرة»/);
assert.match(ui, /const \[activeTab, setActiveTab\] = useState\("tasks"\)/);
assert.match(ui, /setScope\(navigation\.scope\)/);
assert.match(ui, /setTeamFilter\(navigation\.teamId\)/);
assert.match(ui, /navigation=\{taskNavigation\}/);
assert.match(ui, /<WorkloadTab onOpenOverdue=\{openOverdueTasks\} \/>/);

assert.match(service, /excludeCancelled\?: boolean/);
assert.match(service, /else if \(filters\.excludeCancelled\)/);
assert.match(router, /excludeCancelled: z\.boolean\(\)\.optional\(\)/);

// Patch 073: each task in the selected workload cell shows the same estimated duration basis used by workload totals.
assert.match(service, /estimatedDurationMinutes: pmv2Programs\.estimatedDurationMinutes/);
assert.match(ui, /المدة التقديرية:/);
assert.match(ui, /task\.estimatedDurationMinutes == null \? "غير محددة" : formatCompactDuration\(task\.estimatedDurationMinutes\)/);

console.log("PM V2 simple operational team workload view regression: PASS");
