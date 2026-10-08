module.exports = (app, db) => {

  function getIP(req) {
    return (
      req.headers['x-forwarded-for']?.split(',')[0].trim() ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      'unknown'
    );
  }

  // فحص إذا كان IP جديد
  app.get('/api/welcome/check', (req, res) => {
    const ip = getIP(req);
    db.get(`SELECT * FROM welcome_seen WHERE ip = ?`, [ip], (err, row) => {
      res.json({ ok: true, isNew: !row });
    });
  });

  // تسجيل أن IP رأى الترحيب
  app.post('/api/welcome/seen', (req, res) => {
    const ip = getIP(req);
    db.run(
      `INSERT OR IGNORE INTO welcome_seen (ip) VALUES (?)`,
      [ip],
      () => res.json({ ok: true })
    );
  });
};
