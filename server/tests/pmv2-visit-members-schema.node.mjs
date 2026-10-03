import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../drizzle/2026_09_08_pmv2_visit_members.sql", import.meta.url), "utf8");

const tests = [
  ["creates visit members table", () => assert.match(sql, /CREATE TABLE `pmv2_visit_members`/)],
  ["uses internal visit FK", () => {
    assert.match(sql, /FOREIGN KEY \(`visitId`\)/);
    assert.match(sql, /REFERENCES `pmv2_visits` \(`id`\)/);
  }],
  ["keeps user as indexed external reference", () => {
    assert.match(sql, /KEY `idx_pmv2_visit_members_user` \(`userId`\)/);
    assert.doesNotMatch(sql, /FOREIGN KEY \(`userId`\)/);
    assert.doesNotMatch(sql, /REFERENCES `users`/);
  }],
  ["prevents duplicate membership in one visit", () => {
    assert.match(sql, /UNIQUE KEY `uq_pmv2_visit_members_visit_user` \(`visitId`, `userId`\)/);
  }],
  ["stores leader marker without TiDB CHECK dependency", () => {
    assert.match(sql, /`isLeader` TINYINT NOT NULL DEFAULT 0/);
    assert.doesNotMatch(sql, /\bCHECK\s*\(/);
  }],
];

let passed = 0;
for (const [name, fn] of tests) {
  try { fn(); passed += 1; console.log(`PASS: ${name}`); }
  catch (error) { console.error(`FAIL: ${name}`); throw error; }
}
console.log(`PM V2 visit member schema contract: ${passed}/${tests.length} PASS`);
