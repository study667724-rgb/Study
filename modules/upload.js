const multer = require('multer');
const path = require('path');

// ============================================
// حدود الرفع (Rate Limiting)
// ============================================
const LIMITS = {
  perMinute: 3,
  perHour: 20,
  perDay: 50
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /image\/(jpeg|png|gif|webp)|application\/pdf/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('يُسمح بالصور و PDF فقط'));
  }
});

module.exports = (app, db) => {

  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  // ============================================
  // تسجيل تنبيه للمشرف
  // ============================================
  function logAlert(userId, limitType, stats, limits) {
    db.get(`SELECT username, last_ip FROM users WHERE id = ?`, [userId], (err, user) => {
      if (err || !user) return;

      const typeNames = {
        'minute': 'تجاوز الحد في الدقيقة',
        'hour': 'تجاوز الحد في الساعة',
        'day': 'تجاوز الحد اليومي'
      };

      const typeEmoji = {
        'minute': '⚡',
        'hour': '🔥',
        'day': '🚨'
      };

      const message = `${typeEmoji[limitType]} ${user.username} تجاوز حد الرفع (${typeNames[limitType]})`;
      const details = JSON.stringify({
        stats: {
          per_minute: stats.per_minute,
          per_hour: stats.per_hour,
          per_day: stats.per_day
        },
        limits: limits,
        limitType: limitType
      });

      // تجنب التكرار خلال 5 دقائق
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
      db.get(
        `SELECT id FROM admin_alerts 
         WHERE user_id = ? AND alert_type = ? AND created_at >= ? 
         LIMIT 1`,
        [userId, limitType, fiveMinAgo],
        (e, existing) => {
          if (existing) return;

          db.run(
            `INSERT INTO admin_alerts (user_id, username, ip, alert_type, message, details) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, user.username, user.last_ip || 'unknown', limitType, message, details]
          );
        }
      );
    });
  }

  // ============================================
  // فحص حدود السبام
  // ============================================
  function checkRateLimit(userId, callback) {
    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    db.get(
      `SELECT 
        (SELECT COUNT(*) FROM uploads_log WHERE user_id = ? AND created_at >= ?) AS per_minute,
        (SELECT COUNT(*) FROM uploads_log WHERE user_id = ? AND created_at >= ?) AS per_hour,
        (SELECT COUNT(*) FROM uploads_log WHERE user_id = ? AND created_at >= ?) AS per_day`,
      [userId, oneMinAgo, userId, oneHourAgo, userId, oneDayAgo],
      (err, row) => {
        if (err) return callback({ ok: false, error: 'خطأ في الفحص' });

        if (row.per_minute >= LIMITS.perMinute) {
          logAlert(userId, 'minute', row, LIMITS);
          return callback({
            ok: false,
            error: `لقد وصلت إلى الحد الأقصى (${LIMITS.perMinute} صور/دقيقة). انتظر قليلاً.`,
            retryAfter: 60,
            limit: 'minute'
          });
        }
        if (row.per_hour >= LIMITS.perHour) {
          logAlert(userId, 'hour', row, LIMITS);
          return callback({
            ok: false,
            error: `لقد وصلت إلى الحد الأقصى (${LIMITS.perHour} صورة/ساعة). حاول لاحقاً.`,
            retryAfter: 3600,
            limit: 'hour'
          });
        }
        if (row.per_day >= LIMITS.perDay) {
          logAlert(userId, 'day', row, LIMITS);
          return callback({
            ok: false,
            error: `لقد وصلت إلى الحد الأقصى اليومي (${LIMITS.perDay} صورة). حاول غداً.`,
            retryAfter: 86400,
            limit: 'day'
          });
        }

        callback({ ok: true, stats: row });
      }
    );
  }

  // ============================================
  // API: حالة الرفع
  // ============================================
  app.get('/api/upload/status', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });

    const now = new Date();
    const oneMinAgo = new Date(now.getTime() - 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);

    db.get(
      `SELECT 
        (SELECT COUNT(*) FROM uploads_log WHERE user_id = ? AND created_at >= ?) AS per_minute,
        (SELECT COUNT(*) FROM uploads_log WHERE user_id = ? AND created_at >= ?) AS per_hour,
        (SELECT COUNT(*) FROM uploads_log WHERE user_id = ? AND created_at >= ?) AS per_day`,
      [req.session.userId, oneMinAgo, req.session.userId, oneHourAgo, req.session.userId, oneDayAgo],
      (err, row) => {
        res.json({
          ok: true,
          limits: LIMITS,
          used: row || { per_minute: 0, per_hour: 0, per_day: 0 },
          remaining: {
            per_minute: Math.max(0, LIMITS.perMinute - (row ? row.per_minute : 0)),
            per_hour: Math.max(0, LIMITS.perHour - (row ? row.per_hour : 0)),
            per_day: Math.max(0, LIMITS.perDay - (row ? row.per_day : 0))
          }
        });
      }
    );
  });

  // ============================================
  // API: الرفع
  // ============================================
  app.post('/api/upload', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });

    checkRateLimit(req.session.userId, (result) => {
      if (!result.ok) {
        return res.status(429).json({
          ok: false,
          error: result.error,
          retryAfter: result.retryAfter,
          limit: result.limit
        });
      }

      upload.single('image')(req, res, (err) => {
        if (err) return res.json({ ok: false, error: err.message });
        if (!req.file) return res.json({ ok: false, error: 'لم يتم اختيار ملف' });

        db.run(
          `INSERT INTO uploads_log (user_id, ip) VALUES (?, ?)`,
          [req.session.userId, getIP(req)],
          () => {
            res.json({ ok: true, path: '/uploads/' + req.file.filename });
          }
        );
      });
    });
  });
};
