'use strict';
const auth = require('../services/auth-service');
const HttpError = require('../utils/http-error');
module.exports = async function requireAuth(req, res, next) {
  const context = await auth.authenticate(req);
  if (!context) throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in required');
  req.auth = context;
  next();
};
