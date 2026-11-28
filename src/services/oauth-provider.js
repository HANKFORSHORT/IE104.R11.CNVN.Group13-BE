'use strict';
const crypto = require('node:crypto');
const config = require('../config');
const HttpError = require('../utils/http-error');

function settings(provider) {
  const value = config[provider];
  if (!value) throw new HttpError(503, 'OAUTH_UNAVAILABLE', `${provider} login is not configured`);
  return value;
}
function authorizationUrl(provider, state, codeVerifier) {
  const providerConfig = settings(provider);
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: providerConfig.clientId, redirect_uri: providerConfig.callbackUrl,
      response_type: 'code', scope: 'openid email profile', state,
      code_challenge: crypto.createHash('sha256').update(codeVerifier).digest('base64url'),
      code_challenge_method: 'S256'
    }).toString();
    return url.href;
  }
  const url = new URL(`https://www.facebook.com/${config.facebookGraphVersion}/dialog/oauth`);
  url.search = new URLSearchParams({ client_id: providerConfig.clientId,
    redirect_uri: providerConfig.callbackUrl, response_type: 'code', scope: 'email,public_profile', state }).toString();
  return url.href;
}
async function jsonRequest(url, options) {
  let response;
  try { response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) }); }
  catch { throw new HttpError(502, 'OAUTH_PROVIDER_UNAVAILABLE', 'Login provider is unavailable'); }
  if (!response.ok) throw new HttpError(502, 'OAUTH_PROVIDER_ERROR', 'Login provider rejected the request');
  try { return await response.json(); }
  catch { throw new HttpError(502, 'OAUTH_PROVIDER_ERROR', 'Login provider returned invalid data'); }
}
function safeAvatar(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try { return new URL(value).protocol === 'https:' ? value : null; } catch { return null; }
}
async function profileFromCode(provider, code, codeVerifier) {
  const providerConfig = settings(provider);
  if (typeof code !== 'string' || code.length > 4096 || !code) {
    throw new HttpError(400, 'OAUTH_CODE_MISSING', 'Login provider did not return a code');
  }
  if (provider === 'google') {
    const token = await jsonRequest('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: providerConfig.clientId,
        client_secret: providerConfig.clientSecret, redirect_uri: providerConfig.callbackUrl,
        grant_type: 'authorization_code', code_verifier: codeVerifier })
    });
    if (!token.access_token) throw new HttpError(502, 'OAUTH_PROVIDER_ERROR', 'Google did not return an access token');
    const info = await jsonRequest('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` }
    });
    return { provider: 'google', id: String(info.sub || ''), email: info.email,
      emailVerified: info.email_verified === true, name: info.name,
      avatarUrl: safeAvatar(info.picture) };
  }
  const tokenUrl = new URL(`https://graph.facebook.com/${config.facebookGraphVersion}/oauth/access_token`);
  tokenUrl.search = new URLSearchParams({ client_id: providerConfig.clientId,
    client_secret: providerConfig.clientSecret, redirect_uri: providerConfig.callbackUrl, code }).toString();
  const token = await jsonRequest(tokenUrl);
  if (!token.access_token) throw new HttpError(502, 'OAUTH_PROVIDER_ERROR', 'Facebook did not return an access token');
  const info = await jsonRequest(`https://graph.facebook.com/${config.facebookGraphVersion}/me?fields=id,name,email`, {
    headers: { Authorization: `Bearer ${token.access_token}` }
  });
  return { provider: 'facebook', id: String(info.id || ''), email: info.email,
    emailVerified: false, name: info.name, avatarUrl: null };
}
module.exports = { authorizationUrl, profileFromCode };
