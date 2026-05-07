/**
 * TARGETED PRODUCTION MIGRATION — STRICTLY LIMITED
 * Adds ONLY the three specialty columns to the users table.
 *
 * Authorized changes:
 *   - users.specialty      VARCHAR(200) NULL DEFAULT NULL
 *   - users.specialtyEn    VARCHAR(200) NULL DEFAULT NULL
 *   - users.specialtyUr    VARCHAR(200) NULL DEFAULT NULL
 *
 * Nothing else is modified.
 * Uses IF NOT EXISTS to be safe on re-run.
 */
import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const conn = await createConnection(DATABASE_URL);

try {
  console.log("🔍 Checking current users table columns...");

  // Pre-migration: count rows to confirm no data loss
  const [[{ rowCount }]] = await conn.execute("SELECT COUNT(*) AS rowCount FROM `users`");
  console.log(`   Users table row count (before): ${rowCount}`);

  // Pre-migration: check which columns already exist
  const [existingCols] = await conn.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('specialty', 'specialtyEn', 'specialtyUr')"
  );
  const existing = new Set(existingCols.map(r => r.COLUMN_NAME));
  console.log(`   Columns already present: ${existing.size > 0 ? [...existing].join(", ") : "none"}`);

  // ── MIGRATION: add only missing columns ──────────────────────
  const migrations = [
    {
      column: "specialty",
      sql: "ALTER TABLE `users` ADD COLUMN `specialty` VARCHAR(200) NULL DEFAULT NULL",
    },
    {
      column: "specialtyEn",
      sql: "ALTER TABLE `users` ADD COLUMN `specialtyEn` VARCHAR(200) NULL DEFAULT NULL",
    },
    {
      column: "specialtyUr",
      sql: "ALTER TABLE `users` ADD COLUMN `specialtyUr` VARCHAR(200) NULL DEFAULT NULL",
    },
  ];

  for (const { column, sql } of migrations) {
    if (existing.has(column)) {
      console.log(`   ⏭  Column '${column}' already exists — skipped`);
    } else {
      await conn.execute(sql);
      console.log(`   ✅ Column '${column}' added successfully`);
    }
  }

  // ── VERIFICATION ─────────────────────────────────────────────
  console.log("\n🔍 Post-migration verification...");

  const [verifyRows] = await conn.execute(
    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('specialty', 'specialtyEn', 'specialtyUr') ORDER BY COLUMN_NAME"
  );

  if (verifyRows.length === 3) {
    console.log("   ✅ All 3 columns verified present:");
    for (const row of verifyRows) {
      console.log(`      - ${row.COLUMN_NAME}: ${row.COLUMN_TYPE}, nullable=${row.IS_NULLABLE}, default=${row.COLUMN_DEFAULT}`);
    }
  } else {
    console.error(`   ❌ Expected 3 columns, found ${verifyRows.length}`);
    process.exit(1);
  }

  // Post-migration: confirm row count unchanged
  const [[{ rowCountAfter }]] = await conn.execute("SELECT COUNT(*) AS rowCountAfter FROM `users`");
  if (rowCountAfter === rowCount) {
    console.log(`   ✅ Row count unchanged: ${rowCountAfter} rows`);
  } else {
    console.error(`   ❌ Row count changed! Before: ${rowCount}, After: ${rowCountAfter}`);
    process.exit(1);
  }

  console.log("\n✅ Migration completed successfully. No existing data was modified.");
  console.log("   Login should now work — users table matches the deployed schema.");

} catch (err) {
  console.error("❌ Migration failed:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
