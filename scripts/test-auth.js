'use strict';
// Isolated API smoke test: an in-memory repository stands in for MySQL.
process.env.DB_HOST = 'localhost';
process.env.FRONTEND_ORIGIN = 'http://localhost:5500';
process.env.FRONTEND_URL = 'http://localhost:5500/';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-bytes';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const repo = require('../src/repositories/auth-repository');
const service = require('../src/services/auth-service');
const oauth = require('../src/services/oauth-provider');
const router = require('../src/routes/auth');
const requireAllowedOrigin = require('../src/middlewares/origin');
const errorHandler = require('../src/middlewares/error-handler');
const HttpError = require('../src/utils/http-error');

test('production can start with Google configured before Facebook', () => {
  const env = { NODE_ENV: 'production', FRONTEND_ORIGIN: 'https://astra.example',
    FRONTEND_URL: 'https://astra.example/', JWT_SECRET: 'test-only-secret-with-more-than-thirty-two-bytes',
    GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_CALLBACK_URL: 'https://api.example/api/v1/auth/google/callback' };
  const result = spawnSync(process.execPath,
    ['-e', "const c = require('./src/config'); if (!c.google || c.facebook) process.exit(1)"],
    { cwd: require('node:path').join(__dirname, '..'), env, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const partial = spawnSync(process.execPath, ['-e', "require('./src/config')"],
    { cwd: require('node:path').join(__dirname, '..'),
      env: { ...env, GOOGLE_CLIENT_SECRET: '' }, encoding: 'utf8' });
  assert.notEqual(partial.status, 0);
  assert.match(partial.stderr, /Incomplete GOOGLE OAuth configuration/);
});

test('email auth, cookies, origin checks, revocation and provider linking', async () => {
  const users = new Map();
  const sessions = new Map();
  const links = new Map();
  let nextId = 1;
  const connection = { beginTransaction: async () => {}, commit: async () => {},
    rollback: async () => {}, release: () => {} };
  repo.pool.getConnection = async () => connection;
  repo.byHandle = async (handle) => [...users.values()].find((user) => user.handle === handle) || null;
  repo.byEmail = async (email) => [...users.values()].find((user) => user.email === email) || null;
  repo.byId = async (id) => users.get(String(id)) || null;
  repo.byProvider = async (provider, id) => {
    const userId = links.get(`${provider}:${id}`);
    return userId ? users.get(userId) : null;
  };
  repo.createUser = async (_connection, data) => {
    const user = { user_id: nextId++, handle: data.handle, email: data.email,
      password_hash: data.passwordHash, display_name: data.displayName,
      avatar_url: data.avatarUrl, status: 'active', email_verified_at: data.emailVerified ? new Date() : null };
    users.set(String(user.user_id), user);
    return user;
  };
  repo.markEmailVerified = async (_connection, id) => { users.get(String(id)).email_verified_at = new Date(); };
  repo.linkProvider = async (_connection, id, provider, providerId) => {
    links.set(`${provider}:${providerId}`, String(id));
  };
  repo.createSession = async (id, hash) => { sessions.set(hash.toString('hex'), String(id)); };
  repo.activeSession = async (hash) => users.get(sessions.get(hash.toString('hex'))) || null;
  repo.revokeSession = async (hash) => { sessions.delete(hash.toString('hex')); };

  const app = express();
  app.use(cors({ origin: (origin, cb) => cb(null, origin === process.env.FRONTEND_ORIGIN), credentials: true }));
  app.use(express.json());
  app.use('/api/v1', requireAllowedOrigin);
  app.use('/api/v1/auth', router);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/auth`;
  const origin = process.env.FRONTEND_ORIGIN;
  try {
    const register = await fetch(`${base}/register`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sam_lee', email: 'SAM@example.com', password: 'long-private-password' }) });
    assert.equal(register.status, 201);
    assert.equal(register.headers.get('access-control-allow-origin'), origin);
    assert.equal(register.headers.get('access-control-allow-credentials'), 'true');
    const cookie = register.headers.get('set-cookie');
    assert.match(cookie, /__Host-astra_session=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=None/);
    const sessionCookie = cookie.split(';')[0];
    const registered = (await register.json()).data;
    assert.equal(registered.username, 'sam_lee');
    assert.equal(registered.email, 'sam@example.com');
    assert.equal(registered.password_hash, undefined);
    assert.equal(await bcrypt.compare('long-private-password', users.get('1').password_hash), true);

    const me = await fetch(`${base}/me`, { headers: { Cookie: sessionCookie, Origin: origin } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).data.id, '1');
    const denied = await fetch(`${base}/register`, { method: 'POST',
      headers: { Origin: 'https://attacker.example', 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error.code, 'ORIGIN_FORBIDDEN');
    const duplicate = await fetch(`${base}/register`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'sam_lee', email: 'other@example.com', password: 'long-private-password' }) });
    assert.equal(duplicate.status, 409);
    assert.equal((await duplicate.json()).error.code, 'USERNAME_TAKEN');
    const badLogin = await fetch(`${base}/login`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: 'wrong' }) });
    assert.equal(badLogin.status, 401);
    const oversizedLogin = await fetch(`${base}/login`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: `long-private-password${'x'.repeat(80)}` }) });
    assert.equal(oversizedLogin.status, 400);
    const logout = await fetch(`${base}/logout`, { method: 'POST',
      headers: { Origin: origin, Cookie: sessionCookie } });
    assert.equal(logout.status, 200);
    assert.equal((await fetch(`${base}/me`, { headers: { Cookie: sessionCookie, Origin: origin } })).status, 401);

    const facebook = { provider: 'facebook', id: 'fb-1', email: 'sam@example.com', name: 'Sam' };
    await assert.rejects(service.signInWithProvider(facebook),
      (error) => error instanceof HttpError && error.code === 'ACCOUNT_LINK_REQUIRED');
    oauth.authorizationUrl = (_provider, state) => `https://provider.example/login?state=${encodeURIComponent(state)}`;
    oauth.profileFromCode = async () => facebook;
    const start = await fetch(`${base}/facebook`, { redirect: 'manual', headers: { Origin: origin } });
    assert.equal(start.status, 302);
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const stateCookie = start.headers.get('set-cookie').split(';')[0];
    const callback = await fetch(`${base}/facebook/callback?state=${encodeURIComponent(state)}&code=mock-code`,
      { redirect: 'manual', headers: { Cookie: stateCookie } });
    assert.equal(callback.status, 302);
    assert.equal(new URL(callback.headers.get('location')).searchParams.get('auth_error'), 'ACCOUNT_LINK_REQUIRED');
    assert.equal(new URL(callback.headers.get('location')).pathname, '/login.html');
    const signedIn = await fetch(`${base}/login`, { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sam@example.com', password: 'long-private-password' }) });
    assert.equal(signedIn.status, 200);
    const newSessionCookie = signedIn.headers.get('set-cookie').split(';')[0];
    const linkStart = await fetch(`${base}/facebook/link`, { redirect: 'manual',
      headers: { Origin: origin, Cookie: newSessionCookie } });
    assert.equal(linkStart.status, 302);
    const linkState = new URL(linkStart.headers.get('location')).searchParams.get('state');
    const linkStateCookie = linkStart.headers.get('set-cookie').split(';')[0];
    const linkCallback = await fetch(`${base}/facebook/callback?state=${encodeURIComponent(linkState)}&code=mock-code`,
      { redirect: 'manual', headers: { Cookie: `${newSessionCookie}; ${linkStateCookie}` } });
    assert.equal(linkCallback.status, 302);
    assert.equal(new URL(linkCallback.headers.get('location')).pathname, '/profile.html');
    assert.equal(links.get('facebook:fb-1'), '1');
    const google = { provider: 'google', id: 'google-1', email: 'sam@example.com',
      emailVerified: true, name: 'Sam' };
    assert.equal((await service.signInWithProvider(google)).id, '1');
    assert.equal(links.get('google:google-1'), '1');
    assert.equal((await service.signInWithProvider(facebook)).id, '1');
    const noEmail = await service.signInWithProvider({ provider: 'facebook', id: 'fb-2', name: 'Jo' });
    assert.equal(noEmail.email, null);
    assert.match(users.get(noEmail.id).email, /^facebook-.*@example\.invalid$/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
