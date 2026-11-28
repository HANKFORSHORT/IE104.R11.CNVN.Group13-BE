'use strict';
const repo = require('../repositories/account-data-repository');
const profiles = require('../repositories/profile-repository');
const HttpError = require('../utils/http-error');

function iso(value) { return value == null ? null : new Date(value).toISOString(); }
function parseCursor(value) {
  if (value == null || value === '') return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (typeof parsed.at === 'string' && !Number.isNaN(Date.parse(parsed.at)) &&
        typeof parsed.id === 'string' && /^\d+$/.test(parsed.id)) {
      return { at: new Date(parsed.at), id: parsed.id };
    }
  } catch { /* Invalid cursor. */ }
  throw new HttpError(400, 'INVALID_CURSOR', 'Invalid page cursor');
}
function page(rows, limit, timestamp, id, map) {
  const hasMore = rows.length > limit;
  const selected = rows.slice(0, limit);
  const last = selected[selected.length - 1];
  return {
    items: selected.map(map),
    nextCursor: hasMore && last
      ? Buffer.from(JSON.stringify({ at: iso(last[timestamp]), id: String(last[id]) })).toString('base64url')
      : null
  };
}
function listOptions(query) {
  const value = query.limit == null ? 50 : Number(query.limit);
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new HttpError(400, 'INVALID_LIMIT', 'Limit must be between 1 and 100');
  }
  return { cursor: parseCursor(query.cursor), limit: value };
}

async function ownSubmissions(userId, query) {
  const { cursor, limit } = listOptions(query);
  const rows = await repo.submissions(userId, cursor, limit);
  return page(rows, limit, 'submitted_at', 'submission_id', (row) => ({
    id: String(row.submission_id), problemSlug: row.problem_slug,
    problemTitle: row.problem_title, language: row.language_name,
    status: row.status, verdict: row.verdict, score: row.score == null ? null : Number(row.score),
    sizeBytes: Number(row.code_size_bytes), submittedAt: iso(row.submitted_at)
  }));
}

async function solvedForUser(userId, query) {
  const { cursor, limit } = listOptions(query);
  const rows = await repo.solved(userId, cursor, limit);
  return page(rows, limit, 'first_ac_at', 'problem_id', (row) => ({
    problemSlug: row.slug, title: row.title, difficulty: row.difficulty,
    firstAcceptedAt: iso(row.first_ac_at)
  }));
}
async function publicSolved(username, query) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(username)) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  }
  const user = await profiles.findPublicByUsername(username);
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  return solvedForUser(user.user_id, query);
}

async function ownNotifications(userId, query) {
  const { cursor, limit } = listOptions(query);
  const rows = await repo.notifications(userId, cursor, limit);
  return page(rows, limit, 'created_at', 'notification_id', (row) => ({
    id: String(row.notification_id), type: row.type, title: row.title,
    body: row.body, linkPath: row.link_path, readAt: iso(row.read_at),
    createdAt: iso(row.created_at)
  }));
}
async function markRead(userId, id) {
  if (!/^\d+$/.test(id) || !(await repo.markNotificationRead(userId, id))) {
    throw new HttpError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found');
  }
  return { id, read: true };
}
async function markAllRead(userId) {
  return { updated: await repo.markAllNotificationsRead(userId) };
}

module.exports = { ownSubmissions, solvedForUser, publicSolved, ownNotifications, markRead, markAllRead };
