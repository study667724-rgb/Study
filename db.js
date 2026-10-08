const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'studyhub.db');

let db = null;
let SQL = null;
let saveTimeout = null;

// ============================================
// تهيئة قاعدة البيانات
// ============================================
async function initDB() {
  try {
    SQL = await initSqlJs();
    
    if (fs.existsSync(DB_PATH)) {
      const filebuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(filebuffer);
      console.log('✅ Loaded existing database');
    } else {
      db = new SQL.Database();
      console.log('✅ Created new database');
    }

    // ============================================
    // إنشاء الجداول
    // ============================================
    db.run(`
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
    `);
    
    // حفظ التغييرات الأولية
    saveDB();
    console.log('✅ Database ready');

  } catch (err) {
    console.error('❌ DB Init Error:', err);
  }
}

// ============================================
// حفظ قاعدة البيانات إلى ملف (مع debounce)
// ============================================
function saveDB() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('❌ DB Save Error:', err.message);
  }
}

// Debounced save (لتجنب الحفظ المتكرر)
function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveDB, 100);
}

// ============================================
// واجهة متوافقة مع sqlite3
// ============================================
const wrapper = {
  get(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    if (!Array.isArray(params)) params = params == null ? [] : [params];
    if (!db) {
      const err = new Error('Database not ready');
      if (cb) cb(err);
      return;
    }
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      let row = null;
      if (stmt.step()) {
        row = stmt.getAsObject();
      }
      stmt.free();
      if (cb) cb(null, row);
      return row;
    } catch (e) {
      if (cb) cb(e);
      else throw e;
    }
  },

  all(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    if (!Array.isArray(params)) params = params == null ? [] : [params];
    if (!db) {
      const err = new Error('Database not ready');
      if (cb) cb(err);
      return;
    }
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      if (cb) cb(null, rows);
      return rows;
    } catch (e) {
      if (cb) cb(e);
      else throw e;
    }
  },

  run(sql, params, cb) {
    if (typeof params === 'function') { cb = params; params = []; }
    if (!Array.isArray(params)) params = params == null ? [] : [params];
    if (!db) {
      const err = new Error('Database not ready');
      if (cb) cb.call(null, err);
      return;
    }
    try {
      const stmt = db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();

      // احفظ بعد كل عملية كتابة
      scheduleSave();

      // احصل على آخر ID
      let lastID = 0;
      try {
        const idResult = db.exec('SELECT last_insert_rowid() as id');
        if (idResult && idResult[0] && idResult[0].values && idResult[0].values[0]) {
          lastID = idResult[0].values[0][0];
        }
      } catch (e) {}

      const ctx = { 
        lastID: lastID, 
        changes: db.getRowsModified() 
      };
      if (cb) cb.call(ctx, null);
      return ctx;
    } catch (e) {
      if (cb) cb.call(null, e);
      else throw e;
    }
  },
  
  save: saveDB,
  raw: db
};

// شغّل التهيئة
initDB();

module.exports = wrapper;
