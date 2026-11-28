'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const pool = require('../db');
const { splitSqlStatements } = require('./sql-file');

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
  const host = process.env.DB_HOST;
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.ALLOW_REMOTE_DEMO_SEED !== '1') {
    throw new Error('Demo seed requires a local database or ALLOW_REMOTE_DEMO_SEED=1');
  }
  const sql = await fs.readFile(path.join(__dirname, '../db/seeds/profile_demo.sql'), 'utf8');
  const connection = await pool.getConnection();
  try {
    await connection.query("SET time_zone = '+00:00'");
    for (const statement of splitSqlStatements(sql)) await connection.query(statement);
    process.stdout.write('Profile demo seed applied.\n');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`Profile demo seed failed: ${error.code || error.message}\n`);
  process.exitCode = 1;
});
