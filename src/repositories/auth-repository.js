'use strict';
const pool = require('../../db');

const USER_COLUMNS = 'user_id, handle, email, password_hash, display_name, avatar_url, status, role, email_verified_at';
function one(rows) { return rows[0] || null; }
async function byEmail(email, connection = pool, lock = false) {
  const sql = `SELECT ${USER_COLUMNS} FROM users WHERE email = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`;
  const [rows] = await connection.execute(sql, [email]);
  return one(rows);
}
async function byHandle(handle, connection = pool) {
  const [rows] = await connection.execute(`SELECT ${USER_COLUMNS} FROM users WHERE handle = ? LIMIT 1`, [handle]);
  return one(rows);
}
async function byId(userId, connection = pool) {
  const [rows] = await connection.execute(`SELECT ${USER_COLUMNS} FROM users WHERE user_id = ? LIMIT 1`, [userId]);
  return one(rows);
}
async function byProvider(provider, providerUserId, connection = pool) {
  const [rows] = await connection.execute(
    `SELECT u.${USER_COLUMNS.replaceAll(', ', ', u.')} FROM oauth_accounts oa
     JOIN users u ON u.user_id = oa.user_id
     WHERE oa.provider = ? AND oa.provider_user_id = ? LIMIT 1`,
    [provider, providerUserId]
  );
  return one(rows);
}
async function createUser(connection, { handle, email, passwordHash, displayName, avatarUrl, emailVerified, countryCode = null, emailNotifications = true }) {
  const [result] = await connection.execute(
    `INSERT INTO users (handle, email, password_hash, display_name, avatar_url, country_code, status, email_verified_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', IF(?, UTC_TIMESTAMP(3), NULL))`,
    [handle, email, passwordHash, displayName, avatarUrl, countryCode, emailVerified ? 1 : 0]
  );
  await connection.execute('INSERT INTO user_settings (user_id, is_email_notification_enabled) VALUES (?, ?)',
    [result.insertId, emailNotifications ? 1 : 0]);
  return byId(result.insertId, connection);
}
async function markEmailVerified(connection, userId) {
  await connection.execute(
    'UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3)) WHERE user_id = ?',
    [userId]
  );
}
async function linkProvider(connection, userId, provider, providerUserId) {
  await connection.execute(
    'INSERT INTO oauth_accounts (user_id, provider, provider_user_id) VALUES (?, ?, ?)',
    [userId, provider, providerUserId]
  );
}
async function activeSession(tokenHash) {
  const [rows] = await pool.execute(
    `SELECT u.${USER_COLUMNS.replaceAll(', ', ', u.')} FROM auth_sessions s
     JOIN users u ON u.user_id = s.user_id
     WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(3)
     LIMIT 1`,
    [tokenHash]
  );
  return one(rows);
}
async function createSession(userId, tokenHash, expiresAt) {
  await pool.execute('INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
    [userId, tokenHash, expiresAt]);
}
async function revokeSession(tokenHash) {
  await pool.execute('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE token_hash = ? AND revoked_at IS NULL',
    [tokenHash]);
}
async function updatePassword(userId, passwordHash, currentTokenHash) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      'UPDATE users SET password_hash = ? WHERE user_id = ? AND status = ?',
      [passwordHash, userId, 'active']
    );
    await connection.execute(
      `UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3)
       WHERE user_id = ? AND revoked_at IS NULL AND token_hash <> ?`,
      [userId, currentTokenHash]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}
async function recentReset(userId) {
  const [rows] = await pool.execute(
    'SELECT password_reset_token_id FROM password_reset_tokens WHERE user_id = ? AND created_at > UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE LIMIT 1', [userId]);
  return rows.length > 0;
}
async function createReset(userId, tokenHash) {
  await pool.execute(
    'INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, UTC_TIMESTAMP(3) + INTERVAL 30 MINUTE)',
    [userId, tokenHash]);
}
async function validReset(connection, tokenHash) {
  const [rows] = await connection.execute(
    `SELECT r.password_reset_token_id, r.user_id FROM password_reset_tokens r
     JOIN users u ON u.user_id = r.user_id
     WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at > UTC_TIMESTAMP(3)
       AND u.status = 'active' LIMIT 1 FOR UPDATE`, [tokenHash]);
  return rows[0] || null;
}
async function consumeReset(connection, resetId, userId, passwordHash) {
  await connection.execute('UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP(3)) WHERE user_id = ?', [passwordHash, userId]);
  await connection.execute('UPDATE password_reset_tokens SET used_at = UTC_TIMESTAMP(3) WHERE password_reset_token_id = ?', [resetId]);
  await connection.execute('UPDATE auth_sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND revoked_at IS NULL', [userId]);
}
module.exports = { recentReset, createReset, validReset, consumeReset, pool, byEmail, byHandle, byId, byProvider, createUser, markEmailVerified,
  linkProvider, activeSession, createSession, revokeSession, updatePassword };
