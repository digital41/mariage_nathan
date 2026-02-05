const crypto = require('crypto');

// Hash le mot de passe avec SHA256 (simple mais efficace pour ce cas)
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Middleware d'authentification admin
const checkAuth = (req, res, next) => {
  const password = req.headers['x-admin-password'] || req.headers.password;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!password) {
    return res.status(401).json({
      success: false,
      error: 'Authentification requise'
    });
  }

  if (password !== adminPassword) {
    return res.status(401).json({
      success: false,
      error: 'Mot de passe incorrect'
    });
  }

  next();
};

// Rate limiting simple en mémoire
// Chaque appel à rateLimit() crée sa propre Map isolée
const rateLimit = (options = {}) => {
  const {
    windowMs = 60 * 1000,  // 1 minute par défaut
    max = 100,              // 100 requêtes max par fenêtre
    message = 'Trop de requêtes, veuillez réessayer plus tard'
  } = options;

  // Store isolé par instance de rate limiter
  const store = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Nettoyer les anciennes entrées
    for (const [key, data] of store.entries()) {
      if (now - data.startTime > windowMs) {
        store.delete(key);
      }
    }

    const clientData = store.get(ip);

    if (!clientData) {
      store.set(ip, { count: 1, startTime: now });
      return next();
    }

    if (now - clientData.startTime > windowMs) {
      store.set(ip, { count: 1, startTime: now });
      return next();
    }

    clientData.count++;

    if (clientData.count > max) {
      return res.status(429).json({
        success: false,
        error: message
      });
    }

    next();
  };
};

// Rate limiting spécifique pour les emails (plus restrictif)
const emailRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,               // 10 emails max par minute
  message: 'Trop d\'emails envoyés, veuillez patienter'
});

// Rate limiting pour le login
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                      // 5 tentatives max
  message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes'
});

module.exports = {
  checkAuth,
  hashPassword,
  rateLimit,
  emailRateLimit,
  loginRateLimit
};
