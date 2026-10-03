import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(new URL("../../drizzle/2026_09_08_pmv2_visits.sql", import.meta.url), "utf8");

const tests = [
  ["creates visits table", () => assert.match(sql, /CREATE TABLE `pmv2_visits`/)],
  ["uses internal task FK", () => {
    assert.match(sql, /FOREIGN KEY \(`taskId`\)/);
    assert.match(sql, /REFERENCES `pmv2_tasks` \(`id`\)/);
  }],
  ["stores visit start and optional end timestamps", () => {
    assert.match(sql, /`startedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP/);
    assert.match(sql, /`endedAt` TIMESTAMP NULL DEFAULT NULL/);
  }],
  ["does not couple visits to external master data", () => {
    assert.doesNotMatch(sql, /REFERENCES `(users|sites|sections|assets|warehouses)`/);
  }],
];

let passed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}
console.log(`PM V2 visit schema contract: ${passed}/${tests.length} PASS`);
