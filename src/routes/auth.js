'use strict';
const express = require('express');
const controller = require('../controllers/auth-controller');
const requireAuth = require('../middlewares/require-auth');
const router = express.Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.post('/logout', controller.logout);
router.post('/forgot-password', controller.forgotPassword);
router.post('/reset-password', controller.resetPassword);
router.post('/change-password', requireAuth, controller.changePassword);
router.get('/me', requireAuth, controller.me);
for (const provider of ['google', 'facebook']) {
  router.get(`/${provider}`, controller.start(provider, false));
  router.get(`/${provider}/link`, requireAuth, controller.start(provider, true));
  router.get(`/${provider}/callback`, controller.callback(provider));
}
module.exports = router;
