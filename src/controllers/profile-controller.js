'use strict';
const profiles = require('../services/profile-service');

async function publicProfile(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ data: await profiles.publicProfile(req.params.username) });
}

async function ownProfile(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ data: await profiles.ownProfile(req.auth.userId) });
}

async function updateOwnProfile(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ data: await profiles.updateOwnProfile(req.auth.userId, req.body) });
}

async function updateOwnSettings(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ data: await profiles.updateOwnSettings(req.auth.userId, req.body) });
}

module.exports = { publicProfile, ownProfile, updateOwnProfile, updateOwnSettings };
