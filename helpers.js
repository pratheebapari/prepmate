const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'prepmate-dev-secret-change-me';

function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '8h' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires one of roles: ${roles.join(', ')}` });
    }
    next();
  };
}

function logAudit(user, action, details) {
  db.insert('audit_logs', {
    user_id: user ? user.id : null,
    user_name: user ? user.name : 'System',
    action,
    details: details || ''
  });
}

function checksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
}

// Bumps a semantic-ish minor version: 1.0 -> 1.1 -> 1.2 ... -> 1.9 -> 2.0
function nextMinorVersion(current) {
  if (!current) return '1.0';
  const [maj, min] = current.split('.').map(Number);
  if (min >= 9) return `${maj + 1}.0`;
  return `${maj}.${min + 1}`;
}

module.exports = { signToken, authRequired, requireRole, logAudit, checksum, nextMinorVersion, JWT_SECRET };
