module.exports = (app, db) => {

  app.post('/api/posts', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    const { grade, branch, subject, title, description, image_path } = req.body;
    if (!grade || !subject || !title || !image_path) {
      return res.json({ ok: false, error: 'املأ الحقول المطلوبة' });
    }
    db.run(
      `INSERT INTO posts (user_id, grade, branch, subject, title, description, image_path)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.session.userId, grade, branch || null, subject, title, description || '', image_path],
      function (err) {
        if (err) return res.json({ ok: false, error: 'فشل النشر' });
        res.json({ ok: true, id: this.lastID });
      }
    );
  });

  app.get('/api/posts', (req, res) => {
    const { grade, branch, subject, search } = req.query;
    let sql = `SELECT p.*, u.username, u.full_name
               FROM posts p
               JOIN users u ON u.id = p.user_id
               WHERE 1=1`;
    const params = [];
    if (grade) { sql += ` AND p.grade = ?`; params.push(grade); }
    if (branch) { sql += ` AND p.branch = ?`; params.push(branch); }
    if (subject) { sql += ` AND p.subject = ?`; params.push(subject); }
    if (search) {
      sql += ` AND (p.title LIKE ? OR p.description LIKE ?)`;
      params.push('%' + search + '%', '%' + search + '%');
    }
    sql += ` ORDER BY p.id DESC LIMIT 100`;

    db.all(sql, params, (err, rows) => {
      res.json({ ok: true, posts: rows || [] });
    });
  });

  app.get('/api/posts/:id', (req, res) => {
    db.get(
      `SELECT p.*, u.username, u.full_name
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`,
      [req.params.id],
      (err, row) => res.json({ ok: true, post: row })
    );
  });

  app.delete('/api/posts/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    db.run(
      `DELETE FROM posts WHERE id = ? AND user_id = ?`,
      [req.params.id, req.session.userId],
      function () {
        res.json({ ok: true, deleted: this.changes });
      }
    );
  });

  app.post('/api/posts/:id/like', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ ok: false });
    const postId = Number(req.params.id);
    const userId = req.session.userId;

    db.get(`SELECT * FROM likes WHERE user_id = ? AND post_id = ?`, [userId, postId], (err, row) => {
      if (row) {
        db.run(`DELETE FROM likes WHERE user_id = ? AND post_id = ?`, [userId, postId], () => {
          db.run(`UPDATE posts SET likes = MAX(0, likes - 1) WHERE id = ?`, [postId], () => {
            db.get(`SELECT likes FROM posts WHERE id = ?`, [postId], (e, r) => {
              res.json({ ok: true, liked: false, likes: r ? r.likes : 0 });
            });
          });
        });
      } else {
        db.run(`INSERT INTO likes (user_id, post_id) VALUES (?, ?)`, [userId, postId], () => {
          db.run(`UPDATE posts SET likes = likes + 1 WHERE id = ?`, [postId], () => {
            db.get(`SELECT likes FROM posts WHERE id = ?`, [postId], (e, r) => {
              res.json({ ok: true, liked: true, likes: r ? r.likes : 0 });
            });
          });
        });
      }
    });
  });

  app.post('/api/posts/:id/download', (req, res) => {
    db.run(`UPDATE posts SET downloads = downloads + 1 WHERE id = ?`, [req.params.id], () => {
      res.json({ ok: true });
    });
  });

  app.get('/api/stats', (req, res) => {
    db.get(`SELECT COUNT(*) AS users FROM users`, (e1, u) => {
      db.get(`SELECT COUNT(*) AS posts FROM posts`, (e2, p) => {
        db.get(`SELECT SUM(downloads) AS downloads FROM posts`, (e3, d) => {
          res.json({
            ok: true,
            stats: {
              users: u ? u.users : 0,
              posts: p ? p.posts : 0,
              downloads: (d && d.downloads) || 0
            }
          });
        });
      });
    });
  });
};
