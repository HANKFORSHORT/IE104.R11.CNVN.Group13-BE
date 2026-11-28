'use strict';
const repo = require('../repositories/profile-repository');
const HttpError = require('../utils/http-error');

function publicFields(row, metrics) {
  return {
    id: String(row.user_id),
    username: row.handle,
    displayName: row.display_name || row.handle,
    bio: row.bio || null,
    avatarUrl: row.avatar_url || null,
    country: row.country_code || null,
    region: row.region || null,
    rating: Number(row.rating),
    maxRating: Number(row.max_rating),
    createdAt: new Date(row.created_at).toISOString(),
    ...metrics
  };
}

async function publicProfile(username) {
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(username)) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  }
  const row = await repo.findPublicByUsername(username);
  if (!row) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  return publicFields(row, await repo.metrics(row.user_id));
}

async function ownProfile(userId) {
  const row = await repo.findOwnById(userId);
  if (!row) throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  const [stats, linkedProviders] = await Promise.all([
    repo.metrics(row.user_id),
    repo.providers(row.user_id)
  ]);
  return {
    ...publicFields(row, stats),
    email: /^facebook-[a-f0-9]{32}@example\.invalid$/.test(row.email) ? null : row.email,
    linkedProviders,
    settings: {
      theme: row.theme || 'system',
      defaultLanguageId: row.default_language_id == null ? null : Number(row.default_language_id),
      isSourcePublic: Boolean(row.is_source_public),
      isProfilePublic: row.is_profile_public == null ? true : Boolean(row.is_profile_public),
      isEmailNotificationEnabled: row.is_email_notification_enabled == null
        ? true : Boolean(row.is_email_notification_enabled),
      isSiteNotificationEnabled: row.is_site_notification_enabled == null
        ? true : Boolean(row.is_site_notification_enabled)
    }
  };
}

function cleanedUrl(value) {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) {
    throw new HttpError(400, 'INVALID_AVATAR_URL', 'Avatar URL must be at most 2048 characters');
  }
  let url;
  try { url = new URL(value); }
  catch { throw new HttpError(400, 'INVALID_AVATAR_URL', 'Enter a valid avatar URL'); }
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password) {
    throw new HttpError(400, 'INVALID_AVATAR_URL', 'Avatar URL must use HTTPS');
  }
  return url.href;
}

function validateChanges(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Enter profile fields to update');
  }
  const allowed = new Set(['username', 'displayName', 'bio', 'avatarUrl', 'country']);
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !allowed.has(key))) {
    throw new HttpError(400, 'INVALID_PROFILE', 'Only username, displayName, bio, avatarUrl and country can be updated');
  }
  const changes = {};
  for (const key of keys) {
    const value = input[key];
    if (key === 'username') {
      if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{3,40}$/.test(value.trim())) {
        throw new HttpError(400, 'INVALID_USERNAME', 'Username must be 3–40 letters, numbers, _ or -');
      }
      changes.username = value.trim();
    } else if (key === 'displayName') {
      if (value !== null && (typeof value !== 'string' ||
          !value.trim() || [...value.trim()].length > 100)) {
        throw new HttpError(400, 'INVALID_DISPLAY_NAME', 'Display name must be 1–100 characters or null');
      }
      changes.displayName = value === null ? null : value.trim();
    } else if (key === 'bio') {
      if (value !== null && (typeof value !== 'string' || [...value].length > 200)) {
        throw new HttpError(400, 'INVALID_BIO', 'Bio must be at most 200 characters or null');
      }
      changes.bio = value === null ? null : value.trim() || null;
    } else if (key === 'avatarUrl') {
      changes.avatarUrl = cleanedUrl(value);
    } else if (key === 'country') {
      if (value !== null && (typeof value !== 'string' || !/^[A-Za-z]{2}$/.test(value.trim()))) {
        throw new HttpError(400, 'INVALID_COUNTRY', 'Country must be a two-letter code or null');
      }
      changes.country = value === null ? null : value.trim().toUpperCase();
    }
  }
  return changes;
}

async function updateOwnProfile(userId, input) {
  const changes = validateChanges(input);
  try { await repo.update(userId, changes); }
  catch (error) {
    if (error.code === 'ER_DUP_ENTRY' && Object.hasOwn(changes, 'username')) {
      throw new HttpError(409, 'USERNAME_TAKEN', 'Username is already taken');
    }
    throw error;
  }
  return ownProfile(userId);
}

async function updateOwnSettings(userId, input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new HttpError(400, 'INVALID_SETTINGS', 'Enter settings to update');
  }
  const allowed = new Set([
    'isEmailNotificationEnabled', 'isSiteNotificationEnabled',
    'isProfilePublic', 'isSourcePublic', 'theme'
  ]);
  const keys = Object.keys(input);
  if (!keys.length || keys.some((key) => !allowed.has(key))) {
    throw new HttpError(400, 'INVALID_SETTINGS', 'Unknown setting');
  }
  for (const key of keys) {
    if (key === 'theme') {
      if (!['system', 'light', 'dark'].includes(input[key])) {
        throw new HttpError(400, 'INVALID_SETTINGS', 'Theme must be system, light or dark');
      }
    } else if (typeof input[key] !== 'boolean') {
      throw new HttpError(400, 'INVALID_SETTINGS', 'Settings must be true or false');
    }
  }
  await repo.updateSettings(userId, input);
  return ownProfile(userId);
}

module.exports = { publicProfile, ownProfile, updateOwnProfile, updateOwnSettings };
