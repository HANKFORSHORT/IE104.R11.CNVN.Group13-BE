'use strict';
const express = require('express');
const controller = require('../controllers/profile-controller');
const requireAuth = require('../middlewares/require-auth');
const account = require('../controllers/account-data-controller');

const router = express.Router();
router.get('/me', requireAuth, controller.ownProfile);
router.patch('/me', requireAuth, controller.updateOwnProfile);
router.patch('/me/settings', requireAuth, controller.updateOwnSettings);
router.get('/me/submissions', requireAuth, account.ownSubmissions);
router.get('/me/solved', requireAuth, account.ownSolved);
router.get('/me/notifications', requireAuth, account.ownNotifications);
router.patch('/me/notifications/:id', requireAuth, account.markRead);
router.post('/me/notifications/read-all', requireAuth, account.markAllRead);
router.get('/users/:username', controller.publicProfile);
router.get('/users/:username/solved', account.publicSolved);

module.exports = router;
