const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// ============================================
// إعداد Cloudinary
// ============================================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

console.log('☁️ Cloudinary configured:', process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '❌');

// ============================================
// إعداد Multer + Cloudinary Storage
// ============================================
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'studyhub',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'],
    resource_type: 'auto'
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /image\/(jpeg|png|gif|webp)|application\/pdf/;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('يُسمح بالصور و PDF فقط'));
  }
});

const LIMITS = { perMinute: 3, perHour: 20, perDay: 50 };

module.exports = (app, db) => {

  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  function logAlert(userId, limitType, stats, limits) {
    db.get(`SELECT username, last_ip FROM users WHERE id = ?`, [userId], (err, user) => {
      if (err || !user) return;

      const typeNames = {
        'minute': 'تجاوز الحد في الدقيقة',
        'hour': 'تجاوز الحد في الساعة',
        'day': 'تجاوز الحد اليومي'
      };
      const typeEmoji = { 'minute': '⚡', 'hour': '🔥', 'day': '🚨' };

      const message = `${typeEmoji[limitType]} ${user.username} تجاوز حد الرفع (${typeNames[limitType]})`;
      const details = JSON.stringify({
        stats: { per_minute: stats.per_minute, per_hour: stats.per_hour, per_day: stats.per_day },
        limits,
        limitType
      });

      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000)
        .toISOString().replace('T', ' ').substring(0, 19);

      db.get(
        `SELECT id FROM admin_alerts WHERE user_id = ? AND alert_type = ? AND created_at >= ? LIMIT 1`,
        [userId, limitType, fiveMinAgo],
        (e, existing) => {
          if (existing) return;
          db.run(
            `INSERT INTO admin_alerts (user_id, username, ip, alert_type, message, details) VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, user.username, user.last_ip || 'unknown', limitType, message, details]
          );
        }
      );
    });
  }

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
          return callback({ ok: false, error: `الحد: ${LIMITS.perMinute} صور/دقيقة`, retryAfter: 60, limit: 'minute' });
        }
        if (row.per_hour >= LIMITS.perHour) {
          logAlert(userId, 'hour', row, LIMITS);
          return callback({ ok: false, error: `الحد: ${LIMITS.perHour} صورة/ساعة`, retryAfter: 3600, limit: 'hour' });
        }
        if (row.per_day >= LIMITS.perDay) {
          logAlert(userId, 'day', row, LIMITS);
          return callback({ ok: false, error: `الحد اليومي: ${LIMITS.perDay} صورة`, retryAfter: 86400, limit: 'day' });
        }

        callback({ ok: true, stats: row });
      }
    );
  }

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

  app.post('/api/upload', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });

    checkRateLimit(req.session.userId, (result) => {
      if (!result.ok) {
        return res.status(429).json({ ok: false, error: result.error, retryAfter: result.retryAfter, limit: result.limit });
      }

      upload.single('image')(req, res, (err) => {
        if (err) {
          console.error('[UPLOAD ERROR]', err.message);
          return res.json({ ok: false, error: err.message });
        }
        if (!req.file) return res.json({ ok: false, error: 'لم يتم اختيار ملف' });

        const filePath = req.file.path || req.file.secure_url;
        console.log('☁️ File uploaded:', filePath);

        db.run(
          `INSERT INTO uploads_log (user_id, ip) VALUES (?, ?)`,
          [req.session.userId, getIP(req)],
          () => {
            res.json({ ok: true, path: filePath, public_id: req.file.filename || req.file.public_id });
          }
        );
      });
    });
  });
};
