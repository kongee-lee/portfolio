// ===== Supabase 연결 정보 (공개 키만 쓴다) =====
const SUPABASE_URL = 'https://pxzqoiyolpztslbbxnpz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_D5L0A7KPIukhUNzWIoEWIA_BcCPeoV-';

// Supabase 표에 요청을 보내는 도우미
async function api(path, options = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const error = new Error('요청 실패 (' + res.status + ')');
    error.status = res.status;
    throw error;
  }
  return res;
}

async function apiJson(path, options) {
  const res = await api(path, options);
  return res.json();
}

// 줄 수만 세기 (예: 카드별 좋아요 수)
async function apiCount(path) {
  const res = await api(path, { method: 'HEAD', headers: { Prefer: 'count=exact' } });
  const range = res.headers.get('content-range') || ''; // 예: "0-4/5" 또는 "*/0"
  return Number(range.split('/')[1]) || 0;
}

const $ = (id) => document.getElementById(id);

// ===== 브라우저에 저장해 두는 값 =====
function storageGet(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* 저장 못 해도 화면은 동작 */ }
}

function getClientId() {
  let id = storageGet('resume_client_id');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) ||
      Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    storageSet('resume_client_id', id);
  }
  return id;
}

function getLikedIds() {
  try { return new Set(JSON.parse(storageGet('resume_liked') || '[]')); } catch (e) { return new Set(); }
}
function saveLikedIds(set) {
  storageSet('resume_liked', JSON.stringify([...set]));
}

const clientId = getClientId();
const likedIds = getLikedIds();

// ===== 프로필 =====
function setText(id, text) {
  $(id).textContent = text || '';
}

// 한 줄 소개에서 이름 부분만 파란 밑줄로 감싼다
function renderHeadline(headline, name) {
  const box = $('headline');
  box.textContent = '';
  if (!name || !headline.includes(name)) {
    box.textContent = headline;
    return;
  }
  headline.split(name).forEach((part, i) => {
    if (i > 0) {
      const hl = document.createElement('span');
      hl.className = 'hl';
      hl.textContent = name;
      box.append(hl);
    }
    box.append(part);
  });
}

async function loadProfile() {
  try {
    const rows = await apiJson('profile?select=*&id=eq.1');
    const p = rows[0];
    if (!p) {
      setText('name', '프로필이 아직 없습니다');
      return;
    }

    if (p.name) document.title = p.name + ' · 포트폴리오';
    setText('name', p.name);
    setText('title', p.title);
    $('career-badge').textContent = p.career_badge || '';
    $('career-badge').hidden = !p.career_badge;

    setText('c-name', p.name);
    setText('c-email', p.email);
    if (p.email) $('c-email').href = 'mailto:' + p.email;
    setText('c-phone', p.phone);
    if (p.phone) $('c-phone').href = 'tel:' + p.phone.replace(/[^0-9+]/g, '');
    setText('c-location', p.location);

    renderHeadline(p.headline || '', p.name || '');
    setText('intro', p.intro);
    setText('education', p.education);
    setText('skills', p.skills);
    setText('experience', p.experience);

    $('quote').textContent = p.quote ? '“' + p.quote + '”' : '';
    $('quote').hidden = !p.quote;

    if (p.photo_url) {
      const img = document.createElement('img');
      img.src = p.photo_url;
      img.alt = (p.name || '') + ' 프로필 사진';
      const empty = $('photo').querySelector('.photo-empty');
      img.onerror = () => { img.remove(); empty.hidden = false; }; // 사진을 못 불러오면 회색 자리로 둔다
      empty.hidden = true;
      $('photo').append(img);
    }
  } catch (e) {
    setText('name', '프로필을 불러오지 못했습니다');
  }
}

// ===== 포트폴리오 카드 =====
function makeCard(project, likeCount) {
  const card = document.createElement('article');
  card.className = 'card';

  // 카드 본문: 누르면 첨부 파일(없으면 썸네일)을 새 탭으로 연다
  const link = project.file_url || project.thumbnail_url;
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'card-open';
  if (link) {
    open.title = '새 탭에서 열기';
    open.addEventListener('click', () => window.open(link, '_blank', 'noopener'));
  } else {
    open.disabled = true;
  }

  const browser = document.createElement('div');
  browser.className = 'browser';
  browser.innerHTML = '<div class="browser-bar"><i></i><i></i><i></i></div><div class="browser-view"></div>';
  const view = browser.querySelector('.browser-view');
  if (project.thumbnail_url) {
    const img = document.createElement('img');
    img.src = project.thumbnail_url;
    img.alt = '';
    img.loading = 'lazy';
    view.append(img);
  } else {
    const none = document.createElement('span');
    none.textContent = '이미지 준비 중';
    view.append(none);
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.textContent = [project.number, project.category].filter(Boolean).join(' · ');

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = project.title;

  const desc = document.createElement('p');
  desc.className = 'card-desc';
  desc.textContent = project.description;

  const tags = document.createElement('ul');
  tags.className = 'tags';
  (project.tags || []).forEach((tag) => {
    const li = document.createElement('li');
    li.textContent = tag;
    tags.append(li);
  });

  body.append(meta, title, desc, tags);
  open.append(browser, body);

  // 좋아요 버튼
  const foot = document.createElement('div');
  foot.className = 'card-foot';
  const like = document.createElement('button');
  like.type = 'button';
  like.className = 'like';
  like.innerHTML = '<svg aria-hidden="true"><use href="#i-heart"/></svg><span class="like-count"></span>';
  const countEl = like.querySelector('.like-count');
  let count = likeCount;
  const paint = () => {
    const liked = likedIds.has(project.id);
    countEl.textContent = count;
    like.setAttribute('aria-pressed', liked ? 'true' : 'false');
    like.setAttribute('aria-label', '좋아요 ' + count + '개' + (liked ? ' (눌렀음)' : ''));
  };
  paint();

  like.addEventListener('click', async () => {
    if (likedIds.has(project.id) || like.disabled) return;
    like.disabled = true;
    try {
      await api('likes', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ project_id: project.id, client_id: clientId }),
      });
      count += 1;
      likedIds.add(project.id);
    } catch (e) {
      // 409 = 이 브라우저가 이미 누른 카드 (숫자에는 이미 들어가 있다)
      if (e.status === 409) likedIds.add(project.id);
      else alert('좋아요를 남기지 못했습니다. 잠시 뒤 다시 눌러 주세요.');
    }
    saveLikedIds(likedIds);
    like.disabled = false;
    paint();
  });

  foot.append(like);
  card.append(open, foot);
  return card;
}

async function loadProjects() {
  const box = $('cards');
  try {
    const projects = await apiJson('projects?select=*&order=sort_order.asc,id.asc');

    // 이 브라우저가 전에 누른 좋아요를 서버에서도 확인해 둔다
    try {
      const mine = await apiJson('likes?select=project_id&client_id=eq.' + encodeURIComponent(clientId));
      mine.forEach((row) => likedIds.add(row.project_id));
      saveLikedIds(likedIds);
    } catch (e) { /* 못 불러와도 카드는 보여 준다 */ }

    const counts = await Promise.all(
      projects.map((p) => apiCount('likes?select=id&project_id=eq.' + p.id).catch(() => 0))
    );

    box.textContent = '';
    if (projects.length === 0) {
      box.innerHTML = '<p class="empty">아직 등록된 프로젝트가 없습니다.</p>';
      return;
    }
    projects.forEach((p, i) => box.append(makeCard(p, counts[i])));
  } catch (e) {
    box.innerHTML = '<p class="empty">프로젝트를 불러오지 못했습니다.</p>';
  }
}

// ===== 방명록 =====
function formatDate(value) {
  return new Date(value).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function makeGuestItem(row) {
  const li = document.createElement('li');
  li.className = 'gb-item';
  const head = document.createElement('div');
  head.className = 'gb-head';
  const nick = document.createElement('span');
  nick.className = 'gb-nick';
  nick.textContent = row.nickname;
  const date = document.createElement('time');
  date.className = 'gb-date';
  date.dateTime = row.created_at;
  date.textContent = formatDate(row.created_at);
  head.append(nick, date);
  const msg = document.createElement('p');
  msg.className = 'gb-msg';
  msg.textContent = row.message;
  li.append(head, msg);
  return li;
}

async function loadGuestbook() {
  const list = $('gb-list');
  try {
    const rows = await apiJson('resume_guestbook?select=*&order=created_at.desc&limit=100');
    list.textContent = '';
    if (rows.length === 0) {
      list.innerHTML = '<li class="empty">첫 번째 한마디를 남겨 주세요.</li>';
      return;
    }
    rows.forEach((row) => list.append(makeGuestItem(row)));
  } catch (e) {
    list.innerHTML = '<li class="empty">방명록을 불러오지 못했습니다.</li>';
  }
}

function setStatus(text, isError) {
  $('gb-status').textContent = text;
  $('gb-status').classList.toggle('error', !!isError);
}

async function submitGuestbook() {
  const nickname = $('gb-nickname').value.trim();
  const message = $('gb-message').value.trim();
  if (!nickname || nickname.length > 20) return setStatus('별명을 1~20자로 적어 주세요.', true);
  if (!message || message.length > 200) return setStatus('한마디를 1~200자로 적어 주세요.', true);

  const button = $('gb-submit');
  button.disabled = true;
  setStatus('남기는 중…');
  try {
    const rows = await apiJson('resume_guestbook', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ nickname, message }),
    });
    const list = $('gb-list');
    const empty = list.querySelector('.empty');
    if (empty) empty.remove();
    list.prepend(makeGuestItem(rows[0]));
    $('gb-message').value = '';
    setStatus('남겼습니다. 고맙습니다!');
  } catch (e) {
    setStatus('남기지 못했습니다. 잠시 뒤 다시 해 주세요.', true);
  }
  button.disabled = false;
}

$('gb-submit').addEventListener('click', submitGuestbook);

// ===== 시작 =====
loadProfile();
loadProjects();
loadGuestbook();
