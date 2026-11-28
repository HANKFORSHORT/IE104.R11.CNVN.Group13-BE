'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const pool = require('../db');
const { splitSqlStatements } = require('./sql-file');

async function main() {
  const connection = await pool.getConnection();
  let locked = false;
  try {
    await connection.query("SET time_zone = '+00:00'");
    const [[lock]] = await connection.query("SELECT GET_LOCK('astra_schema_migrations', 30) AS acquired");
    if (lock.acquired !== 1) throw new Error('Could not obtain migration lock');
    locked = true;
    await connection.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) PRIMARY KEY, checksum_sha256 CHAR(64) NOT NULL,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci`);
    const directory = path.join(__dirname, '../db/migrations');
    const names = (await fs.readdir(directory)).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
    let applied = 0;
    for (const name of names) {
      const sql = await fs.readFile(path.join(directory, name), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const [[previous]] = await connection.execute(
        'SELECT checksum_sha256 FROM schema_migrations WHERE migration_name = ?', [name]
      );
      if (previous) {
        if (previous.checksum_sha256 !== checksum) throw new Error(`Changed applied migration: ${name}`);
        continue;
      }
      for (const statement of splitSqlStatements(sql)) {
        await connection.query(statement);
      }
      await connection.execute('INSERT INTO schema_migrations (migration_name, checksum_sha256) VALUES (?, ?)', [name, checksum]);
      process.stdout.write(`Applied ${name}\n`);
      applied++;
    }
    process.stdout.write(`Migrations applied: ${applied}\n`);
  } finally {
    if (locked) await connection.query("SELECT RELEASE_LOCK('astra_schema_migrations')");
    connection.release();
    await pool.end();
  }
}
main().catch((error) => { process.stderr.write(`Migration failed: ${error.code || error.message}\n`); process.exitCode = 1; });
