// ============================================
// EZZI · Control Panel Logic
// ============================================

fetch('/api/ezzi/check').then(r => r.json()).then(r => {
  if (!r.ok) location.replace('/ezzi');
});

const $ = (id) => document.getElementById(id);
let currentTab = 'users';

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

async function ezziLogout() {
  await safeFetch('/api/ezzi/logout', { method: 'POST' });
  location.replace('/ezzi');
}

async function loadStats() {
  const r = await fetch('/api/ezzi/stats').then(r => r.json());
  if (!r.ok) return;
  $('statUsers').textContent = r.stats.users;
  $('statPosts').textContent = r.stats.posts;
  $('statDownloads').textContent = r.stats.downloads;
  $('statBanned').textContent = r.stats.banned_users + r.stats.banned_ips;
}

function switchEzziTab(tab, ev) {
  document.querySelectorAll('.ezzi-tab').forEach(t => t.classList.remove('active'));
  if (ev && ev.target) {
    const btn = ev.target.closest('.ezzi-tab');
    if (btn) btn.classList.add('active');
  }
  currentTab = tab;
  loadTab();
}

async function loadTab() {
  const c = $('ezziContent');
  c.innerHTML = '<div class="loader"><div class="spinner"></div></div>';
  if (currentTab === 'users') await renderUsers();
  else if (currentTab === 'alerts') await renderAlerts();
  else if (currentTab === 'banned-users') await renderBannedUsers();
  else if (currentTab === 'banned-ips') await renderBannedIps();
  else if (currentTab === 'posts') await renderPosts();
}

async function renderUsers() {
  const r = await fetch('/api/ezzi/users').then(r => r.json());
  const c = $('ezziContent');
  if (!r.users.length) {
    c.innerHTML = '<div class="empty-ezzi"><div class="icon">👥</div><p>لا يوجد مستخدمون</p></div>';
    return;
  }
  c.innerHTML = `
    <table class="ezzi-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>الاسم</th>
          <th>IP</th>
          <th>منشورات</th>
          <th>الحالة</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${r.users.map(u => `
          <tr>
            <td>${u.id}</td>
            <td>
              <div class="username">${escapeHtml(u.username)}</div>
              <div style="font-size:11px;color:#64748B">${escapeHtml(u.full_name || '')}</div>
            </td>
            <td class="ip">${escapeHtml(u.last_ip || '—')}</td>
            <td>${u.posts_count}</td>
            <td>${u.is_banned ? '<span class="badge badge-ban">محظور</span>' : '<span class="badge badge-ok">نشط</span>'}</td>
            <td>
              ${u.is_banned ? '' : `<button class="btn-sm btn-ban" onclick="banUser(${u.id}, '${escapeAttr(u.username)}')">🚫 حظر</button>`}
              <button class="btn-sm btn-delete" onclick="deleteUser(${u.id}, '${escapeAttr(u.username)}')">🗑 حذف</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderAlerts() {
  const r = await fetch('/api/ezzi/alerts').then(r => r.json());
  const c = $('ezziContent');
  
  if (!r.alerts.length) {
    c.innerHTML = '<div class="empty-ezzi"><div class="icon">✨</div><p>لا توجد تنبيهات</p></div>';
    return;
  }

  const typeInfo = {
    'minute': { emoji: '⚡', label: 'تجاوز الدقيقة', cls: 'alert-type-minute' },
    'hour':   { emoji: '🔥', label: 'تجاوز الساعة',  cls: 'alert-type-hour' },
    'day':    { emoji: '🚨', label: 'تجاوز يومي',    cls: 'alert-type-day' },
    'security': { emoji: '🛡️', label: 'أمني',  cls: 'alert-type-day' }
  };

  c.innerHTML = `
    <div class="alerts-toolbar">
      <h3>🚨 التنبيهات (${r.alerts.length})</h3>
      <div>
        <button class="btn-sm btn-unban" onclick="markAllRead()">✓ تعليم الكل كمقروء</button>
        <button class="btn-sm btn-danger" onclick="deleteAllAlerts()">🗑 حذف الكل</button>
      </div>
    </div>
    ${r.alerts.map(a => {
      let details = null;
      try { details = JSON.parse(a.details); } catch (e) {}
      const info = typeInfo[a.alert_type] || { emoji: '🔔', label: a.alert_type, cls: '' };
      
      return `
        <div class="alert-card ${a.is_read ? '' : 'unread'}" id="alert-${a.id}">
          <div class="alert-card-icon">${info.emoji}</div>
          <div class="alert-card-body">
            <div class="alert-card-header">
              <div class="alert-card-title ${info.cls}">
                ${info.label}: <span class="username">${escapeHtml(a.username || 'مجهول')}</span>
              </div>
              <div class="alert-card-time">${formatDate(a.created_at)}</div>
            </div>
            <div class="alert-card-details">
              🌐 IP: <span class="ip">${escapeHtml(a.ip || '—')}</span>
              ${details && details.stats ? `
                <br>⏱️ الدقيقة: <span class="val">${details.stats.per_minute}</span>
                · 🕐 الساعة: <span class="val">${details.stats.per_hour}</span>
                · 📅 اليوم: <span class="val">${details.stats.per_day}</span>
              ` : ''}
              ${details && details.url ? `
                <br>🔗 ${escapeHtml(details.url)}
              ` : ''}
              ${details && details.userAgent ? `
                <br>🕵️ UA: ${escapeHtml(details.userAgent.substring(0, 80))}
              ` : ''}
            </div>
            <div class="alert-card-actions">
              ${a.is_read ? '' : `<button class="btn-sm btn-unban" onclick="markAlertRead(${a.id})">✓ مقروء</button>`}
              <button class="btn-sm btn-danger" onclick="deleteAlert(${a.id})">🗑 حذف</button>
              ${a.user_id ? `<button class="btn-sm btn-ban" onclick="banFromAlert(${a.user_id}, '${escapeAttr(a.username)}')">🚫 حظر</button>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('')}
  `;
}

async function markAlertRead(id) {
  await safeFetch(`/api/ezzi/alerts/${id}/read`, { method: 'POST' });
  loadAlertsBadge();
  loadTab();
}

async function markAllRead() {
  await safeFetch('/api/ezzi/alerts/read-all', { method: 'POST' });
  loadAlertsBadge();
  loadTab();
}

async function deleteAlert(id) {
  if (!confirm('حذف هذا التنبيه؟')) return;
  await safeFetch(`/api/ezzi/alerts/${id}`, { method: 'DELETE' });
  loadAlertsBadge();
  loadTab();
}

async function deleteAllAlerts() {
  if (!confirm('حذف كل التنبيهات؟')) return;
  await safeFetch('/api/ezzi/alerts', { method: 'DELETE' });
  loadAlertsBadge();
  loadTab();
}

async function banFromAlert(userId, username) {
  if (!userId) return;
  const reason = prompt(`سبب حظر "${username}":`, 'تجاوز حدود الرفع (سبام)');
  if (reason === null) return;
  const r = await safeFetch('/api/ezzi/ban-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, reason })
  }).then(r => r.json());
  if (r.ok) {
    alert(`✅ تم حظر ${username}`);
    loadStats();
    loadTab();
  }
}

async function loadAlertsBadge() {
  try {
    const r = await fetch('/api/ezzi/alerts/unread-count').then(r => r.json());
    const badge = $('alertsBadge');
    if (!badge) return;
    if (r.ok && r.count > 0) {
      badge.textContent = r.count;
      badge.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {}
}

async function renderBannedUsers() {
  const r = await fetch('/api/ezzi/banned-users').then(r => r.json());
  const c = $('ezziContent');
  if (!r.banned.length) {
    c.innerHTML = '<div class="empty-ezzi"><div class="icon">✨</div><p>لا يوجد محظورون</p></div>';
    return;
  }
  c.innerHTML = `
    <table class="ezzi-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>المستخدم</th>
          <th>السبب</th>
          <th>التاريخ</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${r.banned.map(b => `
          <tr>
            <td>${b.id}</td>
            <td class="username">${escapeHtml(b.username)}</td>
            <td class="reason">${escapeHtml(b.reason || '—')}</td>
            <td class="time">${formatDate(b.banned_at)}</td>
            <td>
              <button class="btn-sm btn-unban" onclick="unbanUser(${b.id})">✅ نزع الحظر</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderBannedIps() {
  const r = await fetch('/api/ezzi/banned-ips').then(r => r.json());
  const c = $('ezziContent');
  if (!r.banned.length) {
    c.innerHTML = '<div class="empty-ezzi"><div class="icon">🌐</div><p>لا توجد IPs محظورة</p></div>';
    return;
  }
  c.innerHTML = `
    <table class="ezzi-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>IP</th>
          <th>السبب</th>
          <th>التاريخ</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${r.banned.map(b => `
          <tr>
            <td>${b.id}</td>
            <td class="ip">${escapeHtml(b.ip)}</td>
            <td class="reason">${escapeHtml(b.reason || '—')}</td>
            <td class="time">${formatDate(b.banned_at)}</td>
            <td>
              <button class="btn-sm btn-unban" onclick="unbanIp(${b.id})">✅ نزع الحظر</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function renderPosts() {
  const r = await fetch('/api/ezzi/posts').then(r => r.json());
  const c = $('ezziContent');
  if (!r.posts.length) {
    c.innerHTML = '<div class="empty-ezzi"><div class="icon">📤</div><p>لا توجد منشورات</p></div>';
    return;
  }
  c.innerHTML = `
    <table class="ezzi-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>العنوان</th>
          <th>الناشر</th>
          <th>السنة/الشعبة</th>
          <th>المادة</th>
          <th>⬇️</th>
          <th>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        ${r.posts.map(p => `
          <tr>
            <td>${p.id}</td>
            <td style="font-weight:600">${escapeHtml(p.title)}</td>
            <td class="username">${escapeHtml(p.username || '—')}</td>
            <td style="font-size:11px">${escapeHtml(p.grade)}${p.branch ? ' / ' + escapeHtml(p.branch) : ''}</td>
            <td style="font-size:11px">${escapeHtml(p.subject)}</td>
            <td>${p.downloads || 0}</td>
            <td>
              <a href="${escapeHtml(p.image_path)}" target="_blank" class="btn-sm" style="border-color:#8B5CF6;color:#8B5CF6;text-decoration:none;display:inline-block">👁 عرض</a>
              <button class="btn-sm btn-delete" onclick="deletePost(${p.id})">🗑</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function banUser(id, username) {
  const reason = prompt(`سبب حظر "${username}":`, 'مخالفة القوانين');
  if (reason === null) return;
  const r = await safeFetch('/api/ezzi/ban-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: id, reason })
  }).then(r => r.json());
  if (r.ok) {
    alert(`✅ تم حظر ${username}` + (r.banned_ip ? `\n🌐 وحظر IP: ${r.banned_ip}` : ''));
    loadStats();
    loadTab();
  } else {
    alert('❌ ' + r.error);
  }
}

async function unbanUser(id) {
  if (!confirm('نزع الحظر عن هذا المستخدم؟ (سيُنزع الحظر عن IP المرتبط أيضاً)')) return;
  const r = await safeFetch(`/api/ezzi/unban-user/${id}`, { method: 'DELETE' }).then(r => r.json());
  if (r.ok) { loadStats(); loadAlertsBadge(); loadTab(); }
}

async function unbanIp(id) {
  if (!confirm('نزع الحظر عن عنوان IP هذا؟')) return;
  const r = await safeFetch(`/api/ezzi/unban-ip/${id}`, { method: 'DELETE' }).then(r => r.json());
  if (r.ok) { loadStats(); loadTab(); }
}

async function deleteUser(id, username) {
  if (!confirm(`حذف المستخدم "${username}" وكل منشوراته نهائياً؟`)) return;
  const r = await safeFetch(`/api/ezzi/users/${id}`, { method: 'DELETE' }).then(r => r.json());
  if (r.ok) { loadStats(); loadTab(); }
}

async function deletePost(id) {
  if (!confirm('حذف هذا المنشور؟')) return;
  const r = await safeFetch(`/api/ezzi/posts/${id}`, { method: 'DELETE' }).then(r => r.json());
  if (r.ok) { loadStats(); loadTab(); }
}

function escapeHtml(text) {
  return String(text == null ? '' : text).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[s]));
}

function escapeAttr(text) {
  return String(text == null ? '' : text).replace(/'/g, "\\'");
}

function formatDate(dt) {
  if (!dt) return '—';
  const d = new Date(dt.replace(' ', 'T'));
  return d.toLocaleDateString('ar-TN') + ' ' + d.toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit' });
}

loadStats();
loadAlertsBadge();
loadTab();

setInterval(loadAlertsBadge, 15000);
