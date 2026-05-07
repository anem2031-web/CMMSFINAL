import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function applyMigration() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  // Remove ssl query param if it causes issues with mysql2
  const url = new URL(connectionString);
  const config = {
    host: url.hostname,
    port: parseInt(url.port),
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
    ssl: {
      rejectUnauthorized: true
    }
  };

  const connection = await mysql.createConnection(config);
  console.log('Connected to TiDB');

  try {
    const sql = fs.readFileSync(path.join(process.cwd(), 'drizzle/0021_flashy_malice.sql'), 'utf8');
    const statements = sql.split('--> statement-breakpoint');

    for (let statement of statements) {
      statement = statement.trim();
      if (!statement) continue;
      console.log('Executing statement:', statement.substring(0, 50) + '...');
      try {
        await connection.query(statement);
      } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
          console.warn('Skipping existing schema element:', err.message);
        } else {
          throw err;
        }
      }
    }
    console.log('Migration applied successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await connection.end();
  }
}

applyMigration();
