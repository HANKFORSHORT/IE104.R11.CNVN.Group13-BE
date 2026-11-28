'use strict';
process.env.DB_HOST = 'localhost';
process.env.FRONTEND_ORIGIN = 'http://localhost:5500';
process.env.FRONTEND_URL = 'http://localhost:5500/';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-bytes';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const repo = require('../src/repositories/profile-repository');
const auth = require('../src/services/auth-service');
const router = require('../src/routes/profiles');
const requireAllowedOrigin = require('../src/middlewares/origin');
const errorHandler = require('../src/middlewares/error-handler');

test('public and private profile API, updates, validation and conflicts', async () => {
  const user = {
    user_id: 7, handle: 'sam_lee', email: 'sam@example.com', display_name: 'Sam Lee',
    bio: 'Solving problems', country_code: 'VN', region: 'APAC',
    avatar_url: null, rating: 1200, max_rating: 1300,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    theme: 'dark', default_language_id: null,
    is_source_public: 0, is_profile_public: 1,
    is_email_notification_enabled: 1, is_site_notification_enabled: 1
  };
  repo.findPublicByUsername = async (username) =>
    username.toLowerCase() === user.handle.toLowerCase() && user.is_profile_public ? user : null;
  repo.findOwnById = async (id) => String(id) === '7' ? user : null;
  repo.metrics = async () => ({
    solvedCount: 3, submissionCount: 9,
    activity: [{ day: '2026-11-20', count: 2 }],
    achievements: [{ code: 'first-ac', name: 'First AC', imagePath: null,
      earnedAt: '2026-11-20T00:00:00.000Z' }]
  });
  repo.providers = async () => ['google'];
  repo.update = async (_id, changes) => {
    if (changes.username === 'taken') {
      const error = new Error('duplicate');
      error.code = 'ER_DUP_ENTRY';
      throw error;
    }
    const columns = {
      username: 'handle', displayName: 'display_name', bio: 'bio',
      avatarUrl: 'avatar_url', country: 'country_code'
    };
    for (const [key, value] of Object.entries(changes)) user[columns[key]] = value;
  };
  auth.authenticate = async (req) => req.get('Cookie') === 'astra-test=1'
    ? { userId: 7, user: { id: '7' } } : null;

  const app = express();
  app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use('/api/v1', requireAllowedOrigin, router);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const own = { Origin: process.env.FRONTEND_ORIGIN, Cookie: 'astra-test=1' };
  try {
    const publicResponse = await fetch(`${base}/users/sam_lee`);
    assert.equal(publicResponse.status, 200);
    const publicBody = (await publicResponse.json()).data;
    assert.equal(publicBody.username, 'sam_lee');
    assert.equal(publicBody.solvedCount, 3);
    assert.equal(publicBody.submissionCount, 9);
    assert.equal(publicBody.email, undefined);
    assert.equal(publicBody.settings, undefined);
    assert.equal(publicBody.linkedProviders, undefined);
    assert.equal((await fetch(`${base}/me`)).status, 401);

    const ownResponse = await fetch(`${base}/me`, { headers: own });
    assert.equal(ownResponse.status, 200);
    const ownBody = (await ownResponse.json()).data;
    assert.equal(ownBody.email, 'sam@example.com');
    assert.deepEqual(ownBody.linkedProviders, ['google']);
    assert.equal(ownBody.settings.theme, 'dark');

    user.is_profile_public = 0;
    const privateResponse = await fetch(`${base}/users/sam_lee`);
    assert.equal(privateResponse.status, 404);
    assert.equal((await privateResponse.json()).error.code, 'USER_NOT_FOUND');
    assert.equal((await fetch(`${base}/me`, { headers: own })).status, 200);
    user.is_profile_public = 1;

    async function patch(body, headers = own) {
      return fetch(`${base}/me`, {
        method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    }
    const updated = await patch({ username: 'sam_new', displayName: 'Sam',
      bio: 'New bio', avatarUrl: 'https://example.com/avatar.png', country: 'us' });
    assert.equal(updated.status, 200);
    const updatedBody = (await updated.json()).data;
    assert.equal(updatedBody.username, 'sam_new');
    assert.equal(updatedBody.country, 'US');
    assert.equal(updatedBody.bio, 'New bio');
    assert.equal((await fetch(`${base}/users/sam_new`)).status, 200);
    assert.equal((await fetch(`${base}/users/sam_lee`)).status, 404);

    assert.equal((await patch({ email: 'other@example.com' })).status, 400);
    assert.equal((await patch({ bio: 'x'.repeat(201) })).status, 400);
    assert.equal((await patch({ avatarUrl: 'javascript:alert(1)' })).status, 400);
    const conflict = await patch({ username: 'taken' });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, 'USERNAME_TAKEN');
    assert.equal((await patch({ bio: 'Nope' }, { Origin: 'https://attacker.example',
      Cookie: 'astra-test=1' })).status, 403);
    assert.equal((await patch({ bio: 'Nope' }, { Origin: process.env.FRONTEND_ORIGIN })).status, 401);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
