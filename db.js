const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const FILE = path.join(DATA_DIR, 'prepmate.json');

const EMPTY = {
  users: [], configuration_items: [], resumes: [], resume_versions: [],
  change_requests: [], baselines: [], baseline_items: [], audit_logs: [],
  aptitude_questions: [], test_attempts: [],
  technical_questions: [], technical_question_versions: [],
  releases: [], release_items: [],
  resume_submissions: [], quizzes: [], quiz_attempts: [],
  materials: [], material_progress: [], activities: [], notifications: []
};

let data;
if (fs.existsSync(FILE)) {
  data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  for (const key of Object.keys(EMPTY)) {
    if (!data[key]) data[key] = [];
  }
} else {
  data = JSON.parse(JSON.stringify(EMPTY));
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

function nextId(table) {
  const rows = data[table];
  return rows.length ? Math.max(...rows.map(r => r.id)) + 1 : 1;
}

function insert(table, obj) {
  const row = { id: nextId(table), created_at: new Date().toISOString(), ...obj };
  data[table].push(row);
  save();
  return row;
}

function all(table, filterFn) {
  const rows = data[table];
  return filterFn ? rows.filter(filterFn) : [...rows];
}

function find(table, id) {
  return data[table].find(r => r.id === Number(id));
}

function findOne(table, filterFn) {
  return data[table].find(filterFn);
}

function update(table, id, patch) {
  const row = find(table, id);
  if (!row) return null;
  Object.assign(row, patch);
  save();
  return row;
}

function count(table, filterFn) {
  return all(table, filterFn).length;
}

if (data.aptitude_questions.length === 0) {
  const seed = [
    ['Quantitative', 'A shop sells an item at 20% profit. If cost price is 500, what is the selling price?', ['520', '560', '600', '640'], 2],
    ['Quantitative', 'What is 15% of 240?', ['30', '36', '24', '40'], 1],
    ['Quantitative', 'If a train covers 300km in 5 hours, its speed is:', ['50 km/h', '60 km/h', '70 km/h', '45 km/h'], 1],
    ['Logical', 'Find the next number: 2, 6, 12, 20, 30, ?', ['40', '42', '36', '44'], 1],
    ['Logical', 'If FRIEND is coded as GSJFOE, how is CANDLE coded?', ['DBOEMF', 'DBOEMD', 'DBPEMF', 'DCOEMF'], 0],
    ['Verbal', 'Choose the synonym of "Abundant":', ['Scarce', 'Plentiful', 'Empty', 'Rare'], 1],
    ['Verbal', 'Choose the correctly spelled word:', ['Recieve', 'Receive', 'Receeve', 'Receve'], 1],
    ['DI', 'If a pie chart shows Sales=40%, Marketing=25%, R&D=35% of a 200 total budget, R&D value is:', ['60', '70', '80', '90'], 1],
  ];
  for (const [category, question, options, correct_index] of seed) {
    insert('aptitude_questions', { category, question, options, correct_index });
  }
}

if (data.users.length === 0) {
  const demo = [
    ['Admin', 'admin@prepmate.local', 'admin123', 'ADMIN'],
    ['Faculty Demo', 'faculty@prepmate.local', 'faculty123', 'FACULTY'],
    ['Student Demo', 'student@prepmate.local', 'student123', 'STUDENT']
  ];
  for (const [name, email, password, role] of demo) {
    insert('users', { name, email, password_hash: bcrypt.hashSync(password, 10), role });
  }
}

module.exports = { insert, all, find, findOne, update, count, save };
