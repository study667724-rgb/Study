module.exports = (app, db) => {

  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  function getUserAgent(req) {
    return (req.headers['user-agent'] || '').substring(0, 200);
  }

  // ====== تسجيل جديد ======
  app.post('/api/register', (req, res) => {
    const { username, password, full_name } = req.body;
    const ip = getIP(req);
    if (!username || !password) {
      return res.json({ ok: false, error: 'املأ جميع الحقول' });
    }
    db.run(
      `INSERT INTO users (username, password, full_name, last_ip) VALUES (?, ?, ?, ?)`,
      [username, password, full_name || username, ip],
      function (err) {
        if (err) return res.json({ ok: false, error: 'اسم المستخدم موجود' });
        req.session.userId = this.lastID;
        req.session.username = username;
        req.session.fullName = full_name || username;
        res.json({ ok: true, username });
      }
    );
  });

  // ====== تسجيل دخول ======
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const ip = getIP(req);
    const ua = getUserAgent(req);

    // فحص الحظر أولاً
    db.get(
      `SELECT * FROM banned_users WHERE username = ?`,
      [username],
      (err, banned) => {
        if (banned) {
          db.run(
            `INSERT INTO login_attempts (ip, username, user_agent, success) VALUES (?, ?, ?, 0)`,
            [ip, username, ua]
          );
          return res.json({
            ok: false,
            error: 'أنت محظور',
            banned: true,
            reason: banned.reason || 'غير محدد'
          });
        }

        // البحث عن المستخدم
        db.get(
          `SELECT * FROM users WHERE username = ? AND password = ?`,
          [username, password],
          (err, user) => {
            // سجّل المحاولة
            db.run(
              `INSERT INTO login_attempts (ip, username, user_agent, success) VALUES (?, ?, ?, ?)`,
              [ip, username, ua, user ? 1 : 0]
            );

            if (!user) {
              return res.json({ ok: false, error: 'بيانات خاطئة' });
            }

            // نجح الدخول
            db.run(`UPDATE users SET last_ip = ? WHERE id = ?`, [ip, user.id]);
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.fullName = user.full_name || user.username;
            res.json({ ok: true, username: user.username });
          }
        );
      }
    );
  });

  // ====== خروج ======
  app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  // ====== من أنا؟ ======
  app.get('/api/me', (req, res) => {
    if (req.session.userId) {
      return res.json({
        ok: true,
        id: req.session.userId,
        username: req.session.username,
        fullName: req.session.fullName
      });
    }
    res.json({ ok: false });
  });
};
