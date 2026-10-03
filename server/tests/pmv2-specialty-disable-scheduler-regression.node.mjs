import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const repository = fs.readFileSync(path.join(root, "server/pmv2/scheduler/repository.ts"), "utf8");

assert.match(repository, /pmv2Specialties/);
assert.match(repository, /innerJoin\(pmv2Specialties, eq\(pmv2Specialties\.id, pmv2Teams\.specialtyId\)\)/);
assert.match(repository, /eq\(pmv2Specialties\.isActive, 1\)/);
assert.match(repository, /eq\(pmv2Teams\.isActive, 1\)/);
assert.match(repository, /eq\(pmv2Programs\.isActive, 1\)/);
assert.match(repository, /eq\(pmv2Checklists\.isActive, 1\)/);

console.log("PM V2 specialty disable scheduler regression: 6/6 PASS");
