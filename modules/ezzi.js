module.exports = (app, db) => {
  const EZZI_CODE = process.env.EZZI_CODE || 'Ezzi2026';

  function requireEzzi(req, res, next) {
    if (req.session && req.session.isEzzi === true) return next();
    res.status(401).json({ ok: false, error: 'غير مصرح' });
  }

  // ====== الدخول ======
  app.post('/api/ezzi/login', (req, res) => {
    const { code } = req.body;
    if (!code || code !== EZZI_CODE) {
      return res.json({ ok: false, error: 'رمز خاطئ' });
    }
    req.session.isEzzi = true;
    res.json({ ok: true });
  });

  app.post('/api/ezzi/logout', (req, res) => {
    req.session.isEzzi = false;
    res.json({ ok: true });
  });

  app.get('/api/ezzi/check', (req, res) => {
    res.json({ ok: req.session && req.session.isEzzi === true });
  });

  // ====== الإحصائيات ======
  app.get('/api/ezzi/stats', requireEzzi, (req, res) => {
    db.get(`SELECT COUNT(*) AS total FROM users`, (e1, r1) => {
      db.get(`SELECT COUNT(*) AS total FROM posts`, (e2, r2) => {
        db.get(`SELECT COUNT(*) AS total FROM banned_users`, (e3, r3) => {
          db.get(`SELECT COUNT(*) AS total FROM banned_ips`, (e4, r4) => {
            db.get(`SELECT SUM(downloads) AS total FROM posts`, (e5, r5) => {
              res.json({
                ok: true,
                stats: {
                  users: r1 ? r1.total : 0,
                  posts: r2 ? r2.total : 0,
                  banned_users: r3 ? r3.total : 0,
                  banned_ips: r4 ? r4.total : 0,
                  downloads: (r5 && r5.total) || 0
                }
              });
            });
          });
        });
      });
    });
  });

  // ====== المستخدمون ======
  app.get('/api/ezzi/users', requireEzzi, (req, res) => {
    db.all(
      `SELECT u.id, u.username, u.full_name, u.last_ip, u.created_at,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS posts_count,
        (SELECT COUNT(*) FROM banned_users WHERE user_id = u.id) AS is_banned
       FROM users u
       ORDER BY u.id DESC`,
      (err, rows) => res.json({ ok: true, users: rows || [] })
    );
  });

  // ====== المنشورات ======
  app.get('/api/ezzi/posts', requireEzzi, (req, res) => {
    db.all(
      `SELECT p.*, u.username, u.full_name
       FROM posts p
       LEFT JOIN users u ON u.id = p.user_id
       ORDER BY p.id DESC LIMIT 200`,
      (err, rows) => res.json({ ok: true, posts: rows || [] })
    );
  });

  // ====== المحظورون (مستخدمون) ======
  app.get('/api/ezzi/banned-users', requireEzzi, (req, res) => {
    db.all(
      `SELECT * FROM banned_users ORDER BY id DESC`,
      (err, rows) => res.json({ ok: true, banned: rows || [] })
    );
  });

  // ====== المحظورون (IPs) ======
  app.get('/api/ezzi/banned-ips', requireEzzi, (req, res) => {
    db.all(
      `SELECT * FROM banned_ips ORDER BY id DESC`,
      (err, rows) => res.json({ ok: true, banned: rows || [] })
    );
  });

  // ====== حظر مستخدم + IP ======
  app.post('/api/ezzi/ban-user', requireEzzi, (req, res) => {
    const { userId, reason } = req.body;
    if (!userId) return res.json({ ok: false, error: 'معرّف المستخدم مطلوب' });

    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
      if (!user) return res.json({ ok: false, error: 'المستخدم غير موجود' });

      const banReason = reason || 'مخالفة القوانين';

      db.run(
        `INSERT OR IGNORE INTO banned_users (user_id, username, reason) VALUES (?, ?, ?)`,
        [user.id, user.username, banReason],
        () => {
          db.run(
            `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)`,
            [user.id, `تم حظرك من STUDY HUB. السبب: ${banReason}`, 'ban']
          );

          if (user.last_ip && user.last_ip !== 'unknown') {
            db.run(
              `INSERT OR IGNORE INTO banned_ips (ip, reason) VALUES (?, ?)`,
              [user.last_ip, banReason],
              () => res.json({ ok: true, banned_ip: user.last_ip })
            );
          } else {
            res.json({ ok: true, banned_ip: null });
          }
        }
      );
    });
  });

  // ====== حظر IP مباشرة ======
  app.post('/api/ezzi/ban-ip', requireEzzi, (req, res) => {
    const { ip, reason } = req.body;
    if (!ip) return res.json({ ok: false, error: 'IP مطلوب' });

    db.run(
      `INSERT OR IGNORE INTO banned_ips (ip, reason) VALUES (?, ?)`,
      [ip, reason || 'مخالفة القوانين'],
      function () {
        db.run(
          `INSERT INTO notifications (ip, message, type) 
           SELECT DISTINCT last_ip, 'تم حظر عنوان IP الخاص بك من STUDY HUB.', 'ban'
           FROM users WHERE last_ip = ?`,
          [ip]
        );
        res.json({ ok: true });
      }
    );
  });

  // ====== نزع الحظر عن مستخدم (يحذف IP المرتبط أيضاً) ======
  app.delete('/api/ezzi/unban-user/:id', requireEzzi, (req, res) => {
    const id = Number(req.params.id);
    db.get(`SELECT * FROM banned_users WHERE id = ?`, [id], (err, banned) => {
      if (!banned) return res.json({ ok: false, error: 'غير موجود' });

      db.run(`DELETE FROM banned_users WHERE id = ?`, [id], () => {
        db.get(`SELECT last_ip FROM users WHERE id = ?`, [banned.user_id], (e, user) => {
          if (user && user.last_ip) {
            db.run(`DELETE FROM banned_ips WHERE ip = ?`, [user.last_ip], () => {
              res.json({ ok: true, deleted_ip: user.last_ip });
            });
          } else {
            res.json({ ok: true });
          }
        });
      });
    });
  });

  // ====== نزع الحظر عن IP ======
  app.delete('/api/ezzi/unban-ip/:id', requireEzzi, (req, res) => {
    const id = Number(req.params.id);
    db.run(`DELETE FROM banned_ips WHERE id = ?`, [id], function () {
      res.json({ ok: true, deleted: this.changes });
    });
  });

  // ====== حذف مستخدم ======
  app.delete('/api/ezzi/users/:id', requireEzzi, (req, res) => {
    const id = Number(req.params.id);
    db.run(`DELETE FROM posts WHERE user_id = ?`, [id], () => {
      db.run(`DELETE FROM likes WHERE user_id = ?`, [id], () => {
        db.run(`DELETE FROM banned_users WHERE user_id = ?`, [id], () => {
          db.run(`DELETE FROM notifications WHERE user_id = ?`, [id], () => {
            db.run(`DELETE FROM users WHERE id = ?`, [id], function () {
              res.json({ ok: true, deleted: this.changes });
            });
          });
        });
      });
    });
  });

  // ====== حذف منشور ======
  app.delete('/api/ezzi/posts/:id', requireEzzi, (req, res) => {
    const id = Number(req.params.id);
    db.run(`DELETE FROM posts WHERE id = ?`, [id], function () {
      res.json({ ok: true, deleted: this.changes });
    });
  });

  // ============================================
  // التنبيهات (admin_alerts)
  // ============================================
  app.get('/api/ezzi/alerts', requireEzzi, (req, res) => {
    db.all(
      `SELECT * FROM admin_alerts ORDER BY id DESC LIMIT 100`,
      (err, rows) => res.json({ ok: true, alerts: rows || [] })
    );
  });

  app.get('/api/ezzi/alerts/unread-count', requireEzzi, (req, res) => {
    db.get(
      `SELECT COUNT(*) AS total FROM admin_alerts WHERE is_read = 0`,
      (err, row) => res.json({ ok: true, count: row ? row.total : 0 })
    );
  });

  app.post('/api/ezzi/alerts/:id/read', requireEzzi, (req, res) => {
    db.run(
      `UPDATE admin_alerts SET is_read = 1 WHERE id = ?`,
      [req.params.id],
      () => res.json({ ok: true })
    );
  });

  app.post('/api/ezzi/alerts/read-all', requireEzzi, (req, res) => {
    db.run(`UPDATE admin_alerts SET is_read = 1`, () => {
      res.json({ ok: true });
    });
  });

  app.delete('/api/ezzi/alerts/:id', requireEzzi, (req, res) => {
    db.run(`DELETE FROM admin_alerts WHERE id = ?`, [req.params.id], function () {
      res.json({ ok: true, deleted: this.changes });
    });
  });

  app.delete('/api/ezzi/alerts', requireEzzi, (req, res) => {
    db.run(`DELETE FROM admin_alerts`, function () {
      res.json({ ok: true, deleted: this.changes });
    });
  });
};
