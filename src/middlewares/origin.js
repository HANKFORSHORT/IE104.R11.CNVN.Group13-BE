'use strict';
const config = require('../config');
const HttpError = require('../utils/http-error');
module.exports = function requireAllowedOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!config.frontendOrigins.has(req.get('Origin'))) {
    return next(new HttpError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed'));
  }
  return next();
};
