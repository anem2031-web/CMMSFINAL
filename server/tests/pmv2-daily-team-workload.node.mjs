import assert from "node:assert/strict";
import fs from "node:fs";
import {
  PMV2_DAILY_TEAM_CAPACITY_MINUTES,
  classifyPmv2DailyWorkload,
} from "../pmv2/tasks/workload.ts";

assert.equal(PMV2_DAILY_TEAM_CAPACITY_MINUTES, 480);
assert.equal(classifyPmv2DailyWorkload(0), "available");
assert.equal(classifyPmv2DailyWorkload(240), "available");
assert.equal(classifyPmv2DailyWorkload(241), "medium");
assert.equal(classifyPmv2DailyWorkload(360), "medium");
assert.equal(classifyPmv2DailyWorkload(361), "high");
assert.equal(classifyPmv2DailyWorkload(480), "high");
assert.equal(classifyPmv2DailyWorkload(481), "conflict");

const service = fs.readFileSync("server/pmv2/tasks/read-service.ts", "utf8");
const router = fs.readFileSync("server/routers/pmv2/tasks.ts", "utf8");

assert.match(service, /listDailyTeamWorkload/);
assert.match(service, /pmv2Programs\.estimatedDurationMinutes/);
assert.match(service, /unknownDurationTaskCount/);
assert.match(service, /estimateComplete/);
assert.match(service, /notInArray\(pmv2Tasks\.status, \["cancelled"\]\)/);
assert.match(service, /groupBy\(pmv2Tasks\.teamId, pmv2Teams\.code, pmv2Tasks\.dueDate\)/);
assert.match(router, /dailyWorkload: pmv2ManagementProcedure/);
assert.match(router, /dateFrom: isoDate/);
assert.match(router, /dateTo: isoDate/);
assert.match(router, /value\.dateFrom <= value\.dateTo/);

console.log("PM V2 daily team workload calculation regression: PASS");
