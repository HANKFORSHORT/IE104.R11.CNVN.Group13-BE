'use strict';
const crypto = require('node:crypto');
const auth = require('../services/auth-service');
const oauth = require('../services/oauth-provider');
const config = require('../config');
const jwt = require('../utils/jwt');
const cookies = require('../utils/cookies');
const HttpError = require('../utils/http-error');

function returnTo(value) {
  let url;
  try { url = new URL(value || 'profile.html', config.frontendUrl); }
  catch { throw new HttpError(400, 'INVALID_RETURN_URL', 'Invalid return URL'); }
  if (url.origin !== new URL(config.frontendUrl).origin || !['http:', 'https:'].includes(url.protocol)) {
    throw new HttpError(400, 'INVALID_RETURN_URL', 'Invalid return URL');
  }
  return url.href;
}
function failureUrl(destination, code) {
  const url = new URL('login.html', config.frontendUrl);
  url.searchParams.set('auth_error', code);
  if (code === 'ACCOUNT_LINK_REQUIRED') {
    url.searchParams.set('provider', 'facebook');
    if (destination) url.searchParams.set('returnTo', destination);
  }
  return url.href;
}
function validState(req, provider, res) {
  const token = cookies.read(req, cookies.STATE_COOKIE);
  cookies.clearState(res);
  const state = jwt.verify(token, 'astra-oauth-state');
  const returned = req.query.state;
  if (!state || state.provider !== provider || typeof state.nonce !== 'string' ||
      typeof returned !== 'string' || returned.length !== state.nonce.length ||
      !crypto.timingSafeEqual(Buffer.from(returned), Buffer.from(state.nonce))) {
    throw new HttpError(400, 'OAUTH_STATE_INVALID', 'Login request expired or was not started here');
  }
  return state;
}
async function register(req, res) {
  const user = await auth.register(req.body || {});
  const token = await auth.createSession(user.id);
  cookies.session(res, token, config.sessionSeconds * 1000);
  res.status(201).json({ data: user });
}
async function login(req, res) {
  const user = await auth.login(req.body || {});
  const token = await auth.createSession(user.id);
  cookies.session(res, token, config.sessionSeconds * 1000);
  res.json({ data: user });
}
async function me(req, res) { res.json({ data: req.auth.user }); }
async function logout(req, res) {
  await auth.logout(req);
  cookies.clearSession(res);
  res.json({ data: { signedOut: true } });
}
async function changePassword(req, res) {
  res.json({ data: await auth.changePassword(req.auth.userId, req.auth.tokenHash, req.body || {}) });
}
function start(provider, link) {
  return async (req, res) => {
    const nonce = crypto.randomBytes(32).toString('base64url');
    const codeVerifier = provider === 'google' ? crypto.randomBytes(32).toString('base64url') : null;
    const destination = returnTo(req.query.returnTo);
    const state = jwt.sign({ provider, nonce, codeVerifier, destination,
      linkUserId: link ? String(req.auth.userId) : null }, config.oauthStateSeconds, 'astra-oauth-state');
    // Build the provider URL before setting a state cookie, so an unconfigured
    // provider does not leave a stale OAuth transaction in the browser.
    const location = oauth.authorizationUrl(provider, nonce, codeVerifier);
    cookies.state(res, state, config.oauthStateSeconds * 1000);
    res.redirect(location);
  };
}
function callback(provider) {
  return async (req, res) => {
    let state;
    try {
      state = validState(req, provider, res);
      if (req.query.error) throw new HttpError(400, 'OAUTH_CANCELLED', 'Login was cancelled');
      const profile = await oauth.profileFromCode(provider, req.query.code, state.codeVerifier);
      if (state.linkUserId) {
        const context = await auth.authenticate(req);
        if (!context || String(context.userId) !== state.linkUserId) {
          throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in again to link this provider');
        }
        await auth.linkProviderToUser(context.userId, profile);
      } else {
        const user = await auth.signInWithProvider(profile);
        const token = await auth.createSession(user.id);
        cookies.session(res, token, config.sessionSeconds * 1000);
      }
      res.redirect(state.destination);
    } catch (error) {
      if (!(error instanceof HttpError)) console.error('OAuth callback failed:', error.code || 'INTERNAL_ERROR');
      res.redirect(failureUrl(state && state.destination, error.code || 'OAUTH_FAILED'));
    }
  };
}
async function forgotPassword(req, res) {
  res.json({ data: await auth.forgotPassword(req.body || {}) });
}
async function resetPassword(req, res) {
  res.json({ data: await auth.resetPassword(req.body || {}) });
}
module.exports = { forgotPassword, resetPassword, register, login, me, logout, changePassword, start, callback };
