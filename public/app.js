document.documentElement.dataset.theme = localStorage.getItem('pm_theme') || 'dark';

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('pm_theme', next);
}

const state = {
  token: localStorage.getItem('pm_token'),
  user: JSON.parse(localStorage.getItem('pm_user') || 'null'),
  view: 'dashboard',
  topic: '',
  category: '',
  authRole: 'STUDENT',
  search: '',
  resumeFilter: 'PENDING',
  quiz: null,
  timer: null,
  submissions: []
};

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const staff = () => state.user && state.user.role !== 'STUDENT';
const when = iso => new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const val = id => document.getElementById(id).value.trim();

function toast(message, bad) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = 'toast' + (bad ? ' bad' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.add('hidden'), 2800);
}

function openModal(html, wide) {
  const el = document.getElementById('modal');
  el.innerHTML = `<div class="box ${wide ? 'wide' : ''}">${html}<div style="margin-top:16px"><button onclick="closeModal()">Close</button></div></div>`;
  el.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

async function api(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const res = await fetch(url, { ...options, headers, body });
  const type = res.headers.get('content-type') || '';
  if (res.status === 401 && state.token) {
    logout();
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const err = type.includes('json') ? await res.json() : {};
    throw new Error(err.error || 'Request failed');
  }
  return type.includes('json') ? res.json() : res;
}

async function act(fn) {
  try {
    await fn();
  } catch (e) {
    toast(e.message, true);
  }
}

function logout() {
  localStorage.removeItem('pm_token');
  localStorage.removeItem('pm_user');
  state.token = null;
  state.user = null;
  clearInterval(state.timer);
  renderAuth();
}

function renderAuth(mode = 'login', role = state.authRole) {
  state.authRole = role;
  const reg = mode === 'register';
  const fac = role === 'FACULTY';
  const label = reg ? (fac ? 'Create faculty account' : 'Create student account') : (fac ? 'Faculty sign in' : 'Student sign in');
  document.getElementById('app').innerHTML = `
    <button class="ghost small auth-theme" onclick="toggleTheme()">Switch light / dark</button>
    <div class="auth">
      <h1>PrepMate</h1>
      <p>Placement preparation with versioned resumes and faculty review.</p>
      <div class="tabs">
        <button class="tab ${fac ? '' : 'on'}" onclick="renderAuth('${mode}', 'STUDENT')">Student</button>
        <button class="tab ${fac ? 'on' : ''}" onclick="renderAuth('${mode}', 'FACULTY')">Faculty</button>
      </div>
      <form onsubmit="event.preventDefault(); submitAuth('${mode}')">
        ${reg ? '<input id="a-name" placeholder="Full name" required>' : ''}
        <input id="a-email" type="email" placeholder="Email" required>
        <input id="a-pass" type="password" placeholder="Password" minlength="6" required>
        ${reg && fac ? '<input id="a-code" placeholder="Faculty access code" required>' : ''}
        <button class="primary" type="submit">${label}</button>
      </form>
      <p class="switch">${reg ? 'Already registered?' : (fac ? 'New faculty?' : 'New student?')}
        <a href="#" onclick="event.preventDefault(); renderAuth('${reg ? 'login' : 'register'}', '${role}')">${reg ? 'Sign in' : 'Create an account'}</a></p>
      <div class="demo">Demo login<br>${fac ? 'faculty@prepmate.local / faculty123<br>admin@prepmate.local / admin123' : 'student@prepmate.local / student123'}</div>
    </div>`;
}

function submitAuth(mode) {
  act(async () => {
    const body = { email: val('a-email'), password: document.getElementById('a-pass').value, role: state.authRole };
    if (mode === 'register') {
      body.name = val('a-name');
      if (state.authRole === 'FACULTY') body.access_code = val('a-code');
    }
    const data = await api('/api/auth/' + mode, { method: 'POST', body });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('pm_token', data.token);
    localStorage.setItem('pm_user', JSON.stringify(data.user));
    state.view = 'dashboard';
    renderShell();
  });
}

function navItems() {
  if (!staff()) {
    return [['dashboard', 'Dashboard'], ['quizzes', 'Quizzes'], ['materials', 'Learning materials'], ['resume', 'My resume'], ['activity', 'My activity'], ['leaderboard', 'Leaderboard']];
  }
  return [['dashboard', 'Dashboard'], ['resume', 'Resume requests'], ['quizzes', 'Quizzes'], ['materials', 'Learning materials'], ['activity', 'Activity log'], ['leaderboard', 'Leaderboard']];
}

async function renderShell() {
  document.getElementById('app').innerHTML = `
    <div class="shell">
      <aside class="side">
        <div class="brand">PrepMate</div>
        ${navItems().map(([id, label]) => `<button class="nav ${state.view === id ? 'active' : ''}" onclick="go('${id}')">${label}</button>`).join('')}
        <div class="spacer"></div>
        <div class="who"><b>${esc(state.user.name)}</b>${state.user.role.toLowerCase()}</div>
        <button class="ghost theme-toggle" onclick="toggleTheme()">Switch light / dark</button>
        <button class="ghost" onclick="logout()">Sign out</button>
      </aside>
      <main class="main">
        <div class="head"><h1 id="title"></h1><button class="bell ghost" onclick="showNotifications()">Notifications<i id="badge" class="hidden"></i></button></div>
        <div id="view"></div>
      </main>
    </div>`;
  document.getElementById('title').textContent = (navItems().find(n => n[0] === state.view) || [])[1] || '';
  refreshBadge();
  await act(async () => {
    document.getElementById('view').innerHTML = await views[state.view]();
  });
}

function go(view) {
  state.view = view;
  state.topic = '';
  state.category = '';
  state.search = '';
  state.quiz = null;
  clearInterval(state.timer);
  renderShell();
}

async function refresh() {
  await act(async () => {
    document.getElementById('view').innerHTML = await views[state.view]();
  });
}

async function refreshBadge() {
  try {
    const n = await api('/api/notifications');
    const badge = document.getElementById('badge');
    if (!badge) return;
    badge.textContent = n.unread;
    badge.classList.toggle('hidden', n.unread === 0);
  } catch (e) {}
}

function showNotifications() {
  act(async () => {
    const n = await api('/api/notifications');
    openModal(`<h2>Notifications</h2>${n.items.length ? n.items.map(i => `<div class="stack"><div>${esc(i.message)}</div><div class="meta muted">${when(i.created_at)}</div></div>`).join('') : '<p>Nothing yet.</p>'}`);
    await api('/api/notifications/read', { method: 'POST' });
    refreshBadge();
  });
}

function bars(rows) {
  if (!rows.length) return '<p>No quiz attempts yet.</p>';
  return rows.map(t => `<div class="row"><span>${esc(t.topic)}</span><div class="bar"><i style="width:${t.average}%"></i></div><b>${t.average}%</b></div>`).join('');
}

function activityTable(rows, showUser) {
  if (!rows.length) return '<p>No activity yet.</p>';
  return `<table><tr><th>Time</th>${showUser ? '<th>User</th>' : ''}<th>Action</th><th>Details</th></tr>${rows.map(a => `
    <tr><td>${when(a.created_at)}</td>${showUser ? `<td>${esc(a.user_name)}</td>` : ''}<td>${esc(a.type.replaceAll('_', ' ').toLowerCase())}</td>
    <td class="muted">${esc(Object.values(a.meta || {}).join(', '))}</td></tr>`).join('')}</table>`;
}

const views = {};

views.dashboard = async () => {
  if (!staff()) {
    const d = await api('/api/dashboard/student');
    return `
      <div class="stats">
        <div class="stat"><b>${d.quizzes_taken}</b><span>Quizzes taken</span></div>
        <div class="stat"><b>${d.average_percent}%</b><span>Average score</span></div>
        <div class="stat"><b>${d.streak_days}</b><span>Day streak</span></div>
        <div class="stat"><b>${d.materials_completed}/${d.materials_available}</b><span>Materials done</span></div>
        <div class="stat"><b>${d.resume.latest_version || '-'}</b><span>Approved resume version</span></div>
      </div>
      ${d.weak_topics.length ? `<div class="block"><h2>Needs practice</h2>${d.weak_topics.map(t => `<span class="tag bad">${esc(t.topic)} ${t.average}%</span> `).join('')}</div>` : ''}
      <div class="block"><h2>Topic performance</h2>${bars(d.topics)}</div>
      <div class="block"><h2>Resume requests</h2>
        <span class="tag PENDING">${d.resume.pending} pending</span>
        <span class="tag APPROVED">${d.resume.approved} approved</span>
        <span class="tag REJECTED">${d.resume.rejected} rejected</span></div>
      <div class="block"><h2>Recent activity</h2>${activityTable(d.recent_activity, false)}</div>`;
  }
  const d = await api('/api/dashboard/faculty');
  const admin = state.user.role === 'ADMIN' ? `
    <div class="block"><h2>Add a user</h2>
      <div class="form">
        <div class="two"><input id="u-name" placeholder="Name"><input id="u-email" type="email" placeholder="Email"></div>
        <div class="two"><input id="u-pass" type="password" placeholder="Password (6+)"><select id="u-role"><option>FACULTY</option><option>STUDENT</option></select></div>
        <div><button class="primary" onclick="createUser()">Create user</button></div>
      </div></div>` : '';
  return `
    <div class="stats">
      <div class="stat"><b>${d.pending_resume_requests}</b><span>Pending resume requests</span></div>
      <div class="stat"><b>${d.quizzes}</b><span>Quizzes</span></div>
      <div class="stat"><b>${d.materials}</b><span>Materials</span></div>
      <div class="stat"><b>${d.total_attempts}</b><span>Quiz attempts</span></div>
      <div class="stat"><b>${d.average_percent}%</b><span>Average score</span></div>
    </div>
    <div class="block"><h2>Topic performance</h2>${bars(d.topic_performance)}</div>
    <div class="block"><h2>Most active students</h2>${d.most_active_students.length ? d.most_active_students.map(s => `<div class="row"><span>${esc(s.student_name)}</span><div></div><b>${s.actions}</b></div>`).join('') : '<p>No student activity yet.</p>'}</div>
    ${admin}`;
};

function createUser() {
  act(async () => {
    await api('/api/admin/users', { method: 'POST', body: { name: val('u-name'), email: val('u-email'), password: document.getElementById('u-pass').value, role: val('u-role') } });
    toast('User created');
    refresh();
  });
}

views.quizzes = async () => {
  if (state.quiz) return state.quiz;
  const all = await api('/api/quizzes');
  const categories = [...new Set(all.map(q => q.category))];
  const inCategory = all.filter(q => !state.category || q.category === state.category);
  const topics = [...new Set(inCategory.map(q => q.topic))];
  const term = state.search.toLowerCase();
  const quizzes = inCategory.filter(q => (!state.topic || q.topic === state.topic) && (!term || q.title.toLowerCase().includes(term)));
  let html = '';
  if (staff()) {
    html += `
      <div class="block"><h2>Create a quiz</h2>
        <div class="form">
          <div class="two"><input id="qz-title" placeholder="Quiz title"><input id="qz-topic" placeholder="Topic (e.g. Percentages, Trains, DBMS)"></div>
          <div class="two">
            <select id="qz-cat"><option>Quantitative</option><option>Logical</option><option>Verbal</option><option>Soft Skills</option><option>Technical</option><option>Coding</option></select>
            <select id="qz-diff"><option>Easy</option><option selected>Medium</option><option>Hard</option></select>
          </div>
          <label>Time limit in minutes (0 for none)<input id="qz-dur" type="number" min="0" value="20"></label>
          <label>Questions as CSV: question,optionA,optionB,optionC,optionD,correct (1-4),explanation
            <textarea id="qz-csv" placeholder='What is 15% of 240?,30,36,24,40,2,"240 x 0.15 = 36"'></textarea></label>
          <label>Or load a CSV file<input type="file" id="qz-file" accept=".csv,text/csv" onchange="loadCsv(this)"></label>
          <div><button class="primary" onclick="createQuiz()">Publish quiz</button></div>
        </div></div>`;
  }
  html += `<div class="chips"><button class="chip ${state.category ? '' : 'on'}" data-v="" onclick="setCategory(this.dataset.v)">All categories</button>
    ${categories.map(c => `<button class="chip ${state.category === c ? 'on' : ''}" data-v="${esc(c)}" onclick="setCategory(this.dataset.v)">${esc(c)}</button>`).join('')}</div>
    <div class="chips"><button class="chip ${state.topic ? '' : 'on'}" data-v="" onclick="setTopic(this.dataset.v)">All topics</button>
    ${topics.map(t => `<button class="chip ${state.topic === t ? 'on' : ''}" data-v="${esc(t)}" onclick="setTopic(this.dataset.v)">${esc(t)}</button>`).join('')}</div>
    <input placeholder="Search quizzes" value="${esc(state.search)}" onchange="state.search=this.value; refresh()" style="margin-bottom:16px">
    <div class="list">${quizzes.length ? quizzes.map(q => `
      <div class="item"><div><h3>${esc(q.title)}</h3>
        <div class="meta">${esc(q.category)} · ${esc(q.topic)} · ${esc(q.difficulty)} · ${q.question_count} questions${q.duration_minutes ? ' · ' + q.duration_minutes + ' min' : ''} · ${q.attempts} attempts</div></div>
        <div class="actions">${staff() ? `
          <button class="small" onclick="showAnalytics(${q.id})">Analytics</button>
          <button class="small" onclick="togglePublish(${q.id}, ${!q.published})">${q.published ? 'Unpublish' : 'Publish'}</button>
          <button class="small danger" onclick="archiveQuiz(${q.id})">Archive</button>` : `
          <button class="small" onclick="showBoard(${q.id})">Top scores</button>
          <button class="small primary" onclick="startQuiz(${q.id})">Start</button>`}</div></div>`).join('') : '<p>No quizzes found.</p>'}</div>`;
  if (!staff()) {
    const mine = await api('/api/quizzes/attempts/mine');
    html += `<div class="block" style="margin-top:32px"><h2>My attempts</h2>${mine.length ? `<table><tr><th>Quiz</th><th>Score</th><th>Attempt</th><th>When</th></tr>${mine.map(a => `<tr><td>${esc(a.quiz_title)}</td><td>${a.score}/${a.total} (${a.percent}%)</td><td>${a.attempt_no}</td><td>${when(a.created_at)}</td></tr>`).join('')}</table>` : '<p>No attempts yet.</p>'}</div>`;
  }
  return html;
};

function setTopic(t) {
  state.topic = t;
  refresh();
}

function setCategory(c) {
  state.category = c;
  state.topic = '';
  refresh();
}

function loadCsv(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { document.getElementById('qz-csv').value = reader.result; };
  reader.readAsText(file);
}

function createQuiz() {
  act(async () => {
    await api('/api/quizzes', {
      method: 'POST',
      body: { title: val('qz-title'), topic: val('qz-topic'), category: val('qz-cat'), difficulty: val('qz-diff'), duration_minutes: val('qz-dur'), csv: document.getElementById('qz-csv').value }
    });
    toast('Quiz published');
    refresh();
  });
}

function togglePublish(id, published) {
  act(async () => {
    await api('/api/quizzes/' + id, { method: 'PATCH', body: { published } });
    refresh();
  });
}

function archiveQuiz(id) {
  if (!confirm('Archive this quiz? Students will no longer see it.')) return;
  act(async () => {
    await api('/api/quizzes/' + id, { method: 'DELETE' });
    refresh();
  });
}

function showAnalytics(id) {
  act(async () => {
    const a = await api(`/api/quizzes/${id}/analytics`);
    openModal(`<h2>${esc(a.title)}</h2>
      <p>${a.attempts} attempts by ${a.unique_students} students, average ${a.average_percent}%</p>
      <div style="margin-top:12px">${a.per_question.map((q, i) => `<div class="row" style="grid-template-columns:1fr 90px 44px"><span>${i + 1}. ${esc(q.question)}</span><div class="bar"><i style="width:${q.accuracy}%"></i></div><b>${q.accuracy}%</b></div>`).join('')}</div>`);
  });
}

function showBoard(id) {
  act(async () => {
    const rows = await api(`/api/quizzes/${id}/leaderboard`);
    openModal(`<h2>Top scores</h2>${rows.length ? `<table><tr><th>#</th><th>Student</th><th>Score</th></tr>${rows.map(r => `<tr><td>${r.rank}</td><td>${esc(r.student_name)}</td><td>${r.percent}%</td></tr>`).join('')}</table>` : '<p>No attempts yet.</p>'}`);
  });
}

function startQuiz(id) {
  act(async () => {
    const quiz = await api('/api/quizzes/' + id);
    const startedAt = Date.now();
    const limit = quiz.duration_minutes * 60;
    state.quizMeta = { id, startedAt };
    state.quiz = `
      <button class="ghost small" onclick="go('quizzes')">Back to quizzes</button>
      <h2 style="margin-top:12px">${esc(quiz.title)}</h2>
      ${limit ? '<div class="timer" id="timer"></div>' : ''}
      ${quiz.questions.map((q, i) => `<div class="q"><h3>${i + 1}. ${esc(q.question)}</h3>
        ${q.options.map((o, j) => `<label class="opt"><input type="radio" name="q${i}" value="${j}"> ${esc(o)}</label>`).join('')}</div>`).join('')}
      <button class="primary" onclick="submitQuiz(${quiz.questions.length})">Submit answers</button>`;
    document.getElementById('view').innerHTML = state.quiz;
    if (limit) {
      clearInterval(state.timer);
      const tick = () => {
        const left = limit - Math.floor((Date.now() - startedAt) / 1000);
        const el = document.getElementById('timer');
        if (!el) return clearInterval(state.timer);
        if (left <= 0) {
          clearInterval(state.timer);
          submitQuiz(quiz.questions.length);
          return;
        }
        el.textContent = `Time left ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      };
      tick();
      state.timer = setInterval(tick, 1000);
    }
  });
}

function submitQuiz(count) {
  clearInterval(state.timer);
  const answers = [];
  for (let i = 0; i < count; i++) {
    const picked = document.querySelector(`input[name="q${i}"]:checked`);
    answers.push(picked ? Number(picked.value) : null);
  }
  act(async () => {
    const { id, startedAt } = state.quizMeta;
    const out = await api(`/api/quizzes/${id}/attempt`, {
      method: 'POST',
      body: { answers, time_taken_sec: Math.round((Date.now() - startedAt) / 1000) }
    });
    const a = out.attempt;
    state.quiz = `
      <button class="ghost small" onclick="go('quizzes')">Back to quizzes</button>
      <h2 style="margin-top:12px">${esc(a.quiz_title)}: ${a.score}/${a.total} (${a.percent}%)</h2>
      ${out.results.map((r, i) => `<div class="q"><h3>${i + 1}. ${esc(r.question)}</h3>
        ${r.options.map((o, j) => `<div class="opt ${j === r.correct_index ? 'right' : j === r.chosen ? 'wrong' : ''}">${esc(o)}${j === r.chosen ? ' (your answer)' : ''}</div>`).join('')}
        ${r.chosen === null ? '<p>Skipped</p>' : ''}${r.explanation ? `<p style="margin-top:8px">${esc(r.explanation)}</p>` : ''}</div>`).join('')}`;
    document.getElementById('view').innerHTML = state.quiz;
    refreshBadge();
  });
}

views.materials = async () => {
  const params = new URLSearchParams();
  if (state.topic) params.set('topic', state.topic);
  if (state.search) params.set('q', state.search);
  const [all, rows] = await Promise.all([api('/api/materials'), api('/api/materials?' + params)]);
  const topics = [...new Set(all.map(m => m.topic))];
  let html = '';
  if (staff()) {
    html += `<div class="block"><h2>Upload material</h2><div class="form">
      <div class="two"><input id="m-title" placeholder="Title"><input id="m-topic" placeholder="Topic"></div>
      <input id="m-desc" placeholder="Short description">
      <div class="two"><label>File (PDF, slides, notes, up to 15 MB)<input type="file" id="m-file"></label><label>Or a link<input id="m-link" placeholder="https://"></label></div>
      <div><button class="primary" onclick="uploadMaterial()">Upload</button></div></div></div>`;
  }
  html += `<div class="chips"><button class="chip ${state.topic ? '' : 'on'}" onclick="setTopic('')">All topics</button>
    ${topics.map(t => `<button class="chip ${state.topic === t ? 'on' : ''}" onclick="setTopic('${esc(t).replaceAll("'", '')}')">${esc(t)}</button>`).join('')}</div>
    <div class="list">${rows.length ? rows.map(m => `
      <div class="item"><div><h3>${esc(m.title)} ${m.completed ? '<span class="tag good">done</span>' : ''}</h3>
        <div class="meta">${esc(m.topic)} · ${m.kind === 'FILE' ? esc(m.original_name) : 'link'} · by ${esc(m.uploaded_by_name)}</div>
        ${m.description ? `<div class="meta">${esc(m.description)}</div>` : ''}</div>
        <div class="actions"><button class="small" onclick="openMaterial(${m.id})">Open</button>
        ${staff() ? `<button class="small danger" onclick="removeMaterial(${m.id})">Remove</button>` : (m.completed ? '' : `<button class="small primary" onclick="completeMaterial(${m.id})">Mark done</button>`)}</div></div>`).join('') : '<p>No materials yet.</p>'}</div>`;
  return html;
};

function uploadMaterial() {
  act(async () => {
    const form = new FormData();
    form.append('title', val('m-title'));
    form.append('topic', val('m-topic'));
    form.append('description', val('m-desc'));
    form.append('link', val('m-link'));
    const file = document.getElementById('m-file').files[0];
    if (file) form.append('file', file);
    await api('/api/materials', { method: 'POST', body: form });
    toast('Material uploaded');
    refresh();
  });
}

function openMaterial(id) {
  act(async () => {
    const res = await api(`/api/materials/${id}/open`);
    if (res.json && (res.headers.get('content-type') || '').includes('json')) {
      const data = await res.json();
      window.open(data.link, '_blank', 'noopener');
      return;
    }
    const disposition = res.headers.get('content-disposition') || '';
    const match = /filename="?([^";]+)"?/.exec(disposition);
    const blob = await res.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = match ? decodeURIComponent(match[1]) : 'material';
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

function completeMaterial(id) {
  act(async () => {
    await api(`/api/materials/${id}/complete`, { method: 'POST' });
    refresh();
  });
}

function removeMaterial(id) {
  if (!confirm('Remove this material?')) return;
  act(async () => {
    await api('/api/materials/' + id, { method: 'DELETE' });
    refresh();
  });
}

const sizeText = n => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

const fileLine = r => r.original_name ? `${esc(r.original_name)} · ${sizeText(r.size)}` : 'text submission';

views.resume = async () => {
  if (staff()) {
    const rows = await api('/api/resume-submissions' + (state.resumeFilter ? '?status=' + state.resumeFilter : ''));
    return `
      <div class="chips">${['PENDING', 'APPROVED', 'REJECTED', ''].map(s => `<button class="chip ${state.resumeFilter === s ? 'on' : ''}" onclick="state.resumeFilter='${s}'; refresh()">${s ? s.toLowerCase() : 'all'}</button>`).join('')}</div>
      ${rows.length ? rows.map(r => `
        <div class="stack">
          <div style="display:flex; justify-content:space-between; gap:12px; flex-wrap:wrap">
            <div><h3>${esc(r.title)} <span class="tag ${r.status}">${r.status.toLowerCase()}</span> ${r.version ? `<span class="tag">v${r.version}</span>` : ''}</h3>
              <div class="meta muted">${esc(r.student_name)} · ${when(r.created_at)}${r.base_version ? ' · improves v' + r.base_version : ' · first version'}</div>
              <div class="meta muted">${fileLine(r)}</div>
              ${r.note ? `<p style="margin-top:6px">${esc(r.note)}</p>` : ''}</div>
            <div class="actions">${r.original_name ? `<button class="small" onclick="openResume(${r.id})">Open file</button>` : ''}
              ${r.base_id ? `<button class="small" onclick="showCompare(${r.id})">Compare with v${r.base_version}</button>` : ''}</div>
          </div>
          ${r.status === 'PENDING' ? `<div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap">
            <input id="fb-${r.id}" placeholder="Feedback for the student" style="flex:1; min-width:200px">
            <button class="primary small" onclick="review(${r.id}, 'APPROVED')">Approve</button>
            <button class="small danger" onclick="review(${r.id}, 'REJECTED')">Reject</button></div>` : (r.feedback ? `<p style="margin-top:10px">Feedback: ${esc(r.feedback)} (${esc(r.reviewer_name)})</p>` : '')}
        </div>`).join('') : '<p>Nothing here.</p>'}`;
  }
  const rows = await api('/api/resume-submissions');
  const titles = [...new Set(rows.map(r => r.title))];
  return `
    <div class="block"><h2>Upload a resume for approval</h2><div class="form">
      <label>Resume name<input id="r-title" list="r-titles" placeholder="e.g. Software Engineer Resume"></label>
      <datalist id="r-titles">${titles.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <label>Resume file (PDF, DOC or DOCX, up to 5 MB)<input id="r-file" type="file" accept=".pdf,.doc,.docx,application/pdf"></label>
      <label>What did you change?<input id="r-note" placeholder="Added two projects, rewrote summary"></label>
      <p class="muted">Upload under an existing resume name to submit an improved version. Faculty approve it and it becomes the next version.</p>
      <div><button class="primary" onclick="submitResume()">Send for faculty approval</button></div></div></div>
    <div class="block"><h2>My resume versions</h2><div class="list">${rows.length ? rows.map(r => `
      <div class="item"><div><h3>${esc(r.title)} <span class="tag ${r.status}">${r.status.toLowerCase()}</span> ${r.version ? `<span class="tag">v${r.version}</span>` : ''}</h3>
        <div class="meta">${fileLine(r)} · ${when(r.created_at)}${r.feedback ? ' · Feedback: ' + esc(r.feedback) : ''}</div></div>
        <div class="actions">${r.original_name ? `<button class="small" onclick="openResume(${r.id})">Open file</button>` : ''}
        ${r.base_id ? `<button class="small" onclick="showCompare(${r.id})">Compare</button>` : ''}
        ${r.status === 'PENDING' ? `<button class="small danger" onclick="withdraw(${r.id})">Withdraw</button>` : ''}</div></div>`).join('') : '<p>No resumes uploaded yet.</p>'}</div></div>`;
};

function submitResume() {
  act(async () => {
    const file = document.getElementById('r-file').files[0];
    if (!file) throw new Error('Choose a PDF, DOC or DOCX file');
    const form = new FormData();
    form.append('title', val('r-title'));
    form.append('note', val('r-note'));
    form.append('file', file);
    await api('/api/resume-submissions', { method: 'POST', body: form });
    toast('Sent to faculty for approval');
    refresh();
  });
}

function withdraw(id) {
  act(async () => {
    await api(`/api/resume-submissions/${id}/withdraw`, { method: 'POST' });
    refresh();
  });
}

function openResume(id) {
  act(async () => {
    const meta = await api(`/api/resume-submissions/${id}/compare`);
    const row = meta.submission;
    const res = await api(`/api/resume-submissions/${id}/file${row.mime === 'application/pdf' ? '?inline=1' : ''}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    if (row.mime === 'application/pdf') {
      openModal(`<h2>${esc(row.title)}${row.version ? ' v' + row.version : ''}</h2><iframe class="pdf" src="${url}" title="Resume preview"></iframe>`, true);
      return;
    }
    const link = document.createElement('a');
    link.href = url;
    link.download = row.original_name;
    link.click();
    toast('Word files download for viewing');
  });
}

function showCompare(id) {
  act(async () => {
    const { submission: s, base } = await api(`/api/resume-submissions/${id}/compare`);
    const card = (label, r) => `<div class="stack"><h3>${label}</h3>
      <div class="meta muted">${esc(r.title)}${r.version ? ' · v' + r.version : ''} · ${when(r.created_at)}</div>
      <div class="meta muted">${fileLine(r)}</div>
      ${r.note ? `<p style="margin-top:6px">${esc(r.note)}</p>` : ''}
      ${r.original_name ? `<button class="small" style="margin-top:10px" onclick="openResume(${r.id})">Open file</button>` : ''}</div>`;
    openModal(`<h2>Compare versions</h2>${base ? card('Previous approved version', base) : ''}${card('This submission', s)}`);
  });
}

function review(id, decision) {
  act(async () => {
    const fb = document.getElementById('fb-' + id);
    await api(`/api/resume-submissions/${id}/review`, { method: 'POST', body: { decision, feedback: fb ? fb.value : '' } });
    toast(decision === 'APPROVED' ? 'Approved and versioned' : 'Rejected');
    refresh();
  });
}

views.activity = async () => {
  const rows = await api('/api/activities?limit=200');
  return activityTable(rows, staff());
};

views.leaderboard = async () => {
  const rows = await api('/api/leaderboard');
  if (!rows.length) return '<p>No quiz attempts yet.</p>';
  return `<table><tr><th>#</th><th>Student</th><th>Average</th><th>Attempts</th></tr>${rows.map(r => `<tr><td>${r.rank}</td><td>${esc(r.student_name)}</td><td>${r.average}%</td><td>${r.attempts}</td></tr>`).join('')}</table>`;
};

document.getElementById('modal').addEventListener('click', e => {
  if (e.target.id === 'modal') closeModal();
});

if (state.token && state.user) renderShell();
else renderAuth();
