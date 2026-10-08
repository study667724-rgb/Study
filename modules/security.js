const helmet = require('helmet');

module.exports = (app, db) => {

  // ============================================
  // 1. رؤوس الأمان (Helmet)
  // ============================================
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    xPoweredBy: false,
    noSniff: true,
    frameguard: { action: 'deny' },
    hsts: process.env.NODE_ENV === 'production' ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    } : false,
    referrerPolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false }
  }));

  // رؤوس إضافية
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.removeHeader('X-Powered-By');
    next();
  });

  // ============================================
  // 2. تعقيم المدخلات (XSS Protection)
  // ============================================
  function sanitizeInput(value) {
    if (typeof value !== 'string') return value;
    
    // لا تعقّم المسارات
    if (value.startsWith('/uploads/') || value.startsWith('/')) {
      return value;
    }
    
    let cleaned = value.replace(/<[^>]*>/g, '');
    
    cleaned = cleaned
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    // تم إزالة سطر &#x2F; لأنه يسبب مشاكل في المسارات
    
    cleaned = cleaned.replace(/javascript:/gi, '');
    cleaned = cleaned.replace(/on\w+\s*=/gi, '');
    cleaned = cleaned.replace(/data:text\/html/gi, '');
    
    return cleaned;
  }

  app.use((req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      const sanitizeObject = (obj) => {
        for (const key in obj) {
          if (typeof obj[key] === 'string') {
            obj[key] = sanitizeInput(obj[key]);
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            sanitizeObject(obj[key]);
          }
        }
      };
      sanitizeObject(req.body);
    }
    next();
  });

  // ============================================
  // 3. كشف المحاولات المشبوهة
  // ============================================
  const SUSPICIOUS_PATTERNS = [
    /<script/i,
    /javascript:/i,
    /onerror\s*=/i,
    /onload\s*=/i,
    /onclick\s*=/i,
    /union.*select/i,
    /drop\s+table/i,
    /insert\s+into/i,
    /\.\.\//,
    /etc\/passwd/i
  ];

  app.use((req, res, next) => {
    // تجاهل الملفات الثابتة والصور
    const skipPaths = ['/uploads', '/style.css', '/themes.css', '/app.js', '/ezzi.js', '/matrix.js'];
    if (skipPaths.some(p => req.path.startsWith(p))) {
      return next();
    }

    const checkValue = (val) => {
      if (typeof val !== 'string') return false;
      return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(val));
    };

    const checkObject = (obj) => {
      if (!obj || typeof obj !== 'object') return false;
      for (const key in obj) {
        if (checkValue(obj[key])) return true;
        if (typeof obj[key] === 'object' && checkObject(obj[key])) return true;
      }
      return false;
    };

    const fullUrl = req.originalUrl || req.url;
    if (checkValue(fullUrl) || checkObject(req.body) || checkObject(req.query)) {
      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                 req.socket?.remoteAddress || 'unknown';
      
      console.log(`🚨 محاولة مشبوهة من ${ip}: ${fullUrl}`);
      
      db.run(
        `INSERT INTO admin_alerts (user_id, username, ip, alert_type, message, details) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          req.session?.userId || null,
          req.session?.username || 'anonymous',
          ip,
          'security',
          `🚨 محاولة اختراق مشبوهة`,
          JSON.stringify({
            url: fullUrl,
            method: req.method,
            body: req.body,
            ua: req.headers['user-agent']
          })
        ]
      );
      
      return res.status(400).json({ ok: false, error: 'طلب غير صالح' });
    }
    next();
  });

  // ============================================
  // 4. حماية من هجمات التخمين
  // ============================================
  const attempts = new Map();

  app.use('/api/', (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() ||
               req.socket?.remoteAddress || 'unknown';
    
    const now = Date.now();
    for (const [key, data] of attempts.entries()) {
      if (now - data.first > 10 * 60 * 1000) {
        attempts.delete(key);
      }
    }

    const key = `${ip}:${req.path}`;
    const data = attempts.get(key) || { count: 0, first: now };
    data.count++;
    attempts.set(key, data);

    if (data.count > 30 && (now - data.first) < 60000) {
      return res.status(429).json({ 
        ok: false, 
        error: 'عدد كبير من الطلبات، انتظر قليلاً' 
      });
    }

    next();
  });

  console.log('✅ Security module loaded');
};
