// ===== Supabase 연결 정보 (공개 키만 쓴다) =====
const SUPABASE_URL = 'https://pxzqoiyolpztslbbxnpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_D5L0A7KPIukhUNzWIoEWIA_BcCPeoV-';
const BUCKET = 'resume';
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const FILE_TYPES = { ...IMAGE_TYPES, 'application/pdf': 'pdf' };
const SESSION_KEY = 'resume_admin_session';

const $ = (id) => document.getElementById(id);

function showMsg(id, text, kind) {
  const el = $(id);
  el.textContent = text || '';
  el.className = 'msg' + (kind ? ' ' + kind : '');
}

// ===== 로그인 정보 (브라우저에 저장) =====
let session = null; // { access_token, refresh_token, expires_at, user }

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
function saveSession(data) {
  session = data
    ? { ...data, expires_at: data.expires_at || Math.floor(Date.now() / 1000) + (data.expires_in || 3600) }
    : null;
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (e) { /* 저장 못 해도 이번 화면에서는 동작 */ }
}

async function authRequest(path, body) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/' + path, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.error_description || data.msg || data.message || '로그인 실패');
    error.status = res.status;
    throw error;
  }
  return data;
}

// 토큰이 곧 끝나면 새 토큰으로 바꾼다
async function freshToken() {
  if (!session) throw new Error('로그인이 필요합니다');
  if (session.expires_at - 60 < Date.now() / 1000) {
    try {
      saveSession(await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token }));
    } catch (e) {
      saveSession(null);
      showView('login');
      throw new Error('로그인이 끝났습니다. 다시 로그인해 주세요.');
    }
  }
  return session.access_token;
}

// 로그인한 토큰으로 Supabase에 요청한다
async function request(url, options = {}) {
  const token = await freshToken();
  const res = await fetch(url, {
    ...options,
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token, ...options.headers },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || data.error || '요청 실패 (' + res.status + ')');
  }
  return res;
}

function db(path, options = {}) {
  return request(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}
async function dbJson(path, options) {
  return (await db(path, options)).json();
}

// 고치거나 지운 줄을 돌려받아, 0줄이면 권한이 없던 것으로 본다
async function dbChange(path, method, body, prefer) {
  const rows = await dbJson(path, {
    method,
    headers: { Prefer: 'return=representation' + (prefer ? ',' + prefer : '') },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!rows.length) throw new Error('바뀐 것이 없습니다. 관리자 권한을 확인해 주세요.');
  return rows;
}

async function countLikes(projectId) {
  const res = await db('likes?select=id&project_id=eq.' + projectId, {
    method: 'HEAD',
    headers: { Prefer: 'count=exact' },
  });
  return Number((res.headers.get('content-range') || '').split('/')[1]) || 0;
}

// ===== 파일 올리기 =====
// 문제가 있으면 안내 문구를, 괜찮으면 null을 돌려준다
function checkFile(file, types) {
  if (!file) return null;
  if (!types[file.type]) {
    return types === IMAGE_TYPES
      ? '이미지 파일(PNG·JPG·WEBP·GIF)만 올릴 수 있어요.'
      : '이미지 또는 PDF 파일만 올릴 수 있어요.';
  }
  if (file.size > MAX_SIZE) return '10MB보다 큰 파일은 올릴 수 없어요. (지금 ' + (file.size / 1024 / 1024).toFixed(1) + 'MB)';
  return null;
}

// 파일 이름은 영어·숫자로 새로 짓는다. 예: projects/20261027-0315-k3j9x2.pdf
function newFileName(folder, file) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  const random = Math.random().toString(36).slice(2, 8);
  return folder + '/' + stamp + '-' + random + '.' + FILE_TYPES[file.type];
}

async function uploadFile(folder, file) {
  const path = newFileName(folder, file);
  await request(SUPABASE_URL + '/storage/v1/object/' + BUCKET + '/' + path, {
    method: 'POST',
    headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
    body: file,
  });
  return SUPABASE_URL + '/storage/v1/object/public/' + BUCKET + '/' + path;
}

function setPreview(box, url) {
  box.textContent = '';
  if (!url) {
    box.textContent = '없음';
    return;
  }
  const img = document.createElement('img');
  img.src = url;
  img.alt = '';
  box.append(img);
}

function previewChosen(input, box, fallbackUrl) {
  const file = input.files[0];
  if (file && IMAGE_TYPES[file.type]) setPreview(box, URL.createObjectURL(file));
  else setPreview(box, fallbackUrl);
}

// ===== 화면 전환 =====
function showView(name) {
  $('login-view').hidden = name !== 'login';
  $('denied-view').hidden = name !== 'denied';
  $('admin-view').hidden = name !== 'admin';
}

async function enter() {
  try {
    await freshToken();
    const rows = await dbJson('admins?select=user_id&user_id=eq.' + session.user.id);
    if (!rows.length) {
      $('denied-email').textContent = session.user.email + ' 계정은 관리자로 등록되어 있지 않아요.';
      showView('denied');
      return;
    }
    $('me').textContent = session.user.email;
    showView('admin');
    loadProfile();
    loadProjects();
    loadGuestbook();
  } catch (e) {
    showView('login');
    showMsg('login-msg', e.message, 'error');
  }
}

async function login() {
  const email = $('login-email').value.trim();
  const password = $('login-password').value;
  if (!email || !password) return showMsg('login-msg', '이메일과 비밀번호를 적어 주세요.', 'error');
  $('login-btn').disabled = true;
  showMsg('login-msg', '로그인 중…');
  try {
    saveSession(await authRequest('token?grant_type=password', { email, password }));
    $('login-password').value = '';
    showMsg('login-msg', '');
    await enter();
  } catch (e) {
    showMsg('login-msg', e.status === 400 ? '이메일 또는 비밀번호가 맞지 않아요.' : e.message, 'error');
  }
  $('login-btn').disabled = false;
}

async function logout() {
  if (session) {
    fetch(SUPABASE_URL + '/auth/v1/logout', {
      method: 'POST',
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + session.access_token },
    }).catch(() => {});
  }
  saveSession(null);
  showView('login');
}

$('login-btn').addEventListener('click', login);
$('login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
document.querySelectorAll('[data-logout]').forEach((b) => b.addEventListener('click', logout));

// ===== 프로필 =====
let profilePhotoUrl = null;

async function loadProfile() {
  try {
    const rows = await dbJson('profile?select=*&id=eq.1');
    const p = rows[0] || {};
    document.querySelectorAll('[data-p]').forEach((el) => { el.value = p[el.dataset.p] || ''; });
    profilePhotoUrl = p.photo_url || null;
    setPreview($('photo-preview'), profilePhotoUrl);
  } catch (e) {
    showMsg('profile-msg', '프로필을 불러오지 못했습니다: ' + e.message, 'error');
  }
}

$('photo-file').addEventListener('change', () => {
  const problem = checkFile($('photo-file').files[0], IMAGE_TYPES);
  if (problem) {
    $('photo-file').value = '';
    showMsg('profile-msg', problem, 'error');
  } else {
    showMsg('profile-msg', '');
  }
  previewChosen($('photo-file'), $('photo-preview'), profilePhotoUrl);
});

$('profile-save').addEventListener('click', async () => {
  const saveButton = $('profile-save');
  saveButton.disabled = true;
  showMsg('profile-msg', '저장 중…');
  try {
    const data = { id: 1, updated_at: new Date().toISOString() };
    document.querySelectorAll('[data-p]').forEach((el) => { data[el.dataset.p] = el.value.trim(); });

    const file = $('photo-file').files[0];
    if (file) data.photo_url = await uploadFile('profile', file);

    // 프로필 줄이 있으면 고치고, 없으면 새로 만든다
    await dbChange('profile?on_conflict=id', 'POST', data, 'resolution=merge-duplicates');
    profilePhotoUrl = data.photo_url || profilePhotoUrl;
    $('photo-file').value = '';
    setPreview($('photo-preview'), profilePhotoUrl);
    showMsg('profile-msg', '저장했습니다. 방문자 화면을 새로고침하면 보입니다.', 'ok');
  } catch (e) {
    showMsg('profile-msg', '저장하지 못했습니다: ' + e.message, 'error');
  }
  saveButton.disabled = false;
});

// ===== 포트폴리오 카드 + 좋아요 =====
let projects = [];
let likeCounts = {};

async function loadProjects() {
  try {
    projects = await dbJson('projects?select=*&order=sort_order.asc,id.asc');
    const counts = await Promise.all(projects.map((p) => countLikes(p.id).catch(() => 0)));
    likeCounts = {};
    projects.forEach((p, i) => { likeCounts[p.id] = counts[i]; });
    renderProjects();
    renderLikes();
  } catch (e) {
    showMsg('project-msg', '카드를 불러오지 못했습니다: ' + e.message, 'error');
  }
}

function button(text, onClick, extraClass) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-line' + (extraClass ? ' ' + extraClass : '');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function likesPill(count) {
  const pill = document.createElement('span');
  pill.className = 'likes-pill';
  pill.textContent = '♥ ' + count;
  return pill;
}

function renderProjects() {
  const list = $('project-list');
  list.textContent = '';
  if (!projects.length) {
    list.innerHTML = '<li class="empty">카드가 없습니다. 아래에서 추가해 주세요.</li>';
    return;
  }
  projects.forEach((p, i) => {
    const li = document.createElement('li');
    li.className = 'item';

    const thumb = document.createElement('div');
    thumb.className = 'preview';
    setPreview(thumb, p.thumbnail_url);

    const main = document.createElement('div');
    main.className = 'item-main';
    const meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.textContent = [p.number, p.category].filter(Boolean).join(' · ');
    const title = document.createElement('strong');
    title.textContent = p.title;
    const extra = document.createElement('p');
    extra.textContent = (p.tags || []).join(', ') + (p.file_url ? '  · 첨부 있음' : '');
    main.append(meta, title, extra);

    const actions = document.createElement('div');
    actions.className = 'row-actions';
    const up = button('▲', () => moveProject(i, -1));
    up.title = '위로';
    up.disabled = i === 0;
    const down = button('▼', () => moveProject(i, 1));
    down.title = '아래로';
    down.disabled = i === projects.length - 1;
    actions.append(up, down, button('수정', () => openEditor(p)), button('삭제', () => deleteProject(p), 'danger'));

    li.append(thumb, main, likesPill(likeCounts[p.id] || 0), actions);
    list.append(li);
  });
}

function renderLikes() {
  const list = $('like-list');
  list.textContent = '';
  if (!projects.length) {
    list.innerHTML = '<li class="empty">카드가 없습니다.</li>';
    return;
  }
  projects.forEach((p) => {
    const li = document.createElement('li');
    li.className = 'item';
    const main = document.createElement('div');
    main.className = 'item-main';
    const title = document.createElement('strong');
    title.textContent = [p.number, p.title].filter(Boolean).join('. ');
    main.append(title);
    const reset = button('좋아요 초기화', () => resetLikes(p), 'danger');
    reset.disabled = !likeCounts[p.id];
    li.append(main, likesPill(likeCounts[p.id] || 0), reset);
    list.append(li);
  });
}

// 순서 바꾸기: 바뀐 순서대로 sort_order를 1, 2, 3… 으로 다시 매긴다
async function moveProject(index, step) {
  const target = index + step;
  if (target < 0 || target >= projects.length) return;
  const order = projects.slice();
  [order[index], order[target]] = [order[target], order[index]];
  showMsg('project-msg', '순서 바꾸는 중…');
  try {
    for (let i = 0; i < order.length; i++) {
      if (order[i].sort_order !== i + 1) {
        await dbChange('projects?id=eq.' + order[i].id, 'PATCH', { sort_order: i + 1 });
      }
    }
    showMsg('project-msg', '');
  } catch (e) {
    showMsg('project-msg', '순서를 바꾸지 못했습니다: ' + e.message, 'error');
  }
  loadProjects();
}

async function deleteProject(p) {
  if (!confirm('"' + p.title + '" 카드를 지울까요? 이 카드의 좋아요도 함께 지워집니다.')) return;
  try {
    await dbChange('projects?id=eq.' + p.id, 'DELETE');
    if (editing && editing.id === p.id) closeEditor();
    showMsg('project-msg', '지웠습니다.', 'ok');
  } catch (e) {
    showMsg('project-msg', '지우지 못했습니다: ' + e.message, 'error');
  }
  loadProjects();
}

async function resetLikes(p) {
  if (!confirm('"' + p.title + '" 카드의 좋아요 ' + (likeCounts[p.id] || 0) + '개를 모두 지울까요?')) return;
  try {
    await dbChange('likes?project_id=eq.' + p.id, 'DELETE');
    showMsg('like-msg', '초기화했습니다.', 'ok');
  } catch (e) {
    showMsg('like-msg', '초기화하지 못했습니다: ' + e.message, 'error');
  }
  loadProjects();
}

// ----- 카드 추가·수정 창 -----
let editing = null; // 고치는 중인 카드 (새 카드면 빈 객체)
let editThumbUrl = null;
let editFileUrl = null;

function setFileLink(url) {
  const a = $('e-file-link');
  if (url) {
    a.href = url;
    a.textContent = '지금 첨부 보기';
  } else {
    a.removeAttribute('href');
    a.textContent = '없음';
  }
}

function openEditor(p) {
  editing = p || {};
  $('editor-title').textContent = p ? '카드 수정' : '카드 추가';
  $('e-number').value = editing.number || '';
  $('e-category').value = editing.category || '';
  $('e-title').value = editing.title || '';
  $('e-description').value = editing.description || '';
  $('e-tags').value = (editing.tags || []).join(', ');
  $('e-thumb-file').value = '';
  $('e-file-file').value = '';
  editThumbUrl = editing.thumbnail_url || null;
  editFileUrl = editing.file_url || null;
  setPreview($('e-thumb-preview'), editThumbUrl);
  setFileLink(editFileUrl);
  showMsg('editor-msg', '');
  $('editor').hidden = false;
  $('e-title').focus();
}

function closeEditor() {
  editing = null;
  $('editor').hidden = true;
}

$('project-add').addEventListener('click', () => openEditor(null));
$('e-cancel').addEventListener('click', closeEditor);

$('e-thumb-file').addEventListener('change', () => {
  const problem = checkFile($('e-thumb-file').files[0], IMAGE_TYPES);
  if (problem) $('e-thumb-file').value = '';
  showMsg('editor-msg', problem || '', problem ? 'error' : '');
  previewChosen($('e-thumb-file'), $('e-thumb-preview'), editThumbUrl);
});
$('e-file-file').addEventListener('change', () => {
  const problem = checkFile($('e-file-file').files[0], FILE_TYPES);
  if (problem) $('e-file-file').value = '';
  showMsg('editor-msg', problem || '', problem ? 'error' : '');
});
$('e-thumb-clear').addEventListener('click', () => {
  editThumbUrl = null;
  $('e-thumb-file').value = '';
  setPreview($('e-thumb-preview'), null);
});
$('e-file-clear').addEventListener('click', () => {
  editFileUrl = null;
  $('e-file-file').value = '';
  setFileLink(null);
});

$('e-save').addEventListener('click', async () => {
  const title = $('e-title').value.trim();
  if (!title) return showMsg('editor-msg', '제목을 적어 주세요.', 'error');

  const saveButton = $('e-save');
  saveButton.disabled = true;
  showMsg('editor-msg', '저장 중…');
  try {
    const thumbFile = $('e-thumb-file').files[0];
    const attachFile = $('e-file-file').files[0];
    if (thumbFile) editThumbUrl = await uploadFile('projects', thumbFile);
    if (attachFile) editFileUrl = await uploadFile('projects', attachFile);

    const data = {
      number: $('e-number').value.trim(),
      category: $('e-category').value.trim(),
      title,
      description: $('e-description').value.trim(),
      tags: $('e-tags').value.split(',').map((t) => t.trim()).filter(Boolean),
      thumbnail_url: editThumbUrl,
      file_url: editFileUrl,
    };

    if (editing.id) {
      await dbChange('projects?id=eq.' + editing.id, 'PATCH', data);
    } else {
      data.sort_order = projects.reduce((max, p) => Math.max(max, p.sort_order), 0) + 1;
      await dbChange('projects', 'POST', data);
    }
    closeEditor();
    showMsg('project-msg', '저장했습니다. 방문자 화면을 새로고침하면 보입니다.', 'ok');
    loadProjects();
  } catch (e) {
    showMsg('editor-msg', '저장하지 못했습니다: ' + e.message, 'error');
  }
  saveButton.disabled = false;
});

// ===== 방명록 =====
async function loadGuestbook() {
  const list = $('guest-list');
  try {
    const rows = await dbJson('resume_guestbook?select=*&order=created_at.desc');
    list.textContent = '';
    if (!rows.length) {
      list.innerHTML = '<li class="empty">방명록 글이 없습니다.</li>';
      return;
    }
    rows.forEach((row) => {
      const li = document.createElement('li');
      li.className = 'item';
      const main = document.createElement('div');
      main.className = 'item-main';
      const nick = document.createElement('strong');
      nick.textContent = row.nickname;
      const date = document.createElement('small');
      date.className = 'gb-date';
      date.textContent = new Date(row.created_at).toLocaleString('ko-KR');
      const msg = document.createElement('p');
      msg.textContent = row.message;
      main.append(nick, date, msg);
      li.append(main, button('삭제', () => deleteGuest(row), 'danger'));
      list.append(li);
    });
  } catch (e) {
    showMsg('guest-msg', '방명록을 불러오지 못했습니다: ' + e.message, 'error');
  }
}

async function deleteGuest(row) {
  if (!confirm('"' + row.nickname + '"님의 글을 지울까요?')) return;
  try {
    await dbChange('resume_guestbook?id=eq.' + row.id, 'DELETE');
    showMsg('guest-msg', '지웠습니다.', 'ok');
  } catch (e) {
    showMsg('guest-msg', '지우지 못했습니다: ' + e.message, 'error');
  }
  loadGuestbook();
}

// ===== 시작 =====
session = loadSession();
if (session) enter();
else showView('login');
