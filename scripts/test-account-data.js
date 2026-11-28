'use strict';
process.env.DB_HOST = 'localhost';
process.env.FRONTEND_ORIGIN = 'http://localhost:5500';
process.env.FRONTEND_URL = 'http://localhost:5500/';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-bytes';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const service = require('../src/services/account-data-service');
const repo = require('../src/repositories/account-data-repository');
const profiles = require('../src/repositories/profile-repository');

test('account lists use stable cursors and public solved respects profile visibility', async () => {
  const seen = [];
  const rows = [
    { submission_id: 8, submitted_at: new Date('2026-11-28T10:00:00Z'),
      problem_slug: 'a-plus-b', problem_title: 'A + B', language_name: 'C++',
      status: 'completed', verdict: 'AC', score: '100.00', code_size_bytes: 128 },
    { submission_id: 7, submitted_at: new Date('2026-11-28T09:00:00Z'),
      problem_slug: 'a-plus-b', problem_title: 'A + B', language_name: 'C++',
      status: 'completed', verdict: 'WA', score: '0.00', code_size_bytes: 128 }
  ];
  repo.submissions = async (userId, cursor, limit) => {
    seen.push({ userId, cursor, limit });
    return cursor ? rows.slice(1) : rows;
  };
  const first = await service.ownSubmissions(4, { limit: '1' });
  assert.equal(first.items[0].id, '8');
  assert.equal(first.items[0].score, 100);
  assert.ok(first.nextCursor);
  const second = await service.ownSubmissions(4, { limit: '1', cursor: first.nextCursor });
  assert.equal(seen[1].cursor.id, '8');
  assert.equal(second.items[0].id, '7');
  assert.equal(second.nextCursor, null);
  await assert.rejects(service.ownSubmissions(4, { limit: '0' }), { status: 400 });
  await assert.rejects(service.ownSubmissions(4, { cursor: 'bad' }), { status: 400 });

  profiles.findPublicByUsername = async () => null;
  await assert.rejects(service.publicSolved('private_user', {}), { status: 404 });
  profiles.findPublicByUsername = async () => ({ user_id: 4 });
  repo.solved = async (id) => {
    assert.equal(id, 4);
    return [{ problem_id: 2, first_ac_at: new Date('2026-11-28T10:00:00Z'),
      slug: 'a-plus-b', title: 'A + B', difficulty: 'easy' }];
  };
  const solved = await service.publicSolved('public_user', {});
  assert.equal(solved.items[0].problemSlug, 'a-plus-b');
});
