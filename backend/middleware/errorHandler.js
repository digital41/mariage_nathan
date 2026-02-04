// Gestionnaire d'erreurs centralisé

// Classe d'erreur personnalisée
class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Erreurs prédéfinies
const errors = {
  notFound: (resource = 'Ressource') => new AppError(`${resource} non trouvé(e)`, 404),
  unauthorized: () => new AppError('Non autorisé', 401),
  forbidden: () => new AppError('Accès interdit', 403),
  badRequest: (message = 'Requête invalide') => new AppError(message, 400),
  conflict: (message = 'Conflit') => new AppError(message, 409),
  serverError: (message = 'Erreur serveur') => new AppError(message, 500)
};

// Middleware de gestion des erreurs
const errorHandler = (err, req, res, next) => {
  // Log en développement
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      statusCode: err.statusCode
    });
  }

  // Erreurs opérationnelles (attendues)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details
    });
  }

  // Erreurs de base de données SQLite
  if (err.code === 'SQLITE_CONSTRAINT') {
    if (err.message.includes('UNIQUE constraint failed: guests.email')) {
      return res.status(409).json({
        success: false,
        error: 'Cet email existe déjà'
      });
    }
    if (err.message.includes('UNIQUE constraint failed: guests.token')) {
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la création, veuillez réessayer'
      });
    }
  }

  // Erreurs inattendues
  console.error('Unexpected error:', err);

  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production'
      ? 'Une erreur est survenue'
      : err.message
  });
};

// Wrapper pour les fonctions async
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware pour les routes non trouvées
const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route non trouvée'
  });
};

module.exports = {
  AppError,
  errors,
  errorHandler,
  asyncHandler,
  notFoundHandler
};
