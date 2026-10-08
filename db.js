const path = require('path');
const fs = require('fs');

// ============================================
// اكتشاف البيئة
// ============================================
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
const HAS_TURSO = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

let db;

// ============================================
// الجداول (مشتركة بين البيئتين)
// ============================================
const TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT,
    last_ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    post_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS banned_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    username TEXT NOT NULL,
    reason TEXT,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS banned_ips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE NOT NULL,
    reason TEXT,
    banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    ip TEXT,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info',
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    ip TEXT,
    alert_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS welcome_seen (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE NOT NULL,
    seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS csrf_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    session_id TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    username TEXT,
    user_agent TEXT,
    success INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

// ============================================
// الإنتاج: Turso Cloud
// ============================================
if (IS_PRODUCTION && HAS_TURSO) {
  console.log('🌐 Using Turso Cloud (production)');
  const { createClient } = require('@libsql/client');

  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  // واجهة متوافقة مع sqlite3
  db = {
    get: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (!Array.isArray(params)) params = params == null ? [] : [params];
      turso.execute({ sql, args: params })
        .then(r => { if (cb) cb(null, r.rows[0] || null); })
        .catch(e => { if (cb) cb(e); });
    },
    all: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (!Array.isArray(params)) params = params == null ? [] : [params];
      turso.execute({ sql, args: params })
        .then(r => { if (cb) cb(null, r.rows || []); })
        .catch(e => { if (cb) cb(e); });
    },
    run: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (!Array.isArray(params)) params = params == null ? [] : [params];
      turso.execute({ sql, args: params })
        .then(r => {
          const ctx = {
            lastID: r.lastInsertRowid !== undefined ? Number(r.lastInsertRowid) : 0,
            changes: r.rowsAffected || 0
          };
          if (cb) cb.call(ctx, null);
        })
        .catch(e => { if (cb) cb.call(null, e); });
    },
    raw: turso
  };

  // إنشاء الجداول على Turso
  (async () => {
    try {
      // Turso يدعم تنفيذ جملة واحدة في كل مرة
      const statements = TABLES_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const stmt of statements) {
        try {
          await turso.execute(stmt);
        } catch (e) {
          // تجاهل أخطاء "already exists"
        }
      }
      console.log('✅ Turso tables ready');
    } catch (err) {
      console.error('❌ Turso init error:', err.message);
    }
  })();
}

// ============================================
// التطوير: sql.js (ملف محلي)
// ============================================
else {
  console.log('📁 Using local SQLite (sql.js)');
  const initSqlJs = require('sql.js');

  const DB_PATH = path.join(__dirname, 'studyhub.db');
  let sqlDb = null;
  let SQL = null;
  let saveTimeout = null;

  async function initDB() {
    try {
      SQL = await initSqlJs();

      if (fs.existsSync(DB_PATH)) {
        sqlDb = new SQL.Database(fs.readFileSync(DB_PATH));
        console.log('✅ Loaded existing database');
      } else {
        sqlDb = new SQL.Database();
        console.log('✅ Created new database');
      }

      sqlDb.run(TABLES_SQL);
      saveDB();
      console.log('✅ Database ready');
    } catch (err) {
      console.error('❌ DB Init Error:', err.message);
    }
  }

  function saveDB() {
    if (!sqlDb) return;
    try {
      fs.writeFileSync(DB_PATH, Buffer.from(sqlDb.export()));
    } catch (err) {
      console.error('❌ Save error:', err.message);
    }
  }

  function scheduleSave() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveDB, 100);
  }

  db = {
    get: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (!Array.isArray(params)) params = params == null ? [] : [params];
      if (!sqlDb) { if (cb) cb(new Error('DB not ready')); return; }
      try {
        const stmt = sqlDb.prepare(sql);
        stmt.bind(params);
        let row = null;
        if (stmt.step()) row = stmt.getAsObject();
        stmt.free();
        if (cb) cb(null, row);
      } catch (e) {
        if (cb) cb(e);
      }
    },
    all: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (!Array.isArray(params)) params = params == null ? [] : [params];
      if (!sqlDb) { if (cb) cb(new Error('DB not ready')); return; }
      try {
        const stmt = sqlDb.prepare(sql);
        stmt.bind(params);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        if (cb) cb(null, rows);
      } catch (e) {
        if (cb) cb(e);
      }
    },
    run: (sql, params, cb) => {
      if (typeof params === 'function') { cb = params; params = []; }
      if (!Array.isArray(params)) params = params == null ? [] : [params];
      if (!sqlDb) { if (cb) cb.call(null, new Error('DB not ready')); return; }
      try {
        const stmt = sqlDb.prepare(sql);
        stmt.bind(params);
        stmt.step();
        stmt.free();
        scheduleSave();

        let lastID = 0;
        try {
          const r = sqlDb.exec('SELECT last_insert_rowid() as id');
          if (r[0] && r[0].values && r[0].values[0]) {
            lastID = r[0].values[0][0];
          }
        } catch (e) {}

        const ctx = { lastID: lastID, changes: sqlDb.getRowsModified() };
        if (cb) cb.call(ctx, null);
      } catch (e) {
        if (cb) cb.call(null, e);
      }
    },
    save: saveDB,
    raw: sqlDb
  };

  initDB();
}

module.exports = db;
