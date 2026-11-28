'use strict';
const pool = require('../../db');

const PROFILE_COLUMNS = `u.user_id, u.handle, u.email, u.display_name, u.bio,
  u.country_code, u.region, u.avatar_url, u.rating, u.max_rating, u.created_at,
  s.theme, s.default_language_id, s.is_source_public, s.is_profile_public,
  s.is_email_notification_enabled, s.is_site_notification_enabled`;

async function findPublicByUsername(username) {
  const [rows] = await pool.execute(
    `SELECT ${PROFILE_COLUMNS}
     FROM users u LEFT JOIN user_settings s ON s.user_id = u.user_id
     WHERE u.handle = ? AND u.status = 'active'
       AND COALESCE(s.is_profile_public, TRUE) = TRUE
     LIMIT 1`,
    [username]
  );
  return rows[0] || null;
}

async function findOwnById(userId) {
  const [rows] = await pool.execute(
    `SELECT ${PROFILE_COLUMNS}
     FROM users u LEFT JOIN user_settings s ON s.user_id = u.user_id
     WHERE u.user_id = ? AND u.status = 'active'
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function metrics(userId) {
  const [[solvedRows], [submissionRows], [activityRows], [achievementRows], [rankRows]] = await Promise.all([
    pool.execute(
      'SELECT COUNT(*) AS count FROM user_problem_stats WHERE user_id = ? AND first_ac_at IS NOT NULL',
      [userId]
    ),
    pool.execute('SELECT COUNT(*) AS count FROM submissions WHERE user_id = ?', [userId]),
    pool.execute(
      `SELECT DATE_FORMAT(submitted_at, '%Y-%m-%d') AS day, COUNT(*) AS count
       FROM submissions
       WHERE user_id = ? AND submitted_at >= UTC_DATE() - INTERVAL 1 YEAR
       GROUP BY DATE_FORMAT(submitted_at, '%Y-%m-%d') ORDER BY day`,
      [userId]
    ),
    pool.execute(
      `SELECT a.code, a.name, a.description, a.requirement, a.image_path, ua.earned_at
       FROM user_achievements ua JOIN achievements a ON a.achievement_id = ua.achievement_id
       WHERE ua.user_id = ? AND a.is_active = TRUE ORDER BY ua.earned_at DESC`,
      [userId]
    ),
    pool.execute(
      `SELECT COUNT(*) + 1 AS ranking FROM users ranked
       WHERE ranked.status = 'active' AND ranked.rating >
         (SELECT rating FROM users WHERE user_id = ?)`,
      [userId]
    )
  ]);
  return {
    rank: Number(rankRows[0].ranking),
    solvedCount: Number(solvedRows[0].count),
    submissionCount: Number(submissionRows[0].count),
    activity: activityRows.map((row) => ({ day: row.day, count: Number(row.count) })),
    achievements: achievementRows.map((row) => ({
      code: row.code, name: row.name, description: row.description,
      requirement: row.requirement, imagePath: row.image_path,
      earnedAt: new Date(row.earned_at).toISOString()
    }))
  };
}

async function providers(userId) {
  const [rows] = await pool.execute(
    'SELECT provider FROM oauth_accounts WHERE user_id = ? ORDER BY provider',
    [userId]
  );
  return rows.map((row) => row.provider);
}

const PROFILE_FIELDS = Object.freeze({
  username: 'handle',
  displayName: 'display_name',
  bio: 'bio',
  avatarUrl: 'avatar_url',
  country: 'country_code'
});

async function update(userId, changes) {
  const entries = Object.entries(changes);
  const columns = entries.map(([key]) => `${PROFILE_FIELDS[key]} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  await pool.execute(`UPDATE users SET ${columns} WHERE user_id = ? AND status = 'active'`,
    [...values, userId]);
}

const SETTINGS_FIELDS = Object.freeze({
  isEmailNotificationEnabled: 'is_email_notification_enabled',
  isSiteNotificationEnabled: 'is_site_notification_enabled',
  isProfilePublic: 'is_profile_public',
  isSourcePublic: 'is_source_public',
  theme: 'theme'
});

async function updateSettings(userId, changes) {
  const entries = Object.entries(changes);
  const columns = entries.map(([key]) => SETTINGS_FIELDS[key]);
  const placeholders = entries.map(() => '?').join(', ');
  const updates = columns.map((column) => `${column} = ?`).join(', ');
  const values = entries.map(([, value]) => value);
  await pool.execute(
    `INSERT INTO user_settings (user_id, ${columns.join(', ')})
     VALUES (?, ${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
    [userId, ...values, ...values]
  );
}

module.exports = { findPublicByUsername, findOwnById, metrics, providers, update, updateSettings };
