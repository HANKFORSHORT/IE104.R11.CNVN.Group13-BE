'use strict';
const SESSION_COOKIE = '__Host-astra_session';
const STATE_COOKIE = '__Host-astra_oauth_state';

function read(req, name) {
  const parts = (req.headers.cookie || '').split(';');
  const matches = parts.map((part) => part.trim()).filter((part) => part.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}
function session(res, token, maxAge) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'none', path: '/', maxAge });
}
function clearSession(res) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
}
function state(res, token, maxAge) {
  res.cookie(STATE_COOKIE, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge });
}
function clearState(res) {
  res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
}
module.exports = { SESSION_COOKIE, STATE_COOKIE, read, session, clearSession, state, clearState };
