// ============================================
// STUDY HUB · Main App Logic
// ============================================

const GRADES = {
  '1ere': { name: '1ère année', emoji: '📘', sub: 'السنة الأولى ثانوي' },
  '2eme': { name: '2ème année', emoji: '📗', sub: 'السنة الثانية ثانوي' },
  '3eme': { name: '3ème année', emoji: '📙', sub: 'السنة الثالثة ثانوي' },
  'bac':  { name: 'Baccalauréat', emoji: '🎓', sub: 'الباكالوريا' }
};

const BRANCHES = {
  '1ere': [],
  '2eme': [
    { key: 'lettres', name: 'آداب (Lettres)', emoji: '📚' },
    { key: 'sciences', name: 'علوم (Sciences)', emoji: '🔬' },
    { key: 'eco', name: 'اقتصاد وخدمات (Éco & Services)', emoji: '💼' },
    { key: 'info_tech', name: 'تكنولوجيا المعلومات', emoji: '💻' }
  ],
  '3eme': [
    { key: 'lettres', name: 'آداب (Lettres)', emoji: '📚' },
    { key: 'math', name: 'رياضيات (Maths)', emoji: '📐' },
    { key: 'sci_exp', name: 'علوم تجريبية', emoji: '🧪' },
    { key: 'sci_tech', name: 'علوم تقنية', emoji: '⚙️' },
    { key: 'sci_info', name: 'علوم إعلامية', emoji: '💻' },
    { key: 'eco_gestion', name: 'اقتصاد وتصرف', emoji: '💰' },
    { key: 'sport', name: 'رياضة (Sport)', emoji: '⚽' }
  ],
  'bac': [
    { key: 'lettres', name: 'آداب (Lettres)', emoji: '📚' },
    { key: 'math', name: 'رياضيات (Maths)', emoji: '📐' },
    { key: 'sci_exp', name: 'علوم تجريبية', emoji: '🧪' },
    { key: 'sci_tech', name: 'علوم تقنية', emoji: '⚙️' },
    { key: 'sci_info', name: 'علوم إعلامية', emoji: '💻' },
    { key: 'eco_gestion', name: 'اقتصاد وتصرف', emoji: '💰' },
    { key: 'sport', name: 'رياضة (Sport)', emoji: '⚽' }
  ]
};

const SUBJECTS = {
  'arabic':    { name: 'عربية', emoji: '📖' },
  'french':    { name: 'فرنسية', emoji: '🇫🇷' },
  'english':   { name: 'إنجليزية', emoji: '🇬🇧' },
  'islamic':   { name: 'تفكير إسلامي', emoji: '🕌' },
  'civic':     { name: 'تربية مدنية', emoji: '⚖️' },
  'history':   { name: 'تاريخ وجغرافيا', emoji: '🌍' },
  'philo':     { name: 'فلسفة', emoji: '🤔' },
  'sport':     { name: 'تربية بدنية', emoji: '⚽' },
  'info_basic':{ name: 'إعلامية', emoji: '🖥️' },
  'math':      { name: 'رياضيات', emoji: '📐' },
  'physics':   { name: 'علوم فيزيائية', emoji: '⚛️' },
  'svt':       { name: 'علوم الحياة والأرض', emoji: '🌱' },
  'tech':      { name: 'تكنولوجيا', emoji: '🔧' },
  'info_prog': { name: 'إعلامية وبرمجة', emoji: '💻' },
  'economy':   { name: 'اقتصاد', emoji: '💹' },
  'gestion':   { name: 'تصرف ومحاسبة', emoji: '📊' }
};

const BRANCH_SUBJECTS = {
  'lettres':      ['arabic', 'french', 'english', 'history', 'islamic', 'civic', 'math', 'svt', 'info_basic', 'sport'],
  'sciences':     ['math', 'physics', 'svt', 'tech', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'philo', 'info_basic', 'sport'],
  'eco':          ['economy', 'gestion', 'math', 'arabic', 'french', 'english', 'history', 'islamic', 'civic', 'info_basic', 'sport'],
  'info_tech':    ['info_prog', 'math', 'physics', 'tech', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'info_basic', 'sport'],
  'math':         ['math', 'physics', 'svt', 'philo', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'info_basic', 'sport'],
  'sci_exp':      ['physics', 'svt', 'math', 'philo', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'info_basic', 'sport'],
  'sci_tech':     ['tech', 'math', 'physics', 'philo', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'info_basic', 'sport'],
  'sci_info':     ['info_prog', 'math', 'physics', 'tech', 'philo', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'sport'],
  'eco_gestion':  ['economy', 'gestion', 'math', 'philo', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'info_basic', 'sport']
};

function getSubjects(grade, branch) {
  if (grade === '1ere' || !branch) {
    return ['arabic', 'french', 'english', 'math', 'physics', 'svt', 'tech', 'islamic', 'civic', 'history', 'info_basic', 'sport'];
  }
  if (branch === 'sport') {
    return ['sport', 'svt', 'arabic', 'french', 'english', 'islamic', 'civic', 'history', 'math', 'physics', 'philo', 'info_basic'];
  }
  return BRANCH_SUBJECTS[branch] || [];
}

let currentUser = null;
let currentGrade = null;
let currentBranch = null;
let currentSubject = null;
let currentSearch = '';
let selectedFile = null;
let uploadStatus = null;
let deferredPrompt = null;

const $ = (id) => document.getElementById(id);

// ============================================
// CSRF Token Management
// ============================================
let csrfToken = null;

async function fetchFreshToken() {
  try {
    const r = await fetch('/api/csrf-token', { 
      credentials: 'include',
      cache: 'no-store'
    }).then(r => r.json());
    if (r.ok && r.token) {
      csrfToken = r.token;
      return r.token;
    }
  } catch (e) {}
  return null;
}

async function getCSRFToken() {
  if (csrfToken) return csrfToken;
  return await fetchFreshToken();
}

async function safeFetch(url, options = {}) {
  options.credentials = 'include';
  options.cache = 'no-store';
  
  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const token = await fetchFreshToken();
    if (token) {
      options.headers = {
        ...(options.headers || {}),
        'X-CSRF-Token': token
      };
      
      if (options.body && typeof options.body === 'string') {
        try {
          const data = JSON.parse(options.body);
          data._csrf = token;
          options.body = JSON.stringify(data);
        } catch (e) {}
      }
    }
  }
  return fetch(url, options);
}

// ============================================
// التهيئة
// ============================================
async function init() {
  const me = await fetch('/api/me').then(r => r.json());
  if (!me.ok) return location.replace('/');
  currentUser = me;
  const initial = (me.fullName || me.username)[0].toUpperCase();
  $('userAvatar').textContent = initial;
  $('userName').textContent = me.fullName || me.username;
  goHome();
}

function goHome() {
  currentGrade = null;
  currentBranch = null;
  currentSubject = null;
  renderGrades();
}

function selectGrade(grade) {
  currentGrade = grade;
  currentBranch = null;
  currentSubject = null;
  const branches = BRANCHES[grade] || [];
  if (branches.length === 0) {
    renderSubjects();
  } else {
    renderBranches();
  }
}

function selectBranch(branch) {
  currentBranch = branch;
  currentSubject = null;
  renderSubjects();
}

function selectSubject(subject) {
  currentSubject = subject;
  renderPosts();
}

function renderGrades() {
  const content = $('mainContent');
  content.innerHTML = `
    <div class="section-header">
      <h2>📚 اختر السنة الدراسية</h2>
      <p>تصفح التمارين حسب مستواك الدراسي</p>
    </div>
    <div class="grid-years">
      ${Object.entries(GRADES).map(([key, g]) => `
        <div class="card-year animate-in" onclick="selectGrade('${key}')">
          <span class="year-emoji">${g.emoji}</span>
          <div class="year-title">${g.name}</div>
          <div class="year-sub">${g.sub}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderBranches() {
  const g = GRADES[currentGrade];
  const branches = BRANCHES[currentGrade];
  const content = $('mainContent');
  content.innerHTML = `
    <div class="breadcrumb">
      <a onclick="goHome()">الرئيسية</a>
      <span class="sep">›</span>
      <span>${g.name}</span>
    </div>
    <div class="section-header">
      <h2>${g.emoji} ${g.name}</h2>
      <p>${currentGrade === '2eme' ? 'اختر المسلك' : 'اختر الشعبة'}</p>
    </div>
    <div class="grid-years">
      ${branches.map(b => `
        <div class="card-year animate-in" onclick="selectBranch('${b.key}')">
          <span class="year-emoji">${b.emoji}</span>
          <div class="year-title">${b.name}</div>
          <div class="year-sub">${g.sub}</div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderSubjects() {
  const g = GRADES[currentGrade];
  const content = $('mainContent');
  const branchName = currentBranch
    ? (BRANCHES[currentGrade].find(b => b.key === currentBranch) || {}).name
    : null;
  const subjectKeys = getSubjects(currentGrade, currentBranch);

  content.innerHTML = `
    <div class="breadcrumb">
      <a onclick="goHome()">الرئيسية</a>
      <span class="sep">›</span>
      ${currentBranch
        ? `<a onclick="selectGrade('${currentGrade}')">${g.name}</a>
           <span class="sep">›</span>
           <span>${branchName}</span>`
        : `<span>${g.name}</span>`}
    </div>
    <div class="section-header">
      <h2>${g.emoji} ${branchName || g.name}</h2>
      <p>اختر المادة لعرض التمارين</p>
    </div>
    <div class="grid-subjects">
      ${subjectKeys.map(key => {
        const s = SUBJECTS[key];
        if (!s) return '';
        return `
          <div class="card-subject animate-in" onclick="selectSubject('${key}')">
            <span class="subject-emoji">${s.emoji}</span>
            <div class="subject-title">${s.name}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function renderPosts() {
  const g = GRADES[currentGrade];
  const s = SUBJECTS[currentSubject];
  const branchName = currentBranch
    ? (BRANCHES[currentGrade].find(b => b.key === currentBranch) || {}).name
    : null;
  const content = $('mainContent');

  content.innerHTML = `
    <div class="breadcrumb">
      <a onclick="goHome()">الرئيسية</a>
      <span class="sep">›</span>
      ${currentBranch
        ? `<a onclick="selectGrade('${currentGrade}')">${g.name}</a>
           <span class="sep">›</span>
           <a onclick="selectBranch('${currentBranch}')">${branchName}</a>`
        : `<a onclick="selectGrade('${currentGrade}')">${g.name}</a>`}
      <span class="sep">›</span>
      <span>${s.name}</span>
    </div>
    <div class="section-header">
      <h2>${s.emoji} ${s.name}</h2>
      <p>التمارين المرفوعة من الطلاب</p>
    </div>
    <div class="search-bar">
      <input type="text" id="searchInput" placeholder="🔍 ابحث في التمارين..." value="${currentSearch}">
    </div>
    <div id="postsContainer">
      <div class="grid-posts">
        ${showSkeletonGrid('posts', 4)}
      </div>
    </div>
  `;
  const searchInput = $('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      clearTimeout(window._searchTimer);
      window._searchTimer = setTimeout(loadPosts, 400);
    });
  }
  await loadPosts();
}

async function loadPosts() {
  const container = $('postsContainer');
  if (!container) return;
  const params = new URLSearchParams({
    grade: currentGrade,
    subject: currentSubject
  });
  if (currentBranch) params.append('branch', currentBranch);
  if (currentSearch) params.append('search', currentSearch);

  const r = await fetch('/api/posts?' + params.toString()).then(r => r.json());
  const posts = r.posts || [];

  if (posts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <h3>لا توجد تمارين بعد</h3>
        <p>كن أول من ينشر تمريناً في هذه المادة</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="grid-posts">
      ${posts.map(p => renderPostCard(p)).join('')}
    </div>
  `;
}

function renderPostCard(p) {
  const initial = (p.full_name || p.username || '?')[0].toUpperCase();
  const isImage = !p.image_path.toLowerCase().endsWith('.pdf');
  return `
    <div class="card-post animate-in">
      ${isImage 
        ? `<img class="post-image" src="${escapeHtml(p.image_path)}" onclick="viewImage('${escapeHtml(p.image_path)}')" loading="lazy">`
        : `<div class="post-image" style="display:flex;align-items:center;justify-content:center;font-size:48px" onclick="window.open('${escapeHtml(p.image_path)}','_blank')">📄</div>`
      }
      <div class="post-body">
        <div class="post-title">${escapeHtml(p.title)}</div>
        ${p.description ? `<div class="post-desc">${escapeHtml(p.description)}</div>` : ''}
        <div class="post-meta">
          <div class="post-author">
            <div class="post-author-avatar">${initial}</div>
            <span>${escapeHtml(p.full_name || p.username)}</span>
          </div>
          <span>${formatDate(p.created_at)}</span>
        </div>
        <div class="post-actions">
          <button class="btn-like" onclick="likePost(${p.id}, this)">
            ❤️ <span>${p.likes || 0}</span>
          </button>
          <button class="btn-download" onclick="downloadPost(${p.id}, '${escapeHtml(p.image_path)}')">
            ⬇️ تحميل
          </button>
        </div>
      </div>
    </div>
  `;
}

async function likePost(id, btn) {
  const r = await safeFetch(`/api/posts/${id}/like`, { method: 'POST' }).then(r => r.json());
  if (r.ok) {
    btn.querySelector('span').textContent = r.likes;
    btn.classList.toggle('active', r.liked);
  }
}

async function downloadPost(id, path) {
  console.log('⬇️ Download:', { id, path });

  try {
    const token = await fetchFreshToken();
    
    if (token) {
      const res = await fetch(`/api/posts/${id}/download`, {
        method: 'POST',
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json',
          'X-CSRF-Token': token
        },
        body: JSON.stringify({ _csrf: token })
      });
      const data = await res.json();
      console.log('📊 Download log:', data);
    }
  } catch (e) {
    console.warn('Download log failed:', e);
  }

  try {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile || path.toLowerCase().endsWith('.pdf')) {
      window.open(path, '_blank');
    } else {
      const a = document.createElement('a');
      a.href = path;
      a.download = path.split('/').pop();
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 100);
    }
  } catch (e) {
    console.error('Download failed:', e);
    window.open(path, '_blank');
  }
}

function openPublish() {
  $('publishModal').classList.add('active');
  $('pub-grade').value = currentGrade || '';
  onGradeChange();
  if (currentBranch) {
    setTimeout(() => {
      $('pub-branch').value = currentBranch;
      onBranchChange();
    }, 50);
  }
  if (currentSubject) $('pub-subject').value = currentSubject;
  loadUploadStatus();
}

function closePublish() {
  $('publishModal').classList.remove('active');
  $('pub-grade').value = '';
  $('pub-branch').value = '';
  $('pub-branch').style.display = 'none';
  $('pub-subject').innerHTML = '<option value="">اختر المادة</option>';
  $('pub-title').value = '';
  $('pub-desc').value = '';
  $('pub-file').value = '';
  $('filePreview').style.display = 'none';
  $('fileLabel').textContent = 'اضغط لاختيار صورة أو PDF';
  $('fileDrop').classList.remove('has-file');
  $('pubMsg').textContent = '';
  selectedFile = null;
}

function onGradeChange() {
  const grade = $('pub-grade').value;
  const branchSelect = $('pub-branch');
  const branches = BRANCHES[grade] || [];
  
  if (branches.length === 0) {
    branchSelect.style.display = 'none';
    branchSelect.innerHTML = '<option value="">اختر الشعبة</option>';
    updatePublishSubjects(grade, null);
  } else {
    branchSelect.style.display = 'block';
    branchSelect.innerHTML = '<option value="">اختر الشعبة</option>' +
      branches.map(b => `<option value="${b.key}">${b.emoji} ${b.name}</option>`).join('');
    $('pub-subject').innerHTML = '<option value="">اختر المادة</option>';
  }
}

function onBranchChange() {
  const grade = $('pub-grade').value;
  const branch = $('pub-branch').value;
  updatePublishSubjects(grade, branch);
}

function updatePublishSubjects(grade, branch) {
  const subjectSelect = $('pub-subject');
  if (branch || grade === '1ere') {
    const subjects = getSubjects(grade, branch);
    subjectSelect.innerHTML = '<option value="">اختر المادة</option>' +
      subjects.map(key => {
        const s = SUBJECTS[key];
        if (!s) return '';
        return `<option value="${key}">${s.emoji} ${s.name}</option>`;
      }).join('');
  } else {
    subjectSelect.innerHTML = '<option value="">اختر المادة</option>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = $('pub-file');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 8 * 1024 * 1024) {
        $('pubMsg').textContent = '❌ الحجم أكبر من 8MB';
        return;
      }
      selectedFile = file;
      $('fileDrop').classList.add('has-file');
      $('fileLabel').textContent = '✓ ' + file.name;
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          $('filePreview').src = ev.target.result;
          $('filePreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
      } else {
        $('filePreview').style.display = 'none';
      }
    });
  }
});

async function loadUploadStatus() {
  try {
    const r = await fetch('/api/upload/status').then(r => r.json());
    if (r.ok) {
      uploadStatus = r;
      updateUploadIndicator();
    }
  } catch (e) {}
}

function updateUploadIndicator() {
  const indicator = document.getElementById('uploadLimitIndicator');
  if (!indicator || !uploadStatus) return;
  const rem = uploadStatus.remaining;
  indicator.innerHTML = `
    <div class="upload-limit-row">
      <span>⏱️ الدقيقة:</span>
      <span class="${rem.per_minute === 0 ? 'limit-zero' : ''}">${rem.per_minute}/${uploadStatus.limits.perMinute}</span>
    </div>
    <div class="upload-limit-row">
      <span>🕐 الساعة:</span>
      <span class="${rem.per_hour === 0 ? 'limit-zero' : ''}">${rem.per_hour}/${uploadStatus.limits.perHour}</span>
    </div>
    <div class="upload-limit-row">
      <span>📅 اليوم:</span>
      <span class="${rem.per_day === 0 ? 'limit-zero' : ''}">${rem.per_day}/${uploadStatus.limits.perDay}</span>
    </div>
  `;
}

async function submitPublish() {
  const grade = $('pub-grade').value;
  const branch = $('pub-branch').value;
  const subject = $('pub-subject').value;
  const title = $('pub-title').value.trim();
  const description = $('pub-desc').value.trim();
  const msg = $('pubMsg');

  if (!grade) { msg.textContent = '❌ اختر السنة'; return; }
  const branches = BRANCHES[grade] || [];
  if (branches.length > 0 && !branch) { msg.textContent = '❌ اختر الشعبة'; return; }
  if (!subject) { msg.textContent = '❌ اختر المادة'; return; }
  if (!title) { msg.textContent = '❌ اكتب عنواناً'; return; }
  if (!selectedFile) { msg.textContent = '❌ اختر صورة أو PDF'; return; }

  msg.textContent = '⏳ جاري الرفع...';
  $('pubBtn').disabled = true;

  const fd = new FormData();
  fd.append('image', selectedFile);
  const upRes = await safeFetch('/api/upload', { method: 'POST', body: fd });
  const up = await upRes.json();

  if (!up.ok) {
    msg.textContent = '❌ ' + up.error;
    $('pubBtn').disabled = false;
    loadUploadStatus();
    return;
  }

  const r = await safeFetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grade, branch: branch || null, subject, title, description,
      image_path: up.path
    })
  }).then(r => r.json());

  $('pubBtn').disabled = false;
  loadUploadStatus();

  if (r.ok) {
    msg.textContent = '✓ تم النشر بنجاح!';
    setTimeout(() => {
      closePublish();
      currentGrade = grade;
      currentBranch = branch || null;
      currentSubject = subject;
      renderPosts();
    }, 800);
  } else {
    msg.textContent = '❌ ' + r.error;
  }
}

function viewImage(path) {
  $('imageModalImg').src = path;
  $('imageModal').classList.add('active');
}

function closeImage() {
  $('imageModal').classList.remove('active');
}

async function logout() {
  await safeFetch('/api/logout', { method: 'POST' });
  location.replace('/');
}

async function checkNotifications() {
  try {
    const r = await fetch('/api/notifications').then(r => r.json());
    if (r.ok && r.notifications && r.notifications.length > 0) {
      showNotif(r.notifications[0]);
      fetch('/api/notifications/read', { method: 'POST', credentials: 'include' });
    }
  } catch (e) {}
}

function showNotif(notif) {
  const popup = $('notifPopup');
  if (!popup) return;
  const titles = { 'ban': '🚫 تم حظرك', 'warn': '⚠️ تحذير', 'info': '📢 إشعار' };
  $('notifTitle').textContent = titles[notif.type] || '📢 إشعار';
  $('notifMessage').textContent = notif.message;
  popup.classList.add('active');
  setTimeout(() => closeNotif(), 8000);
}

function closeNotif() {
  const popup = $('notifPopup');
  if (popup) popup.classList.remove('active');
}

function openSettings() {
  const overlay = $('settingsOverlay');
  const drawer = $('settingsDrawer');
  if (!overlay || !drawer) return;

  if (currentUser) {
    const initial = (currentUser.fullName || currentUser.username)[0].toUpperCase();
    $('settingsAvatar').textContent = initial;
    $('settingsName').textContent = currentUser.fullName || currentUser.username;
    $('settingsUsername').textContent = '@' + currentUser.username;
  }

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  document.querySelectorAll('.theme-option-v2').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === currentTheme);
  });

  overlay.classList.add('active');
  drawer.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  const overlay = $('settingsOverlay');
  const drawer = $('settingsDrawer');
  if (overlay) overlay.classList.remove('active');
  if (drawer) drawer.classList.remove('active');
  document.body.style.overflow = '';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('studyhub-theme', theme);
  document.querySelectorAll('.theme-option-v2').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.theme === theme);
  });
  const colors = {
    dark: '#0F172A', light: '#F8FAFC', ocean: '#082F49',
    sakura: '#1F0A1A', forest: '#052E16', midnight: '#000000'
  };
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = colors[theme] || '#8B5CF6';
}

(function loadTheme() {
  const saved = localStorage.getItem('studyhub-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function showSkeletonGrid(type, count) {
  const items = [];
  for (let i = 0; i < count; i++) {
    if (type === 'posts') {
      items.push(`
        <div class="skeleton-post">
          <div class="skeleton skeleton-image"></div>
          <div class="skeleton-body">
            <div class="skeleton skeleton-line short"></div>
            <div class="skeleton skeleton-line tiny"></div>
          </div>
        </div>
      `);
    } else {
      items.push(`
        <div class="skeleton-card">
          <div class="skeleton skeleton-circle"></div>
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line tiny"></div>
        </div>
      `);
    }
  }
  return items.join('');
}

function setActiveNav(btn) {
  document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function showProfile() {
  if (!currentUser) return;
  const initial = (currentUser.fullName || currentUser.username)[0].toUpperCase();
  const content = $('mainContent');
  content.innerHTML = `
    <div class="section-header">
      <h2>👤 حسابي</h2>
      <p>معلوماتك الشخصية</p>
    </div>
    <div style="max-width:400px;margin:0 auto;padding:32px 24px;background:var(--glass);backdrop-filter:blur(24px);border:1px solid var(--border);border-radius:24px;text-align:center;">
      <div style="width:80px;height:80px;margin:0 auto 16px;background:var(--grad-2);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:white;">
        ${initial}
      </div>
      <h3 style="font-size:22px;margin-bottom:6px;">${escapeHtml(currentUser.fullName || currentUser.username)}</h3>
      <p style="color:var(--text-dim);font-size:14px;margin-bottom:24px;">@${escapeHtml(currentUser.username)}</p>
      <button class="btn-primary" onclick="logout()" style="max-width:200px;margin:0 auto;">
        <span>خروج</span>
      </button>
    </div>
  `;
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

async function installPWA() {
  if (!deferredPrompt) {
    alert('التطبيق مثبّت بالفعل أو غير مدعوم في متصفحك');
    return;
  }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  if (outcome === 'accepted') closeSettings();
}

async function checkWelcome() {
  try {
    const r = await fetch('/api/welcome/check').then(r => r.json());
    if (r.ok && r.isNew) {
      setTimeout(() => {
        const overlay = $('welcomeOverlay');
        if (overlay) {
          overlay.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      }, 800);
    }
  } catch (e) {}
}

async function closeWelcome() {
  const overlay = $('welcomeOverlay');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.remove('active', 'fade-out');
      document.body.style.overflow = '';
    }, 400);
  }
  try {
    // استخدم safeFetch (لأن المسار مُستثنى من CSRF، لا يهم)
    await fetch('/api/welcome/seen', { 
      method: 'POST', 
      credentials: 'include' 
    });
  } catch (e) {}
}

function escapeHtml(text) {
  return String(text == null ? '' : text).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

function formatDate(dt) {
  if (!dt) return '';
  const d = new Date(dt.replace(' ', 'T'));
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'الآن';
  if (diff < 3600) return Math.floor(diff / 60) + ' د';
  if (diff < 86400) return Math.floor(diff / 3600) + ' س';
  if (diff < 604800) return Math.floor(diff / 86400) + ' ي';
  return d.toLocaleDateString('ar-TN');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePublish();
    closeImage();
    closeSettings();
  }
});

const publishModalEl = $('publishModal');
if (publishModalEl) {
  publishModalEl.addEventListener('click', (e) => {
    if (e.target === publishModalEl) closePublish();
  });
}

init();
setTimeout(checkNotifications, 1500);
setTimeout(checkWelcome, 300);
setInterval(checkNotifications, 30000);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(() => console.log('✅ SW registered'))
    .catch((err) => console.log('❌ SW error:', err));
}
