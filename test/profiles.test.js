const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const dbPath = require.resolve('../db');
let publicProfile = true;
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    async query(sql, values) {
      assert.deepEqual(values, sql.includes('FROM users u') ? ['Ada'] : [7]);
      if (sql.includes('FROM users u')) {
        assert.match(sql, /is_profile_public/);
        return [publicProfile ? [{
        user_id: 7, handle: 'Ada', display_name: 'Ada Lovelace', bio: 'Solver',
        country_code: 'GB', region: 'Europe', avatar_url: null, rating: 1200, max_rating: 1300,
        email: 'must-not-leak@example.com', password_hash: 'must-not-leak'
      }] : []];
      }
      if (sql.includes('FROM user_problem_stats')) return [[{ solved: 2 }]];
      if (sql.includes('COUNT(*) AS total')) return [[{ total: 4 }]];
      if (sql.includes('DATE_FORMAT')) return [[{ day: '2026-11-28', count: 4 }]];
      if (sql.includes('FROM user_achievements')) return [[{
        code: 'first-light', name: 'First Light', image_path: 'images/badge-first-light.svg', earned_at: '2026-11-28'
      }]];
      throw new Error('Unexpected query');
    }
  }
};
const router = require('../routes/profiles');
const app = express();
app.use('/api/profiles', router);
let server;
let origin;
test.before(async () => {
  server = await new Promise((resolve) => {
    const running = app.listen(0, '127.0.0.1', () => resolve(running));
  });
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(() => server.close());

test('returns public database profile fields without credentials', async () => {
  publicProfile = true;
  const response = await fetch(origin + '/api/profiles/Ada');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.data.handle, 'Ada');
  assert.equal(result.data.solved, 2);
  assert.equal(result.data.submissionsTotal, 4);
  assert.deepEqual(result.data.activity, [{ day: '2026-11-28', count: 4 }]);
  assert.equal(result.data.achievements[0].code, 'first-light');
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false);
});

test('keeps unavailable profiles private', async () => {
  publicProfile = false;
  const response = await fetch(origin + '/api/profiles/Ada');
  assert.equal(response.status, 404);
  const result = await response.json();
  assert.equal(result.success, false);
});

test('rejects invalid handles before querying', async () => {
  const response = await fetch(origin + '/api/profiles/invalid%20handle');
  assert.equal(response.status, 404);
});
