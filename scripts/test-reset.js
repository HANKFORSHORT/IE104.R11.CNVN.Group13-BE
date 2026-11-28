'use strict';
process.env.DB_HOST = 'localhost';
process.env.FRONTEND_ORIGIN = 'http://localhost:5500';
process.env.FRONTEND_URL = 'http://localhost:5500/';
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-bytes';
process.env.SMTP_HOST = 'smtp.example.test';
process.env.SMTP_FROM = 'Astra <no-reply@example.test>';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const repo = require('../src/repositories/auth-repository');
const mail = require('../src/services/mail-service');
const service = require('../src/services/auth-service');

test('reset emails do not reveal users and tokens are single use', async () => {
  let resetHash = null;
  let used = false;
  let passwordHash = null;
  let sent = null;
  const connection = {
    beginTransaction: async () => {}, commit: async () => {},
    rollback: async () => {}, release: () => {}
  };
  repo.pool.getConnection = async () => connection;
  repo.byEmail = async (email) => email === 'sam@example.test'
    ? { user_id: 5, email, status: 'active' } : null;
  repo.recentReset = async () => false;
  repo.createReset = async (_userId, hash) => { resetHash = hash; };
  mail.sendPasswordReset = async (email, url) => { sent = { email, url }; };
  const unknown = await service.forgotPassword({ email: 'none@example.test' });
  assert.equal(sent, null);
  const known = await service.forgotPassword({ email: 'sam@example.test' });
  assert.deepEqual(known, unknown);
  assert.equal(sent.email, 'sam@example.test');
  const token = new URL(sent.url).searchParams.get('token');
  assert.equal(new URL(sent.url).pathname, '/reset-password.html');
  assert.deepEqual(crypto.createHash('sha256').update(token).digest(), resetHash);
  repo.validReset = async (_connection, hash) =>
    !used && hash.equals(resetHash) ? { password_reset_token_id: 1, user_id: 5 } : null;
  repo.consumeReset = async (_connection, _resetId, _userId, hash) => {
    used = true;
    passwordHash = hash;
  };
  const result = await service.resetPassword({ token, newPassword: 'a-new-secret-password' });
  assert.equal(result.passwordUpdated, true);
  assert.equal(await bcrypt.compare('a-new-secret-password', passwordHash), true);
  await assert.rejects(service.resetPassword({ token, newPassword: 'another-new-password' }),
    { status: 400, code: 'INVALID_RESET_TOKEN' });
});
