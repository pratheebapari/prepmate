const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { signToken, authRequired, requireRole, logAudit } = require('./helpers');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

const FACULTY_CODE = process.env.FACULTY_CODE || 'PREPMATE-FACULTY';

app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, access_code } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required' });
  }
  const wantsFaculty = role === 'FACULTY';
  if (wantsFaculty && access_code !== FACULTY_CODE) {
    return res.status(403).json({ error: 'Invalid faculty access code' });
  }
  const mail = String(email).toLowerCase().trim();
  if (db.findOne('users', u => u.email === mail)) return res.status(409).json({ error: 'Email already registered' });
  const user = db.insert('users', {
    name: String(name).trim(), email: mail, password_hash: bcrypt.hashSync(password, 10), role: wantsFaculty ? 'FACULTY' : 'STUDENT'
  });
  logAudit(user, 'REGISTER', mail);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  const user = db.findOne('users', u => u.email === String(email || '').toLowerCase().trim());
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (role === 'FACULTY' && user.role === 'STUDENT') {
    return res.status(403).json({ error: 'This is a student account. Use the Student tab to sign in.' });
  }
  if (role === 'STUDENT' && user.role !== 'STUDENT') {
    return res.status(403).json({ error: 'This is a faculty account. Use the Faculty tab to sign in.' });
  }
  db.insert('activities', {
    user_id: user.id, user_name: user.name, role: user.role, type: 'LOGIN', ref_type: null, ref_id: null, meta: {}
  });
  res.json({ token: signToken(user), user: publicUser(user) });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.find('users', req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(publicUser(user));
});

app.post('/api/admin/users', authRequired, requireRole('ADMIN'), (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || password.length < 6 || !['FACULTY', 'STUDENT'].includes(role)) {
    return res.status(400).json({ error: 'name, email, password (6+) and role FACULTY or STUDENT are required' });
  }
  const mail = String(email).toLowerCase().trim();
  if (db.findOne('users', u => u.email === mail)) return res.status(409).json({ error: 'Email already registered' });
  const user = db.insert('users', {
    name: String(name).trim(), email: mail, password_hash: bcrypt.hashSync(password, 10), role
  });
  logAudit(req.user, 'USER_CREATED', `${mail} as ${role}`);
  res.status(201).json(publicUser(user));
});

app.get('/api/admin/users', authRequired, requireRole('ADMIN'), (req, res) => {
  res.json(db.all('users').map(publicUser));
});

app.use(require('./features'));

require('./seed-quizzes')(db);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`PrepMate running at http://localhost:${PORT}`));
