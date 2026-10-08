const crypto = require('crypto');

module.exports = (app, db) => {

  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  function generateToken() {
    return crypto.randomBytes(48).toString('hex');
  }

  // API لتوليد التوكن
  app.get('/api/csrf-token', (req, res) => {
    try {
      const token = generateToken();
      const ip = getIP(req);
      const sessionId = (req.session && req.session.id) || 'no-session';
      
      db.run(
        `INSERT INTO csrf_tokens (token, session_id, ip) VALUES (?, ?, ?)`,
        [token, sessionId, ip],
        (err) => {
          if (err) {
            console.error('[CSRF] DB Error:', err.message);
            return res.json({ ok: false, error: 'DB Error' });
          }
          
          res.cookie('studyhub_csrf', token, {
            httpOnly: false,
            sameSite: 'lax',
            secure: false,
            path: '/',
            maxAge: 24 * 60 * 60 * 1000
          });
          
          res.json({ ok: true, token });
        }
      );
      
      // تنظيف التوكنات القديمة
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
        .toISOString().replace('T', ' ').substring(0, 19);
      db.run(`DELETE FROM csrf_tokens WHERE created_at < ?`, [oneHourAgo]);
      
    } catch (e) {
      console.error('[CSRF ERROR]', e.message);
      res.json({ ok: false, error: e.message });
    }
  });

  // فحص التوكن
  function isValidToken(req, callback) {
    const token = (req.headers && req.headers['x-csrf-token']) ||
                  (req.body && req.body._csrf);
    
    if (!token) {
      console.log('[CSRF] لا يوجد token');
      return callback(false);
    }
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      .toISOString().replace('T', ' ').substring(0, 19);
    
    db.get(
      `SELECT * FROM csrf_tokens WHERE token = ? AND created_at >= ?`,
      [token, oneHourAgo],
      (err, row) => {
        if (err) {
          console.log('[CSRF] DB Error:', err.message);
          return callback(false);
        }
        callback(!!row);
      }
    );
  }

  // ============================================
  // المسارات المُستثناة من الحماية
  // ============================================
  const SKIP_PATHS = [
    '/api/csrf-token',
    '/api/welcome/check',
    '/api/welcome/seen',
    '/api/notifications'
  ];

  // تطبيق الحماية
  app.use('/api/', (req, res, next) => {
    // تجاهل المسارات المُستثناة
    if (SKIP_PATHS.some(p => req.path.startsWith(p))) {
      return next();
    }

    // تحقق فقط من POST/PUT/DELETE
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return isValidToken(req, (valid) => {
        if (!valid) {
          console.log('[CSRF PROTECTION] فشل - المسار:', req.path);
          return res.status(403).json({ 
            ok: false, 
            error: 'طلب غير صالح (CSRF)' 
          });
        }
        next();
      });
    }
    
    next();
  });

  console.log('✅ CSRF module loaded (DB-based)');
};
