const mysql = require('mysql2/promise');
const crypto = require('node:crypto');
const quote = value => '`' + value.replaceAll('`', '``') + '`';
const digest = rows => crypto.createHash('sha256').update(JSON.stringify(rows.map(row => JSON.stringify(row)).sort())).digest('hex');
async function main() {
  const config = JSON.parse(process.env.TIDB_COPY_CONFIG);
  const common = { host: config.host, port: 4000, ssl: { rejectUnauthorized: true }, connectTimeout: 20000, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, rowsAsArray: true, typeCast(field, next) { return field.type === 'JSON' ? field.string('utf8') : next(); } };
  let source, target;
  try {
    source = await mysql.createConnection({ ...common, ...config.source });
    target = await mysql.createConnection({ ...common, ...config.target });
    for (const connection of [source, target]) await connection.query("SET SESSION time_zone = '+00:00'");
    const [existing] = await target.query('SHOW FULL TABLES');
    if (existing.length && !config.resumeEmptyTables) throw new Error('Target is not empty; refusing to overwrite.');
    for (const [name] of existing) {
      const [[count]] = await target.query('SELECT COUNT(*) FROM ' + quote(name));
      if (Number(count[0])) throw new Error('Target contains data; refusing to overwrite.');
    }
    await source.query('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await source.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
    const [tables] = await source.query('SHOW FULL TABLES');
    if (tables.some(row => row[1] !== 'BASE TABLE')) throw new Error('Non-table objects require separate handling.');
    const snapshot = [];
    for (const [name] of tables) {
      const [[ddl]] = await source.query('SHOW CREATE TABLE ' + quote(name));
      const [columns] = await source.query('SHOW FULL COLUMNS FROM ' + quote(name));
      const writable = columns.filter(column => !/VIRTUAL GENERATED|STORED GENERATED/i.test(column[6] || '')).map(column => column[0]);
      const [rows] = await source.query('SELECT * FROM ' + quote(name));
      snapshot.push({ name, ddl: ddl[1], columns: columns.map(column => column[0]), writable, rows });
    }
    await source.commit();
    console.log(JSON.stringify({ phase: 'snapshot', tables: snapshot.length, rows: snapshot.reduce((sum, table) => sum + table.rows.length, 0) }));
    await target.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const table of snapshot) {
      const ddl = table.ddl.replaceAll(quote(config.source.database) + '.', quote(config.target.database) + '.');
      if (!existing.some(row => row[0] === table.name)) await target.query(ddl);
    }
    await target.beginTransaction();
    for (const table of snapshot) {
      const indices = table.writable.map(column => table.columns.indexOf(column));
      for (let offset = 0; offset < table.rows.length; offset += 100) {
        const values = table.rows.slice(offset, offset + 100).map(row => indices.map(index => row[index]));
        await target.query('INSERT INTO ' + quote(table.name) + ' (' + table.writable.map(quote).join(',') + ') VALUES ?', [values]);
      }
      const [copied] = await target.query('SELECT * FROM ' + quote(table.name));
      if (digest(copied) !== digest(table.rows)) throw new Error('Content verification failed: ' + table.name);
      const [[created]] = await target.query('SHOW CREATE TABLE ' + quote(table.name));
      const normalize = ddl => ddl.replace(/AUTO_INCREMENT=\d+\s*/g, '').replaceAll(quote(config.source.database) + '.', quote(config.target.database) + '.');
      if (normalize(created[1]) !== normalize(table.ddl)) throw new Error('Schema verification failed: ' + table.name);
      console.log(JSON.stringify({ table: table.name, rows: copied.length, content: 'matched', schema: 'matched' }));
    }
    await target.commit();
    await target.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log(JSON.stringify({ phase: 'complete', tables: snapshot.length, rows: snapshot.reduce((sum, table) => sum + table.rows.length, 0) }));
  } catch (error) {
    if (target) await target.rollback().catch(() => {});
    console.error(JSON.stringify({ code: error.code, message: error.message }));
    process.exitCode = 1;
  } finally {
    if (source) await source.end();
    if (target) await target.end();
  }
}
main();
