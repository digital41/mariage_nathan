// Validation et sanitization des entrées

// Échappe les caractères HTML pour prévenir XSS
const escapeHtml = (str) => {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Valide un email
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Valide un numéro de téléphone (format français)
const isValidPhone = (phone) => {
  if (!phone) return true; // Phone is optional
  const phoneRegex = /^(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

// Nettoie une chaîne de caractères
const sanitizeString = (str, maxLength = 255) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
};

// Valide les données d'un invité
const validateGuest = (data) => {
  const errors = [];

  if (!data.first_name || data.first_name.trim().length < 2) {
    errors.push('Le prénom doit contenir au moins 2 caractères');
  }

  if (!data.last_name || data.last_name.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  }

  if (data.email && !isValidEmail(data.email)) {
    errors.push('Email invalide');
  }

  const validFamilies = ['Ibgui', 'Chemaoun'];
  if (data.family && !validFamilies.includes(data.family)) {
    errors.push('Famille invalide (Ibgui ou Chemaoun)');
  }

  const validCountries = ['France', 'Etranger'];
  if (data.country && !validCountries.includes(data.country)) {
    errors.push('Pays invalide (France ou Etranger)');
  }

  if (data.phone && !isValidPhone(data.phone)) {
    errors.push('Numéro de téléphone invalide');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      first_name: sanitizeString(data.first_name, 100),
      last_name: sanitizeString(data.last_name, 100),
      email: data.email ? sanitizeString(data.email, 255).toLowerCase() : null,
      phone: sanitizeString(data.phone, 20),
      family: sanitizeString(data.family, 100) || '',
      country: data.country || 'France',
      invited_to_mairie: Boolean(data.invited_to_mairie),
      invited_to_vin_honneur: Boolean(data.invited_to_vin_honneur),
      invited_to_chabbat: Boolean(data.invited_to_chabbat),
      invited_to_houppa: Boolean(data.invited_to_houppa)
    }
  };
};

// Valide les données d'une réponse publique
const validatePublicResponse = (data) => {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push('Le nom doit contenir au moins 2 caractères');
  }

  const guests = parseInt(data.guests) || 1;
  if (guests < 1 || guests > 20) {
    errors.push('Le nombre de personnes doit être entre 1 et 20');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: sanitizeString(data.name, 200),
      guests: Math.min(Math.max(guests, 1), 20),
      mairie: Boolean(data.events?.mairie?.attend),
      vin_honneur: Boolean(data.events?.vin_honneur?.attend),
      chabbat: Boolean(data.events?.chabbat?.attend),
      houppa: Boolean(data.events?.houppa?.attend),
      message: sanitizeString(data.message, 1000)
    }
  };
};

// Middleware de validation pour les invités
const validateGuestMiddleware = (req, res, next) => {
  const validation = validateGuest(req.body);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Données invalides',
      details: validation.errors
    });
  }

  req.validatedData = validation.sanitized;
  next();
};

// Middleware de validation pour les réponses publiques
const validatePublicResponseMiddleware = (req, res, next) => {
  const validation = validatePublicResponse(req.body);

  if (!validation.isValid) {
    return res.status(400).json({
      success: false,
      error: 'Données invalides',
      details: validation.errors
    });
  }

  req.validatedData = validation.sanitized;
  next();
};

module.exports = {
  escapeHtml,
  isValidEmail,
  isValidPhone,
  sanitizeString,
  validateGuest,
  validatePublicResponse,
  validateGuestMiddleware,
  validatePublicResponseMiddleware
};
