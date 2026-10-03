const crypto = require('crypto');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(16).toString('hex');

function adminLogin(req, res) {
  const { username, password } = req.body || {};

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return res.json({
      success: true,
      message: 'Admin login successful.',
      token: ADMIN_TOKEN,
      username: ADMIN_USERNAME,
      demo_notice: 'This is a demo authentication layer for local development only.',
    });
  }

  return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
}

function requireAdmin(req, res, next) {
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.replace('Bearer ', '')
    : req.headers['x-admin-token'];

  const bodyToken = req.body && req.body.token;
  const currentToken = headerToken || bodyToken;

  if (currentToken === ADMIN_TOKEN) {
    return next();
  }

  return res.status(401).json({ success: false, message: 'Admin authentication required.' });
}

module.exports = {
  adminLogin,
  requireAdmin,
  ADMIN_TOKEN,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
};
