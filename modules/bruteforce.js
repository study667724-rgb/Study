// ============================================
// Brute Force Protection (منع Hydra)
// ============================================

const SUSPICIOUS_AGENTS = [
  'hydra', 'hydra/',
  'python-requests', 'python-urllib',
  'go-http-client',
  'nmap', 'nikto', 'sqlmap', 'metasploit',
  'masscan', 'zgrab', 'patator',
  'medusa', 'ncrack'
];

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

  function isSuspiciousAgent(req) {
    const ua = getUserAgent(req).toLowerCase();
    return SUSPICIOUS_AGENTS.some(agent => ua.includes(agent));
  }

  // ============================================
  // الحماية على تسجيل الدخول
  // ============================================
  app.use('/api/login', (req, res, next) => {
    if (req.method !== 'POST') return next();

    const ip = getIP(req);
    const ua = getUserAgent(req);

    // 1. كشف User-Agent مشبوه
    if (isSuspiciousAgent(req)) {
      console.log(`🚨 [BRUTEFORCE] أداة مخترقة من ${ip}: ${ua}`);

      db.run(
        `INSERT INTO admin_alerts (user_id, username, ip, alert_type, message, details) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [null, 'BRUTEFORCE', ip, 'security',
         `🚨 محاولة دخول بأداة Hydra/Brute Force`,
         JSON.stringify({ userAgent: ua })]
      );

      return res.status(403).json({
        ok: false,
        error: 'طلب غير مسموح'
      });
    }

    // 2. فحص عدد المحاولات في آخر 15 دقيقة
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000)
      .toISOString().replace('T', ' ').substring(0, 19);

    db.get(
      `SELECT COUNT(*) AS attempts FROM login_attempts 
       WHERE ip = ? AND success = 0 AND created_at >= ?`,
      [ip, fifteenMinAgo],
      (err, row) => {
        if (err) return next();

        const attempts = row ? row.attempts : 0;

        // تجاوز 5 محاولات → حظر مؤقت
        if (attempts >= 5) {
          console.log(`🚨 [BRUTEFORCE] حظر مؤقت: ${ip} (${attempts} محاولات)`);

          db.run(
            `INSERT INTO admin_alerts (user_id, username, ip, alert_type, message, details) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [null, 'BRUTEFORCE', ip, 'security',
             `🚨 حظر مؤقت: ${attempts} محاولات فاشلة`,
             JSON.stringify({ attempts, action: 'temporary_ban' })]
          );

          return res.status(429).json({
            ok: false,
            error: 'محاولات كثيرة فاشلة. حاول بعد 15 دقيقة.',
            retryAfter: 900
          });
        }

        // فحص محاولات الساعة (للحظر الدائم)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
          .toISOString().replace('T', ' ').substring(0, 19);

        db.get(
          `SELECT COUNT(*) AS attempts FROM login_attempts 
           WHERE ip = ? AND success = 0 AND created_at >= ?`,
          [ip, oneHourAgo],
          (err2, row2) => {
            if (err2) return next();

            const hourAttempts = row2 ? row2.attempts : 0;

            if (hourAttempts >= 20) {
              console.log(`🚨 [BRUTEFORCE] حظر دائم: ${ip} (${hourAttempts} محاولات/ساعة)`);

              db.run(
                `INSERT OR IGNORE INTO banned_ips (ip, reason) VALUES (?, ?)`,
                [ip, `Brute Force: ${hourAttempts} محاولات`]
              );

              db.run(
                `INSERT INTO admin_alerts (user_id, username, ip, alert_type, message, details) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [null, 'BRUTEFORCE', ip, 'security',
                 `🚨 حظر دائم: ${hourAttempts} محاولات/ساعة`,
                 JSON.stringify({ attempts: hourAttempts, action: 'permanent_ban' })]
              );

              return res.status(403).json({
                ok: false,
                error: 'تم حظر IP نهائياً'
              });
            }

            // 3. تأخير متزايد
            let delay = 0;
            if (attempts >= 3) delay = 2000;
            else if (attempts >= 2) delay = 1000;
            else if (attempts >= 1) delay = 500;

            if (delay > 0) {
              console.log(`⏱️ [BRUTEFORCE] تأخير ${delay}ms لـ ${ip}`);
              return setTimeout(() => next(), delay);
            }

            next();
          }
        );
      }
    );
  });

  // ============================================
  // API: عرض المحاولات (للمشرف)
  // ============================================
  app.get('/api/ezzi/bruteforce', (req, res) => {
    if (!req.session || !req.session.isEzzi) {
      return res.status(401).json({ ok: false });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      .toISOString().replace('T', ' ').substring(0, 19);

    db.all(
      `SELECT ip, username, user_agent, COUNT(*) AS attempts, 
              MAX(created_at) AS last_attempt
       FROM login_attempts 
       WHERE success = 0 AND created_at >= ?
       GROUP BY ip 
       ORDER BY attempts DESC 
       LIMIT 50`,
      [oneHourAgo],
      (err, rows) => res.json({ ok: true, attempts: rows || [] })
    );
  });

  // ============================================
  // تنظيف المحاولات القديمة (كل ساعة)
  // ============================================
  setInterval(() => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString().replace('T', ' ').substring(0, 19);

    db.run(`DELETE FROM login_attempts WHERE created_at < ?`, [oneDayAgo], (err) => {
      if (!err) console.log('🧹 [BRUTEFORCE] تم تنظيف المحاولات القديمة');
    });
  }, 60 * 60 * 1000);

  console.log('✅ Brute-force protection loaded (anti-Hydra)');
};
