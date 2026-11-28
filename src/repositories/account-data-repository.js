'use strict';
const pool = require('../../db');

async function submissions(userId, cursor, limit) {
  const conditions = cursor
    ? 'AND (s.submitted_at < ? OR (s.submitted_at = ? AND s.submission_id < ?))'
    : '';
  const params = cursor
    ? [userId, cursor.at, cursor.at, cursor.id, limit + 1]
    : [userId, limit + 1];
  const [rows] = await pool.execute(
    `SELECT s.submission_id, s.status, s.verdict, s.score, s.code_size_bytes,
       s.submitted_at, p.slug AS problem_slug, p.title AS problem_title,
       l.name AS language_name
     FROM submissions s JOIN problems p ON p.problem_id = s.problem_id
     JOIN programming_languages l ON l.language_id = s.language_id
     WHERE s.user_id = ? ${conditions}
     ORDER BY s.submitted_at DESC, s.submission_id DESC LIMIT ?`,
    params
  );
  return rows;
}

async function solved(userId, cursor, limit) {
  const conditions = cursor
    ? 'AND (ups.first_ac_at < ? OR (ups.first_ac_at = ? AND ups.problem_id < ?))'
    : '';
  const params = cursor
    ? [userId, cursor.at, cursor.at, cursor.id, limit + 1]
    : [userId, limit + 1];
  const [rows] = await pool.execute(
    `SELECT ups.problem_id, ups.first_ac_at, p.slug, p.title, p.difficulty
     FROM user_problem_stats ups JOIN problems p ON p.problem_id = ups.problem_id
     WHERE ups.user_id = ? AND ups.first_ac_at IS NOT NULL
       AND p.visibility = 'public' AND p.is_active = TRUE ${conditions}
     ORDER BY ups.first_ac_at DESC, ups.problem_id DESC LIMIT ?`,
    params
  );
  return rows;
}

async function notifications(userId, cursor, limit) {
  const conditions = cursor
    ? 'AND (n.created_at < ? OR (n.created_at = ? AND n.notification_id < ?))'
    : '';
  const params = cursor
    ? [userId, cursor.at, cursor.at, cursor.id, limit + 1]
    : [userId, limit + 1];
  const [rows] = await pool.execute(
    `SELECT n.notification_id, n.type, n.title, n.body, n.link_path, n.read_at, n.created_at
     FROM notifications n WHERE n.user_id = ? ${conditions}
     ORDER BY n.created_at DESC, n.notification_id DESC LIMIT ?`,
    params
  );
  return rows;
}

async function markNotificationRead(userId, notificationId) {
  const [result] = await pool.execute(
    'UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP(3)) WHERE user_id = ? AND notification_id = ?',
    [userId, notificationId]
  );
  return result.affectedRows > 0;
}

async function markAllNotificationsRead(userId) {
  const [result] = await pool.execute(
    'UPDATE notifications SET read_at = UTC_TIMESTAMP(3) WHERE user_id = ? AND read_at IS NULL',
    [userId]
  );
  return result.affectedRows;
}

module.exports = { submissions, solved, notifications, markNotificationRead, markAllNotificationsRead };
