'use strict';

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) throw new Error(`Missing ${name}`);
  return value.trim();
}

function originOf(value, name) {
  let url;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${name}`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`Invalid ${name}`);
  }
  return url.origin;
}

const frontendUrl = required('FRONTEND_URL');
const frontendOrigin = originOf(frontendUrl, 'FRONTEND_URL');
const origins = (process.env.FRONTEND_ORIGINS || required('FRONTEND_ORIGIN'))
  .split(',').map((value) => value.trim()).filter(Boolean);
if (!origins.length || origins.some((value) => originOf(value, 'FRONTEND_ORIGIN') !== value) ||
    !origins.includes(frontendOrigin)) throw new Error('FRONTEND_ORIGIN must include FRONTEND_URL origin');
const jwtSecret = required('JWT_SECRET');
if (Buffer.byteLength(jwtSecret, 'utf8') < 32) throw new Error('JWT_SECRET must be at least 32 bytes');

function provider(prefix, idName) {
  const clientId = process.env[`${prefix}_${idName}`];
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`];
  const callbackUrl = process.env[`${prefix}_CALLBACK_URL`];
  const values = [clientId, clientSecret, callbackUrl];
  if (values.some(Boolean) && !values.every(Boolean)) throw new Error(`Incomplete ${prefix} OAuth configuration`);
  if (callbackUrl) {
    const url = new URL(callbackUrl);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      throw new Error(`Invalid ${prefix}_CALLBACK_URL`);
    }
  }
  return values.every(Boolean) ? { clientId, clientSecret, callbackUrl } : null;
}

const facebookGraphVersion = process.env.FACEBOOK_GRAPH_VERSION || 'v27.0';
if (!/^v\d+\.\d+$/.test(facebookGraphVersion)) throw new Error('Invalid FACEBOOK_GRAPH_VERSION');

module.exports = Object.freeze({
  frontendUrl, frontendOrigins: new Set(origins), jwtSecret,
  google: provider('GOOGLE', 'CLIENT_ID'),
  facebook: provider('FACEBOOK', 'APP_ID'),
  facebookGraphVersion,
  sessionSeconds: 7 * 24 * 60 * 60,
  oauthStateSeconds: 10 * 60
});
