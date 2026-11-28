'use strict';
const crypto = require('node:crypto');
const config = require('../config');

function encode(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function sign(payload, lifetimeSeconds, audience) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode({ ...payload, iss: 'astra-api', aud: audience, iat: now, exp: now + lifetimeSeconds });
  const data = `${header}.${body}`;
  const signature = crypto.createHmac('sha256', config.jwtSecret).update(data).digest('base64url');
  return `${data}.${signature}`;
}
function verify(token, audience) {
  if (typeof token !== 'string' || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header.alg !== 'HS256' || header.typ !== 'JWT' || payload.iss !== 'astra-api' ||
        payload.aud !== audience || !Number.isInteger(payload.exp) ||
        payload.exp <= Math.floor(Date.now() / 1000) ||
        !Number.isInteger(payload.iat) || payload.iat > Math.floor(Date.now() / 1000) + 60) return null;
    const expected = crypto.createHmac('sha256', config.jwtSecret).update(`${parts[0]}.${parts[1]}`).digest();
    const supplied = Buffer.from(parts[2], 'base64url');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
    return payload;
  } catch { return null; }
}
module.exports = { sign, verify };
