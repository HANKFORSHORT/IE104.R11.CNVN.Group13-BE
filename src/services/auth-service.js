'use strict';
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const repo = require('../repositories/auth-repository');
const jwt = require('../utils/jwt');
const cookies = require('../utils/cookies');
const config = require('../config');
const HttpError = require('../utils/http-error');
const mail = require('./mail-service');

function emailOf(value) {
  if (typeof value !== 'string') throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address');
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address');
  }
  return email;
}
function usernameOf(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{3,40}$/.test(value.trim())) {
    throw new HttpError(400, 'INVALID_USERNAME', 'Username must be 3–40 letters, numbers, _ or -');
  }
  return value.trim();
}
function passwordOf(value) {
  const bytes = typeof value === 'string' ? Buffer.byteLength(value, 'utf8') : 0;
  if (bytes < 12 || bytes > 72) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password must be 12–72 UTF-8 bytes');
  }
  return value;
}
function displayNameOf(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string' || value.trim().length > 100) {
    throw new HttpError(400, 'INVALID_DISPLAY_NAME', 'Display name must be at most 100 characters');
  }
  return value.trim();
}
function publicOwnUser(row) {
  const email = /^facebook-[a-f0-9]{32}@example\.invalid$/.test(row.email) ? null : row.email;
  return {
    id: String(row.user_id), username: row.handle, email,
    displayName: row.display_name || row.handle, avatarUrl: row.avatar_url || null,
    emailVerified: Boolean(row.email_verified_at)
  };
}
function assertActive(row) {
  if (!row || row.status !== 'active') throw new HttpError(403, 'ACCOUNT_UNAVAILABLE', 'Account is unavailable');
  return row;
}
function isDuplicate(error) { return error && error.code === 'ER_DUP_ENTRY'; }

async function register(input) {
  const username = usernameOf(input.username);
  const email = emailOf(input.email);
  const password = passwordOf(input.password);
  const displayName = displayNameOf(input.displayName, username);
  const countryCode = input.country == null ? null : String(input.country).trim().toUpperCase();
  if (countryCode !== null && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new HttpError(400, 'INVALID_COUNTRY', 'Country must be a two-letter code');
  }
  const emailNotifications = input.emailNotifications == null ? true : input.emailNotifications;
  if (typeof emailNotifications !== 'boolean') {
    throw new HttpError(400, 'INVALID_SETTINGS', 'Email notification preference must be true or false');
  }
  if (await repo.byHandle(username)) throw new HttpError(409, 'USERNAME_TAKEN', 'Username is already taken');
  if (await repo.byEmail(email)) throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  const connection = await repo.pool.getConnection();
  try {
    await connection.beginTransaction();
    const user = await repo.createUser(connection, {
      handle: username, email, passwordHash, displayName, avatarUrl: null, emailVerified: false,
      countryCode, emailNotifications
    });
    await connection.commit();
    return publicOwnUser(user);
  } catch (error) {
    await connection.rollback();
    if (isDuplicate(error)) {
      if (await repo.byHandle(username)) throw new HttpError(409, 'USERNAME_TAKEN', 'Username is already taken');
      if (await repo.byEmail(email)) throw new HttpError(409, 'EMAIL_TAKEN', 'Email is already registered');
      throw new HttpError(409, 'ACCOUNT_CONFLICT', 'Account already exists');
    }
    throw error;
  } finally { connection.release(); }
}

async function login(input) {
  const email = emailOf(input.email);
  if (typeof input.password !== 'string' || !input.password ||
      Buffer.byteLength(input.password, 'utf8') > 72) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Enter a password of at most 72 UTF-8 bytes');
  }
  const row = await repo.byEmail(email);
  if (!row || !row.password_hash || !(await bcrypt.compare(input.password, row.password_hash))) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }
  return publicOwnUser(assertActive(row));
}

function generatedHandle(name, provider) {
  const base = String(name || provider).normalize('NFKD').replace(/[^A-Za-z0-9_-]/g, '').toLowerCase().slice(0, 27) || provider;
  return `${base}_${crypto.randomBytes(5).toString('hex')}`;
}
function providerIdentity(profile) {
  if (!profile || !['google', 'facebook'].includes(profile.provider) ||
      typeof profile.id !== 'string' || !profile.id || profile.id.length > 255) {
    throw new HttpError(502, 'OAUTH_PROFILE_INVALID', 'Provider did not return a valid identity');
  }
}
async function signInWithProvider(profile) {
  providerIdentity(profile);
  const existingLink = await repo.byProvider(profile.provider, profile.id);
  if (existingLink) return publicOwnUser(assertActive(existingLink));
  const email = profile.email ? emailOf(profile.email) : null;
  if (profile.provider === 'google' && (!email || profile.emailVerified !== true)) {
    throw new HttpError(403, 'OAUTH_EMAIL_UNVERIFIED', 'Google did not return a verified email');
  }
  const connection = await repo.pool.getConnection();
  try {
    await connection.beginTransaction();
    const matching = email ? await repo.byEmail(email, connection, true) : null;
    if (matching && profile.provider === 'facebook') {
      throw new HttpError(409, 'ACCOUNT_LINK_REQUIRED', 'Sign in to your existing account to link Facebook');
    }
    let user = matching;
    if (user) {
      assertActive(user);
      await repo.linkProvider(connection, user.user_id, profile.provider, profile.id);
      await repo.markEmailVerified(connection, user.user_id);
      user = await repo.byId(user.user_id, connection);
    } else {
      // Meta does not provide a verified-email claim. Reserve a private placeholder
      // instead of treating its email field as proof of ownership.
      const storedEmail = profile.provider === 'facebook'
        ? `facebook-${crypto.createHash('sha256').update(profile.id).digest('hex').slice(0, 32)}@example.invalid`
        : email;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          user = await repo.createUser(connection, {
            handle: generatedHandle(profile.name, profile.provider), email: storedEmail,
            passwordHash: null, displayName: typeof profile.name === 'string'
              ? displayNameOf(profile.name.slice(0, 100), 'Astra user') : 'Astra user',
            avatarUrl: profile.avatarUrl || null, emailVerified: profile.provider === 'google'
          });
          break;
        } catch (error) {
          if (!isDuplicate(error) || attempt === 4) throw error;
          if (await repo.byEmail(storedEmail, connection)) throw error;
        }
      }
      await repo.linkProvider(connection, user.user_id, profile.provider, profile.id);
    }
    await connection.commit();
    return publicOwnUser(user);
  } catch (error) {
    await connection.rollback();
    if (isDuplicate(error)) throw new HttpError(409, 'ACCOUNT_CONFLICT', 'Account link already exists');
    throw error;
  } finally { connection.release(); }
}

async function linkProviderToUser(userId, profile) {
  providerIdentity(profile);
  const connection = await repo.pool.getConnection();
  try {
    await connection.beginTransaction();
    const user = assertActive(await repo.byId(userId, connection));
    const linked = await repo.byProvider(profile.provider, profile.id, connection);
    if (linked && String(linked.user_id) !== String(userId)) {
      throw new HttpError(409, 'PROVIDER_ALREADY_LINKED', 'Provider account is linked to another user');
    }
    if (!linked) {
      if (profile.email) {
        const matching = await repo.byEmail(emailOf(profile.email), connection);
        if (matching && String(matching.user_id) !== String(userId)) {
          throw new HttpError(409, 'EMAIL_TAKEN', 'Provider email belongs to another account');
        }
      }
      await repo.linkProvider(connection, userId, profile.provider, profile.id);
    }
    if (profile.provider === 'google' && profile.emailVerified === true &&
        profile.email && emailOf(profile.email) === user.email.toLowerCase()) {
      await repo.markEmailVerified(connection, userId);
    }
    await connection.commit();
    return publicOwnUser(user);
  } catch (error) {
    await connection.rollback();
    if (isDuplicate(error)) throw new HttpError(409, 'PROVIDER_ALREADY_LINKED', 'Provider account is already linked');
    throw error;
  } finally { connection.release(); }
}

async function createSession(userId) {
  const token = jwt.sign({ sub: String(userId), jti: crypto.randomBytes(24).toString('base64url') },
    config.sessionSeconds, 'astra-session');
  const hash = crypto.createHash('sha256').update(token).digest();
  await repo.createSession(userId, hash, new Date(Date.now() + config.sessionSeconds * 1000));
  return token;
}
async function authenticate(req) {
  const token = cookies.read(req, cookies.SESSION_COOKIE);
  const payload = jwt.verify(token, 'astra-session');
  if (!payload || !/^\d+$/.test(payload.sub) || typeof payload.jti !== 'string') return null;
  const hash = crypto.createHash('sha256').update(token).digest();
  const user = await repo.activeSession(hash);
  if (!user || String(user.user_id) !== payload.sub || user.status !== 'active') return null;
  return { user: publicOwnUser(user), userId: user.user_id, tokenHash: hash };
}
async function logout(req) {
  const token = cookies.read(req, cookies.SESSION_COOKIE);
  if (token) await repo.revokeSession(crypto.createHash('sha256').update(token).digest());
}
async function changePassword(userId, currentTokenHash, input) {
  const row = assertActive(await repo.byId(userId));
  if (!row.password_hash) {
    throw new HttpError(409, 'PASSWORD_NOT_SET', 'This account uses social sign-in');
  }
  if (typeof input.currentPassword !== 'string' ||
      !(await bcrypt.compare(input.currentPassword, row.password_hash))) {
    throw new HttpError(403, 'CURRENT_PASSWORD_INVALID', 'Current password is incorrect');
  }
  const nextPassword = passwordOf(input.newPassword);
  if (await bcrypt.compare(nextPassword, row.password_hash)) {
    throw new HttpError(400, 'PASSWORD_UNCHANGED', 'Choose a different password');
  }
  await repo.updatePassword(userId, await bcrypt.hash(nextPassword, 12), currentTokenHash);
  return { changed: true };
}
async function forgotPassword(input) {
  const email = emailOf(input.email);
  mail.smtpConfig();
  const user = await repo.byEmail(email);
  if (user && user.status === 'active' && !email.endsWith('@example.invalid') &&
      !(await repo.recentReset(user.user_id))) {
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = crypto.createHash('sha256').update(token).digest();
    await repo.createReset(user.user_id, hash);
    const link = new URL('reset-password.html', config.frontendUrl);
    link.searchParams.set('token', token);
    await mail.sendPasswordReset(email, link.href);
  }
  return { message: 'If an account exists for that email, a reset link is on its way.' };
}
async function resetPassword(input) {
  if (typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) {
    throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or expired');
  }
  const password = passwordOf(input.newPassword);
  const hash = crypto.createHash('sha256').update(input.token).digest();
  const connection = await repo.pool.getConnection();
  try {
    await connection.beginTransaction();
    const reset = await repo.validReset(connection, hash);
    if (!reset) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or expired');
    await repo.consumeReset(connection, reset.password_reset_token_id, reset.user_id,
      await bcrypt.hash(password, 12));
    await connection.commit();
    return { passwordUpdated: true };
  } catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}
module.exports = { forgotPassword, resetPassword, register, login, signInWithProvider, linkProviderToUser,
  createSession, authenticate, logout, changePassword };
