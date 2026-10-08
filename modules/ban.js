module.exports = (app, db) => {

  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  // ====== Middleware: منع الدخول للمحظورين ======
  app.use((req, res, next) => {
    const skip = [
      '/ezzi',
      '/api/ezzi',
      '/banned',
      '/style.css',
      '/ezzi.css'
    ];
    if (skip.some(p => req.path.startsWith(p))) return next();

    const ip = getIP(req);

    db.get(`SELECT * FROM banned_ips WHERE ip = ?`, [ip], (err, row) => {
      if (row) {
        return res.status(403).send(`
          <!DOCTYPE html>
          <html lang="ar" dir="rtl">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>محظور · STUDY HUB</title>
            <link rel="stylesheet" href="/style.css">
          </head>
          <body style="display:flex;align-items:center;justify-content:center;min-height:100dvh;padding:20px;">
            <div style="max-width:480px;padding:40px 32px;background:rgba(30,41,59,0.7);backdrop-filter:blur(24px);border:1px solid rgba(236,72,153,0.3);border-radius:24px;text-align:center;">
              <div style="font-size:80px;margin-bottom:16px;">🚫</div>
              <h1 style="font-size:28px;font-weight:800;background:linear-gradient(135deg,#EC4899,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:12px;">أنت محظور</h1>
              <p style="color:#94A3B8;font-size:14px;line-height:1.8;margin-bottom:8px;">تم حظر عنوان IP الخاص بك من الوصول إلى STUDY HUB.</p>
              <p style="color:#64748B;font-size:13px;margin-bottom:20px;">السبب: <strong style="color:#EC4899">${(row.reason || 'غير محدد').replace(/</g, '&lt;')}</strong></p>
              <p style="color:#64748B;font-size:12px;">إذا كنت تعتقد أن هذا خطأ، تواصل مع الإدارة.</p>
            </div>
          </body>
          </html>
        `);
      }
      next();
    });
  });

  // ====== منع تسجيل دخول المستخدمين المحظورين ======
  app.post('/api/login', (req, res, next) => {
    const { username } = req.body;
    if (!username) return next();
    db.get(`SELECT * FROM banned_users WHERE username = ?`, [username], (err, row) => {
      if (row) {
        return res.json({
          ok: false,
          error: 'أنت محظور',
          banned: true,
          reason: row.reason || 'غير محدد'
        });
      }
      next();
    });
  });

  // ====== الإشعارات ======
  app.get('/api/notifications', (req, res) => {
    if (!req.session.userId) return res.json({ ok: true, notifications: [] });
    db.all(
      `SELECT * FROM notifications 
       WHERE user_id = ? AND is_read = 0 
       ORDER BY id DESC LIMIT 10`,
      [req.session.userId],
      (err, rows) => res.json({ ok: true, notifications: rows || [] })
    );
  });

  app.post('/api/notifications/read', (req, res) => {
    if (!req.session.userId) return res.json({ ok: false });
    db.run(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ?`,
      [req.session.userId],
      () => res.json({ ok: true })
    );
  });
};

