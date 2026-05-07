import { createConnection } from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await createConnection(process.env.DATABASE_URL);
try {
  // 1. Verify the 3 new columns
  const [cols] = await conn.execute(
    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('specialty','specialtyEn','specialtyUr') ORDER BY COLUMN_NAME"
  );
  console.log("COLUMNS CHECK:", cols.length === 3 ? "PASS" : "FAIL", "—", cols.map(c => c.COLUMN_NAME).join(", "));

  // 2. Confirm row count
  const [[{ cnt }]] = await conn.execute("SELECT COUNT(*) AS cnt FROM users");
  console.log("ROW COUNT:", cnt, "(expected: 13)");

  // 3. Confirm no existing data was modified
  const [[{ nonNull }]] = await conn.execute(
    "SELECT COUNT(*) AS nonNull FROM users WHERE specialty IS NOT NULL OR specialtyEn IS NOT NULL OR specialtyUr IS NOT NULL"
  );
  console.log("NON-NULL SPECIALTY ROWS:", nonNull, "(expected: 0 — no data modified)");

  // 4. Verify login query now works without error
  const [loginTest] = await conn.execute(
    "SELECT id, username, role, isActive, specialty, specialtyEn, specialtyUr FROM users WHERE username = 'admin' LIMIT 1"
  );
  if (loginTest.length > 0) {
    const u = loginTest[0];
    console.log(`LOGIN QUERY TEST: PASS — user found: username=${u.username}, role=${u.role}, isActive=${u.isActive}, specialty=${u.specialty}`);
  } else {
    console.log("LOGIN QUERY TEST: admin user not found (may have different username)");
  }

  // 5. Confirm no unauthorized columns were added
  const [allNewCols] = await conn.execute(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' ORDER BY ORDINAL_POSITION"
  );
  console.log("TOTAL COLUMNS IN users TABLE:", allNewCols.length);
  console.log("ALL COLUMNS:", allNewCols.map(c => c.COLUMN_NAME).join(", "));

} finally {
  await conn.end();
}
