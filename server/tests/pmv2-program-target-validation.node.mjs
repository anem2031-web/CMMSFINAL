import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  Pmv2ProgramTargetValidationError,
  validatePmv2ProgramTargetWrite,
} from "../pmv2/programs/target-validation.ts";

function invalid(input, field = "target") {
  assert.throws(
    () => validatePmv2ProgramTargetWrite(input),
    error =>
      error instanceof Pmv2ProgramTargetValidationError &&
      error.field === field,
  );
}

test("accepts exactly one Site, Section, or Asset target", () => {
  assert.deepEqual(validatePmv2ProgramTargetWrite({ programId: 1, siteId: 9 }), {
    programId: 1, siteId: 9, sectionId: null, assetId: null,
  });
  assert.deepEqual(validatePmv2ProgramTargetWrite({ programId: 1, sectionId: 7 }), {
    programId: 1, siteId: null, sectionId: 7, assetId: null,
  });
  assert.deepEqual(validatePmv2ProgramTargetWrite({ programId: 1, assetId: 5 }), {
    programId: 1, siteId: null, sectionId: null, assetId: 5,
  });
});

test("rejects zero targets or multiple targets", () => {
  invalid({ programId: 1 });
  invalid({ programId: 1, siteId: 2, assetId: 3 });
  invalid({ programId: 1, siteId: 2, sectionId: 3, assetId: 4 });
});

test("rejects invalid identifiers", () => {
  invalid({ programId: 0, siteId: 1 }, "programId");
  invalid({ programId: 1, siteId: 0 });
  invalid({ programId: 1, sectionId: 2.5 });
});

test("keeps external targets indexed without physical external FKs", () => {
  const sql = readFileSync(
    new URL("../../drizzle/2026_09_08_pmv2_program_targets.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /FOREIGN KEY \(`programId`\)/);
  assert.match(sql, /REFERENCES `pmv2_programs` \(`id`\)/);
  assert.match(sql, /idx_pmv2_program_targets_site/);
  assert.match(sql, /idx_pmv2_program_targets_section/);
  assert.match(sql, /idx_pmv2_program_targets_asset/);
  assert.doesNotMatch(sql, /REFERENCES `sites`/);
  assert.doesNotMatch(sql, /REFERENCES `sections`/);
  assert.doesNotMatch(sql, /REFERENCES `assets`/);
  assert.doesNotMatch(sql, /\bCHECK\s*\(/);
});

test("prevents duplicate target of the same type within one program", () => {
  const sql = readFileSync(
    new URL("../../drizzle/2026_09_08_pmv2_program_targets.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /UNIQUE KEY `uq_pmv2_program_targets_program_site` \(`programId`, `siteId`\)/);
  assert.match(sql, /UNIQUE KEY `uq_pmv2_program_targets_program_section` \(`programId`, `sectionId`\)/);
  assert.match(sql, /UNIQUE KEY `uq_pmv2_program_targets_program_asset` \(`programId`, `assetId`\)/);
});
