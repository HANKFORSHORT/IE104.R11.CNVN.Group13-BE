'use strict';
const nodemailer = require('nodemailer');
const HttpError = require('../utils/http-error');

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const from = process.env.SMTP_FROM;
  if (!host || !from) throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'Password reset email is not configured');
  const port = Number(process.env.SMTP_PORT || 587);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'Password reset email is not configured');
  }
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (Boolean(user) !== Boolean(password)) {
    throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'Password reset email is not configured');
  }
  return { host, port, from, secure: process.env.SMTP_SECURE === 'true',
    auth: user ? { user, pass: password } : undefined };
}

async function sendPasswordReset(email, url) {
  const config = smtpConfig();
  const transport = nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.secure,
    auth: config.auth, requireTLS: !config.secure
  });
  try {
    await transport.sendMail({
      from: config.from, to: email, subject: 'Reset your Astra password',
      text: `Open this link to reset your Astra password (valid for 30 minutes):\n${url}\n\nIf you did not request this, you can ignore this email.`
    });
  } catch (error) {
    console.error('Password reset email failed:', error.code || 'SMTP_ERROR');
    throw new HttpError(503, 'EMAIL_UNAVAILABLE', 'Password reset email could not be sent');
  } finally { transport.close(); }
}
module.exports = { smtpConfig, sendPasswordReset };
