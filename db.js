const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'studyhub.db'));

db.serialize(() => {
  // المستخدمون
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    last_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // المنشورات
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    grade TEXT NOT NULL,
    branch TEXT,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    image_path TEXT NOT NULL,
    likes INTEGER DEFAULT 0,
    downloads INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  // الإعجابات
  db.run(`CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
  )`);

  // المحظورون (مستخدمون)
  db.run(`CREATE TABLE IF NOT EXISTS banned_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    reason TEXT,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // المحظورون (IPs)
  db.run(`CREATE TABLE IF NOT EXISTS banned_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE NOT NULL,
    reason TEXT,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // الإشعارات
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ip TEXT,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // سجل الرفع
  db.run(`CREATE TABLE IF NOT EXISTS uploads_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // تنبيهات المشرف
  db.run(`CREATE TABLE IF NOT EXISTS admin_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    ip TEXT,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // سجل رؤية الترحيب
  db.run(`CREATE TABLE IF NOT EXISTS welcome_seen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE NOT NULL,
    seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // CSRF Tokens
  db.run(`CREATE TABLE IF NOT EXISTS csrf_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    session_id TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // محاولات الدخول (لمنع Hydra)
  db.run(`CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    username TEXT,
    user_agent TEXT,
    success INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // فهارس
  db.run(`CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads_log(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_uploads_time ON uploads_log(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_alerts_read ON admin_alerts(is_read)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_csrf_token ON csrf_tokens(token)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_csrf_created ON csrf_tokens(created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_ip_time ON login_attempts(ip, created_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_login_user_time ON login_attempts(username, created_at)`);
});

module.exports = db;
