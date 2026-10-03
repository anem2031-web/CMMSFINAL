import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const root = path.resolve(new URL("../..", import.meta.url).pathname);
const page = fs.readFileSync(path.join(root, "client/src/pages/pmv2/ScheduledMaintenance.tsx"), "utf8");

assert.match(page, /const taskListInput = useMemo\(\(\) => \(\{[\s\S]*?pageSize: 20,/);
assert.match(page, /const tasksQuery = trpc\.pmv2\.tasks\.list\.useQuery\(taskListInput\)/);
assert.doesNotMatch(page, /const taskListInput = useMemo\(\(\) => \(\{[\s\S]*?pageSize: 25,/);
assert.match(page, />السابق<\/Button>/);
assert.match(page, />التالي<\/Button>/);
console.log("PASS PM V2 task page size = 20 with previous/next pager");
