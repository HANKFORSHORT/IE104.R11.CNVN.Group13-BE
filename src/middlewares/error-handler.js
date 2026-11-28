'use strict';
const HttpError = require('../utils/http-error');
module.exports = function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  console.error('Request failed:', error.code || 'INTERNAL_ERROR');
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Server error' } });
};
