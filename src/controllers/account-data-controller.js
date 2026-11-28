'use strict';
const account = require('../services/account-data-service');

function send(res, data) {
  res.set('Cache-Control', 'no-store');
  res.json({ data });
}
async function ownSubmissions(req, res) {
  send(res, await account.ownSubmissions(req.auth.userId, req.query));
}
async function ownSolved(req, res) {
  send(res, await account.solvedForUser(req.auth.userId, req.query));
}
async function publicSolved(req, res) {
  send(res, await account.publicSolved(req.params.username, req.query));
}
async function ownNotifications(req, res) {
  send(res, await account.ownNotifications(req.auth.userId, req.query));
}
async function markRead(req, res) {
  send(res, await account.markRead(req.auth.userId, req.params.id));
}
async function markAllRead(req, res) {
  send(res, await account.markAllRead(req.auth.userId));
}
module.exports = { ownSubmissions, ownSolved, publicSolved, ownNotifications, markRead, markAllRead };
