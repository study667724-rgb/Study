require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');

const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.set('etag', false);

// ============================================
// Parsers
// ============================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// الجلسة
// ============================================
app.use(session({
  name: 'studyhub_sid',
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: true,
  rolling: true,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    path: '/'
  }
}));

// ============================================
// الملفات الثابتة
// ============================================
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',
  index: false
}));

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny',
  index: false,
  redirect: false,
  fallthrough: false,
  setHeaders: (res, filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf'
    };
    if (types[ext]) {
      res.setHeader('Content-Type', types[ext]);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// ============================================
// 🔥 الحماية - الترتيب مهم جداً!
// 1. security (Helmet + XSS) - عام
// 2. bruteforce (Hydra + Rate Limit) - قبل CSRF
// 3. csrf (Token) - الأخير
// ============================================
console.log('📦 Loading: security');
require('./modules/security')(app, db);

console.log('📦 Loading: bruteforce');
require('./modules/bruteforce')(app, db);

console.log('📦 Loading: csrf');
require('./modules/csrf')(app, db);

// ============================================
// الوحدات التجارية
// ============================================
const modules = ['ban', 'welcome', 'auth', 'upload', 'posts', 'ezzi'];
modules.forEach(m => require(`./modules/${m}`)(app, db));

// ============================================
// الصفحات
// ============================================
app.get('/', (req, res) => {
  if (req.session.userId) return res.redirect('/app');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/app', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'app.html'));
});

app.get('/ezzi', (req, res) => {
  if (req.session && req.session.isEzzi) return res.redirect('/ezzi-panel');
  res.sendFile(path.join(__dirname, 'public', 'ezzi.html'));
});

app.get('/ezzi-panel', (req, res) => {
  if (!req.session || !req.session.isEzzi) return res.redirect('/ezzi');
  res.sendFile(path.join(__dirname, 'public', 'ezzi-panel.html'));
});

app.use((req, res) => {
  res.status(404).send('404 Not Found');
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf')) {
    return res.status(403).json({ ok: false, error: 'طلب غير صالح (CSRF)' });
  }
  res.status(500).json({ ok: false, error: 'Server error' });
});

// ============================================
// التشغيل
// ============================================
const G = '\x1b[32m', C = '\x1b[36m', Y = '\x1b[33m', M = '\x1b[35m';
const B = '\x1b[1m', X = '\x1b[0m';

app.listen(PORT, '0.0.0.0', () => {
  console.clear();
  console.log('');
  console.log(`${M}${B}  ███████╗████████╗██╗   ██╗██████╗ ██╗   ██╗${X}`);
  console.log(`${M}${B}  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗╚██╗ ██╔╝${X}`);
  console.log(`${M}${B}  ███████╗   ██║   ██║   ██║██║  ██║ ╚████╔╝ ${X}`);
  console.log(`${M}${B}  ╚════██║   ██║   ██║   ██║██║  ██║  ╚██╔╝  ${X}`);
  console.log(`${M}${B}  ███████║   ██║   ╚██████╔╝██████╔╝   ██║   ${X}`);
  console.log(`${M}${B}  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝    ╚═╝   ${X}`);
  console.log('');
  console.log(`${C}${B}              H U B   v2.0 🚀${X}`);
  console.log('');
  console.log(`${G}  ✅ الموقع:        http://localhost:${PORT}${X}`);
  console.log(`${Y}  🔐 لوحة ezzi:     http://localhost:${PORT}/ezzi${X}`);
  console.log(`${C}  🛡️  الترتيب:      Security → Bruteforce → CSRF${X}`);
  console.log('');
});
