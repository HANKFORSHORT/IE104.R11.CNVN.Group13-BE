const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const host = process.env.DB_HOST;
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
const caPath = process.env.DB_SSL_CA_PATH || path.join(__dirname, 'certs', 'ca.pem');
const ssl = (isLocal && !process.env.DB_SSL_CA_PATH) ? undefined : {
  ca: fs.readFileSync(caPath),
  rejectUnauthorized: true
};

const pool = mysql.createPool({
  host,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z'
});

module.exports = pool;