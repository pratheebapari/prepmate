const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const { authRequired, requireRole, logAudit, nextMinorVersion } = require('./helpers');

const router = express.Router();
const DATA_DIR = process.env.DATA_DIR || __dirname;
const uploadDir = path.join(DATA_DIR, 'uploads', 'materials');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^\w.\-]/g, '_'))
  }),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const isStaff = u => u.role === 'FACULTY' || u.role === 'ADMIN';

function track(user, type, refType, refId, meta) {
  db.insert('activities', {
    user_id: user.id, user_name: user.name, role: user.role, type,
    ref_type: refType || null, ref_id: refId || null, meta: meta || {}
  });
  logAudit(user, type, `${refType || ''} ${refId || ''}`.trim());
}

function notify(userId, message) {
  db.insert('notifications', { user_id: userId, message, read: false });
}

function notifyRole(role, message) {
  db.all('users', u => u.role === role).forEach(u => notify(u.id, message));
}

function approvedVersions(studentId, title) {
  return db.all('resume_submissions', r => r.student_id === studentId && r.title === title && r.status === 'APPROVED');
}

const resumeDir = path.join(DATA_DIR, 'uploads', 'resumes');
fs.mkdirSync(resumeDir, { recursive: true });

const resumeTypes = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

const resumeUpload = multer({
  storage: multer.diskStorage({
    destination: resumeDir,
    filename: (req, file, cb) => cb(null, `${req.user.id}-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (resumeTypes[path.extname(file.originalname).toLowerCase()]) cb(null, true);
    else cb(new Error('Only PDF, DOC or DOCX files are allowed'));
  }
});

function receiveResume(req, res, next) {
  resumeUpload.single('file')(req, res, err => {
    if (err) {
      return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File must be 5 MB or smaller' : err.message });
    }
    next();
  });
}

function validSignature(file) {
  const fd = fs.openSync(file.path, 'r');
  const head = Buffer.alloc(4);
  fs.readSync(fd, head, 0, 4, 0);
  fs.closeSync(fd);
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') return head.toString('latin1') === '%PDF';
  if (ext === '.docx') return head[0] === 0x50 && head[1] === 0x4b;
  return head[0] === 0xd0 && head[1] === 0xcf;
}

const publicSubmission = ({ stored_name, ...rest }) => rest;

router.post('/api/resume-submissions', authRequired, requireRole('STUDENT'), receiveResume, (req, res) => {
  const file = req.file;
  const fail = (code, error) => {
    if (file) fs.unlink(file.path, () => {});
    return res.status(code).json({ error });
  };
  const title = String(req.body.title || '').trim();
  if (!file) return fail(400, 'Attach your resume as a PDF, DOC or DOCX file');
  if (!title) return fail(400, 'Resume name is required');
  if (!validSignature(file)) return fail(400, 'The file content does not match its file type');

  const duplicate = db.findOne('resume_submissions', r =>
    r.student_id === req.user.id && r.title === title && r.status === 'PENDING');
  if (duplicate) return fail(409, 'You already have a pending request for this resume');

  const prev = approvedVersions(req.user.id, title);
  const base = prev.length ? prev[prev.length - 1] : null;
  const row = db.insert('resume_submissions', {
    student_id: req.user.id, student_name: req.user.name, title, note: String(req.body.note || '').trim(),
    original_name: file.originalname, stored_name: file.filename,
    mime: resumeTypes[path.extname(file.originalname).toLowerCase()], size: file.size,
    base_id: base ? base.id : null, base_version: base ? base.version : null,
    status: 'PENDING', version: null, feedback: '',
    reviewer_id: null, reviewer_name: null, reviewed_at: null
  });
  notifyRole('FACULTY', `${req.user.name} uploaded a resume for approval: ${title}`);
  track(req.user, 'RESUME_SUBMITTED', 'resume_submission', row.id, { title, file: file.originalname });
  res.status(201).json(publicSubmission(row));
});

router.get('/api/resume-submissions', authRequired, (req, res) => {
  const { status, student_id, title } = req.query;
  let rows = db.all('resume_submissions', r => isStaff(req.user) || r.student_id === req.user.id);
  if (status) rows = rows.filter(r => r.status === status.toUpperCase());
  if (title) rows = rows.filter(r => r.title === title);
  if (student_id && isStaff(req.user)) rows = rows.filter(r => r.student_id === Number(student_id));
  rows.sort((a, b) => b.id - a.id);
  res.json(rows.map(publicSubmission));
});

router.get('/api/resume-submissions/:id/compare', authRequired, (req, res) => {
  const row = db.find('resume_submissions', req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!isStaff(req.user) && row.student_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const base = row.base_id ? db.find('resume_submissions', row.base_id) : null;
  res.json({ submission: publicSubmission(row), base: base ? publicSubmission(base) : null });
});

router.get('/api/resume-submissions/:id/file', authRequired, (req, res) => {
  const row = db.find('resume_submissions', req.params.id);
  if (!row || !row.stored_name) return res.status(404).json({ error: 'File not found' });
  if (!isStaff(req.user) && row.student_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
  const file = path.join(resumeDir, path.basename(row.stored_name));
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File missing on server' });
  if (isStaff(req.user)) track(req.user, 'RESUME_OPENED', 'resume_submission', row.id, { student: row.student_name });
  if (req.query.inline === '1' && row.mime === 'application/pdf') {
    return res.sendFile(file, { headers: { 'Content-Type': row.mime, 'Content-Disposition': 'inline' } });
  }
  res.download(file, row.original_name);
});

router.post('/api/resume-submissions/:id/review', authRequired, requireRole('FACULTY', 'ADMIN'), (req, res) => {
  const { decision, feedback } = req.body;
  if (!['APPROVED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be APPROVED or REJECTED' });
  }
  const row = db.find('resume_submissions', req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'PENDING') return res.status(409).json({ error: 'Already reviewed' });

  const patch = {
    status: decision, feedback: feedback || '',
    reviewer_id: req.user.id, reviewer_name: req.user.name, reviewed_at: new Date().toISOString()
  };
  if (decision === 'APPROVED') {
    const prev = approvedVersions(row.student_id, row.title);
    patch.version = nextMinorVersion(prev.length ? prev[prev.length - 1].version : null);
  }
  const updated = db.update('resume_submissions', row.id, patch);
  notify(row.student_id, `Your resume "${row.title}" was ${decision.toLowerCase()}`);
  track(req.user, `RESUME_${decision}`, 'resume_submission', row.id, { student: row.student_name });
  res.json(publicSubmission(updated));
});

router.post('/api/resume-submissions/:id/withdraw', authRequired, requireRole('STUDENT'), (req, res) => {
  const row = db.find('resume_submissions', req.params.id);
  if (!row || row.student_id !== req.user.id) return res.status(404).json({ error: 'Not found' });
  if (row.status !== 'PENDING') return res.status(409).json({ error: 'Only pending requests can be withdrawn' });
  const updated = db.update('resume_submissions', row.id, { status: 'WITHDRAWN' });
  track(req.user, 'RESUME_WITHDRAWN', 'resume_submission', row.id);
  res.json(publicSubmission(updated));
});

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; }
      else quoted = !quoted;
    } else if (c === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseQuestions(csv) {
  return csv.split(/\r?\n/)
    .filter(l => l.trim())
    .map(parseCsvLine)
    .filter(c => c.length >= 6 && !/^question$/i.test(c[0]))
    .map(c => ({
      question: c[0],
      options: c.slice(1, 5).filter(Boolean),
      correct_index: Number(c[5]) - 1,
      explanation: c[6] || ''
    }));
}

function validQuestions(qs) {
  return Array.isArray(qs) && qs.length > 0 && qs.every(q =>
    q.question && Array.isArray(q.options) && q.options.length >= 2 &&
    Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length);
}

function quizSummary(q) {
  return {
    id: q.id, title: q.title, topic: q.topic, category: q.category, difficulty: q.difficulty,
    duration_minutes: q.duration_minutes, question_count: q.questions.length,
    created_by_name: q.created_by_name, created_at: q.created_at, published: q.published,
    attempts: db.count('quiz_attempts', a => a.quiz_id === q.id)
  };
}

router.post('/api/quizzes', authRequired, requireRole('FACULTY', 'ADMIN'), (req, res) => {
  const { title, topic, category, difficulty, duration_minutes, csv } = req.body;
  let questions = req.body.questions;
  if (!questions && csv) questions = parseQuestions(csv);
  if (!title || !topic || !validQuestions(questions)) {
    return res.status(400).json({ error: 'title, topic and valid questions are required' });
  }
  const quiz = db.insert('quizzes', {
    title, topic, category: category || 'Aptitude', difficulty: difficulty || 'Medium',
    duration_minutes: Number(duration_minutes) || 0,
    questions: questions.map(q => ({
      question: String(q.question).trim(), options: q.options.map(String),
      correct_index: q.correct_index, explanation: q.explanation || ''
    })),
    created_by: req.user.id, created_by_name: req.user.name, published: true, archived: false
  });
  notifyRole('STUDENT', `New quiz available: ${title} (${topic})`);
  track(req.user, 'QUIZ_CREATED', 'quiz', quiz.id, { title, topic });
  res.status(201).json(quizSummary(quiz));
});

router.get('/api/quizzes', authRequired, (req, res) => {
  const { topic, category, difficulty, q } = req.query;
  let rows = db.all('quizzes', x => !x.archived && (isStaff(req.user) || x.published));
  if (topic) rows = rows.filter(x => x.topic.toLowerCase() === topic.toLowerCase());
  if (category) rows = rows.filter(x => x.category.toLowerCase() === category.toLowerCase());
  if (difficulty) rows = rows.filter(x => x.difficulty.toLowerCase() === difficulty.toLowerCase());
  if (q) rows = rows.filter(x => x.title.toLowerCase().includes(q.toLowerCase()));
  rows.sort((a, b) => b.id - a.id);
  res.json(rows.map(quizSummary));
});

router.get('/api/quizzes/topics', authRequired, (req, res) => {
  const rows = db.all('quizzes', x => !x.archived && (isStaff(req.user) || x.published));
  const counts = {};
  rows.forEach(x => { counts[x.topic] = (counts[x.topic] || 0) + 1; });
  res.json(Object.entries(counts).map(([topic, quizzes]) => ({ topic, quizzes })));
});

router.get('/api/quizzes/attempts/mine', authRequired, requireRole('STUDENT'), (req, res) => {
  const rows = db.all('quiz_attempts', a => a.student_id === req.user.id).sort((a, b) => b.id - a.id);
  res.json(rows);
});

router.get('/api/quizzes/:id', authRequired, (req, res) => {
  const quiz = db.find('quizzes', req.params.id);
  if (!quiz || quiz.archived || (!isStaff(req.user) && !quiz.published)) {
    return res.status(404).json({ error: 'Quiz not found' });
  }
  if (isStaff(req.user)) return res.json(quiz);
  res.json({
    ...quizSummary(quiz),
    questions: quiz.questions.map(x => ({ question: x.question, options: x.options }))
  });
});

router.patch('/api/quizzes/:id', authRequired, requireRole('FACULTY', 'ADMIN'), (req, res) => {
  const quiz = db.find('quizzes', req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'ADMIN' && quiz.created_by !== req.user.id) return res.status(403).json({ error: 'Not your quiz' });
  const patch = {};
  ['title', 'topic', 'category', 'difficulty', 'published'].forEach(k => {
    if (req.body[k] !== undefined) patch[k] = req.body[k];
  });
  if (req.body.duration_minutes !== undefined) patch.duration_minutes = Number(req.body.duration_minutes) || 0;
  res.json(quizSummary(db.update('quizzes', quiz.id, patch)));
});

router.delete('/api/quizzes/:id', authRequired, requireRole('FACULTY', 'ADMIN'), (req, res) => {
  const quiz = db.find('quizzes', req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'ADMIN' && quiz.created_by !== req.user.id) return res.status(403).json({ error: 'Not your quiz' });
  db.update('quizzes', quiz.id, { archived: true });
  track(req.user, 'QUIZ_ARCHIVED', 'quiz', quiz.id);
  res.json({ ok: true });
});

router.post('/api/quizzes/:id/attempt', authRequired, requireRole('STUDENT'), (req, res) => {
  const quiz = db.find('quizzes', req.params.id);
  if (!quiz || quiz.archived || !quiz.published) return res.status(404).json({ error: 'Quiz not found' });
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  let score = 0;
  const results = quiz.questions.map((q, i) => {
    const chosen = Number.isInteger(answers[i]) ? answers[i] : null;
    const correct = chosen === q.correct_index;
    if (correct) score++;
    return {
      question: q.question, options: q.options, chosen,
      correct_index: q.correct_index, correct, explanation: q.explanation
    };
  });
  const total = quiz.questions.length;
  const percent = Math.round((score / total) * 100);
  const attemptNo = db.count('quiz_attempts', a => a.quiz_id === quiz.id && a.student_id === req.user.id) + 1;
  const attempt = db.insert('quiz_attempts', {
    quiz_id: quiz.id, quiz_title: quiz.title, topic: quiz.topic,
    student_id: req.user.id, student_name: req.user.name,
    score, total, percent, attempt_no: attemptNo,
    time_taken_sec: Number(req.body.time_taken_sec) || 0,
    answers: results.map(r => r.chosen)
  });
  track(req.user, 'QUIZ_ATTEMPTED', 'quiz', quiz.id, { percent, attempt_no: attemptNo });
  res.json({ attempt, results });
});

router.get('/api/quizzes/:id/leaderboard', authRequired, (req, res) => {
  const best = {};
  db.all('quiz_attempts', a => a.quiz_id === Number(req.params.id)).forEach(a => {
    if (!best[a.student_id] || a.percent > best[a.student_id].percent) {
      best[a.student_id] = { student_name: a.student_name, percent: a.percent, time_taken_sec: a.time_taken_sec };
    }
  });
  const rows = Object.values(best)
    .sort((a, b) => b.percent - a.percent || a.time_taken_sec - b.time_taken_sec)
    .slice(0, 10)
    .map((r, i) => ({ rank: i + 1, ...r }));
  res.json(rows);
});

router.get('/api/quizzes/:id/analytics', authRequired, requireRole('FACULTY', 'ADMIN'), (req, res) => {
  const quiz = db.find('quizzes', req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Not found' });
  const attempts = db.all('quiz_attempts', a => a.quiz_id === quiz.id);
  const perQuestion = quiz.questions.map((q, i) => {
    const answered = attempts.filter(a => a.answers[i] !== null && a.answers[i] !== undefined);
    const right = attempts.filter(a => a.answers[i] === q.correct_index).length;
    return {
      question: q.question,
      accuracy: attempts.length ? Math.round((right / attempts.length) * 100) : 0,
      skipped: attempts.length - answered.length
    };
  });
  res.json({
    title: quiz.title,
    attempts: attempts.length,
    unique_students: new Set(attempts.map(a => a.student_id)).size,
    average_percent: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length) : 0,
    per_question: perQuestion
  });
});

router.post('/api/materials', authRequired, requireRole('FACULTY', 'ADMIN'), upload.single('file'), (req, res) => {
  const { title, topic, description, link } = req.body;
  if (!title || !topic || (!req.file && !link)) {
    return res.status(400).json({ error: 'title, topic and a file or link are required' });
  }
  const material = db.insert('materials', {
    title, topic, description: description || '',
    kind: req.file ? 'FILE' : 'LINK', link: link || null,
    stored_name: req.file ? req.file.filename : null,
    original_name: req.file ? req.file.originalname : null,
    size: req.file ? req.file.size : 0,
    uploaded_by: req.user.id, uploaded_by_name: req.user.name, active: true
  });
  notifyRole('STUDENT', `New learning material: ${title} (${topic})`);
  track(req.user, 'MATERIAL_UPLOADED', 'material', material.id, { title, topic });
  res.status(201).json(material);
});

router.get('/api/materials', authRequired, (req, res) => {
  const { topic, q } = req.query;
  let rows = db.all('materials', m => m.active);
  if (topic) rows = rows.filter(m => m.topic.toLowerCase() === topic.toLowerCase());
  if (q) rows = rows.filter(m => m.title.toLowerCase().includes(q.toLowerCase()));
  rows.sort((a, b) => b.id - a.id);
  const done = new Set(
    db.all('material_progress', p => p.student_id === req.user.id && p.completed).map(p => p.material_id)
  );
  res.json(rows.map(m => ({ ...m, completed: done.has(m.id) })));
});

router.get('/api/materials/:id/open', authRequired, (req, res) => {
  const m = db.find('materials', req.params.id);
  if (!m || !m.active) return res.status(404).json({ error: 'Not found' });
  track(req.user, 'MATERIAL_OPENED', 'material', m.id, { title: m.title });
  if (m.kind === 'LINK') return res.json({ link: m.link });
  const file = path.join(uploadDir, m.stored_name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File missing on server' });
  res.download(file, m.original_name);
});

router.post('/api/materials/:id/complete', authRequired, requireRole('STUDENT'), (req, res) => {
  const m = db.find('materials', req.params.id);
  if (!m || !m.active) return res.status(404).json({ error: 'Not found' });
  const existing = db.findOne('material_progress', p => p.material_id === m.id && p.student_id === req.user.id);
  if (existing) db.update('material_progress', existing.id, { completed: true });
  else db.insert('material_progress', { material_id: m.id, student_id: req.user.id, completed: true });
  track(req.user, 'MATERIAL_COMPLETED', 'material', m.id, { title: m.title });
  res.json({ ok: true });
});

router.delete('/api/materials/:id', authRequired, requireRole('FACULTY', 'ADMIN'), (req, res) => {
  const m = db.find('materials', req.params.id);
  if (!m) return res.status(404).json({ error: 'Not found' });
  if (req.user.role !== 'ADMIN' && m.uploaded_by !== req.user.id) return res.status(403).json({ error: 'Not yours' });
  db.update('materials', m.id, { active: false });
  track(req.user, 'MATERIAL_REMOVED', 'material', m.id);
  res.json({ ok: true });
});

router.get('/api/activities', authRequired, (req, res) => {
  const { user_id, type } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  let rows = db.all('activities', a => isStaff(req.user) || a.user_id === req.user.id);
  if (user_id && isStaff(req.user)) rows = rows.filter(a => a.user_id === Number(user_id));
  if (type) rows = rows.filter(a => a.type === type);
  res.json(rows.slice(-limit).reverse());
});

router.get('/api/notifications', authRequired, (req, res) => {
  const rows = db.all('notifications', n => n.user_id === req.user.id).sort((a, b) => b.id - a.id).slice(0, 50);
  res.json({ unread: rows.filter(n => !n.read).length, items: rows });
});

router.post('/api/notifications/read', authRequired, (req, res) => {
  db.all('notifications', n => n.user_id === req.user.id && !n.read).forEach(n => {
    db.update('notifications', n.id, { read: true });
  });
  res.json({ ok: true });
});

function streak(userId) {
  const days = new Set(db.all('activities', a => a.user_id === userId).map(a => a.created_at.slice(0, 10)));
  const d = new Date();
  if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

function topicStats(attempts) {
  const map = {};
  attempts.forEach(a => {
    const t = map[a.topic] || (map[a.topic] = { topic: a.topic, attempts: 0, sum: 0, best: 0 });
    t.attempts++;
    t.sum += a.percent;
    t.best = Math.max(t.best, a.percent);
  });
  return Object.values(map)
    .map(t => ({ topic: t.topic, attempts: t.attempts, average: Math.round(t.sum / t.attempts), best: t.best }))
    .sort((a, b) => a.average - b.average);
}

router.get('/api/dashboard/student', authRequired, requireRole('STUDENT'), (req, res) => {
  const attempts = db.all('quiz_attempts', a => a.student_id === req.user.id);
  const topics = topicStats(attempts);
  const subs = db.all('resume_submissions', r => r.student_id === req.user.id);
  const approved = subs.filter(r => r.status === 'APPROVED');
  res.json({
    quizzes_taken: attempts.length,
    average_percent: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length) : 0,
    topics,
    weak_topics: topics.filter(t => t.average < 60).slice(0, 3),
    materials_completed: db.count('material_progress', p => p.student_id === req.user.id && p.completed),
    materials_available: db.count('materials', m => m.active),
    resume: {
      pending: subs.filter(r => r.status === 'PENDING').length,
      approved: approved.length,
      rejected: subs.filter(r => r.status === 'REJECTED').length,
      latest_version: approved.length ? approved[approved.length - 1].version : null
    },
    streak_days: streak(req.user.id),
    recent_activity: db.all('activities', a => a.user_id === req.user.id).slice(-10).reverse()
  });
});

router.get('/api/dashboard/faculty', authRequired, requireRole('FACULTY', 'ADMIN'), (req, res) => {
  const attempts = db.all('quiz_attempts');
  const activity = {};
  db.all('activities', a => a.role === 'STUDENT').forEach(a => {
    const s = activity[a.user_id] || (activity[a.user_id] = { student_name: a.user_name, actions: 0 });
    s.actions++;
  });
  res.json({
    pending_resume_requests: db.count('resume_submissions', r => r.status === 'PENDING'),
    quizzes: db.count('quizzes', q => !q.archived),
    materials: db.count('materials', m => m.active),
    total_attempts: attempts.length,
    average_percent: attempts.length ? Math.round(attempts.reduce((s, a) => s + a.percent, 0) / attempts.length) : 0,
    topic_performance: topicStats(attempts),
    most_active_students: Object.values(activity).sort((a, b) => b.actions - a.actions).slice(0, 5)
  });
});

router.get('/api/leaderboard', authRequired, (req, res) => {
  const map = {};
  db.all('quiz_attempts').forEach(a => {
    const s = map[a.student_id] || (map[a.student_id] = { student_name: a.student_name, attempts: 0, sum: 0 });
    s.attempts++;
    s.sum += a.percent;
  });
  const rows = Object.values(map)
    .map(s => ({ student_name: s.student_name, attempts: s.attempts, average: Math.round(s.sum / s.attempts) }))
    .sort((a, b) => b.average - a.average || b.attempts - a.attempts)
    .slice(0, 20)
    .map((r, i) => ({ rank: i + 1, ...r }));
  res.json(rows);
});

module.exports = router;
