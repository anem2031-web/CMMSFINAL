import fs from 'node:fs';
import assert from 'node:assert/strict';

const schema = fs.readFileSync(new URL('../../drizzle/schema.ts', import.meta.url), 'utf8');
const migration = fs.readFileSync(new URL('../../drizzle/2026_09_10_pmv2_program_estimated_duration.sql', import.meta.url), 'utf8');

assert.match(schema, /export const pmv2Programs = mysqlTable\("pmv2_programs"/);
assert.match(schema, /estimatedDurationMinutes: int\(\)/);
assert.match(migration, /ALTER TABLE `pmv2_programs`/);
assert.match(migration, /ADD COLUMN `estimatedDurationMinutes` INT NULL/);
console.log('pmv2-program-estimated-duration-schema: PASS');
