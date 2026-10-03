import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("client/src/pages/pmv2/ScheduledMaintenance.tsx", "utf8");
assert.match(page, /dateFrom && dateFrom === dateTo/);
assert.match(page, /setRunDate\(dateFrom\)/);
assert.match(page, /setSchedulerProgramId\(""\)/);
assert.match(page, /استخدام تاريخ البحث/);
assert.match(page, /اختر التاريخ أولًا/);
console.log("PM V2 manual scheduler date helper: 5/5 PASS");
