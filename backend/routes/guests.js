const express = require('express');
const router = express.Router();
const { run, get, all } = require('../utils/database');
const { asyncHandler, errors } = require('../middleware/errorHandler');
const { sanitizeString } = require('../middleware/validation');

// GET /:token - Récupérer un invité par son token unique
router.get('/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Validation du format du token (UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    throw errors.badRequest('Token invalide');
  }

  const guest = await get('SELECT * FROM guests WHERE token = ?', [token]);

  if (!guest) {
    throw errors.notFound('Invité');
  }

  // Récupérer les réponses existantes pour cet invité
  const existingResponses = await all(
    'SELECT event_name, will_attend, plus_one FROM event_responses WHERE guest_id = ?',
    [guest.id]
  );

  // Formater les réponses en objet
  const responses = {};
  existingResponses.forEach(r => {
    responses[r.event_name] = {
      willAttend: Boolean(r.will_attend),
      plusOne: r.plus_one || 0
    };
  });

  res.json({
    success: true,
    data: {
      id: guest.id,
      firstName: guest.first_name,
      lastName: guest.last_name,
      email: guest.email,
      invitedTo: {
        mairie: Boolean(guest.invited_to_mairie),
        vinHonneur: Boolean(guest.invited_to_vin_honneur),
        chabbat: Boolean(guest.invited_to_chabbat),
        houppa: Boolean(guest.invited_to_houppa)
      },
      responses,
      hasResponded: existingResponses.length > 0
    }
  });
}));

// POST /:token/response - Enregistrer la réponse d'un invité
router.post('/:token/response', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { events, totalGuests, message } = req.body;

  // Validation du format du token
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    throw errors.badRequest('Token invalide');
  }

  // Trouver l'invité
  const guest = await get('SELECT * FROM guests WHERE token = ?', [token]);

  if (!guest) {
    throw errors.notFound('Invité');
  }

  // Valider les événements
  if (!events || typeof events !== 'object') {
    throw errors.badRequest('Les réponses aux événements sont requises');
  }

  const validEvents = ['mairie', 'vin_honneur', 'chabbat', 'houppa'];
  const eventResponses = [];

  for (const [eventName, eventData] of Object.entries(events)) {
    if (!validEvents.includes(eventName)) {
      continue; // Ignorer les événements invalides
    }

    // Vérifier que l'invité est bien invité à cet événement
    const eventField = `invited_to_${eventName}`;
    if (!guest[eventField]) {
      continue; // Ignorer si l'invité n'est pas invité à cet événement
    }

    const willAttend = Boolean(eventData.attend);
    const plusOne = Math.min(Math.max(parseInt(eventData.plusOne) || 0, 0), 10);

    eventResponses.push({
      guestId: guest.id,
      eventName,
      willAttend,
      plusOne: willAttend ? plusOne : 0 // Pas de +1 si ne vient pas
    });
  }

  // Enregistrer les réponses (INSERT OR REPLACE pour permettre les modifications)
  for (const response of eventResponses) {
    await run(
      `INSERT OR REPLACE INTO event_responses (guest_id, event_name, will_attend, plus_one, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
      [response.guestId, response.eventName, response.willAttend ? 1 : 0, response.plusOne]
    );
  }

  // Enregistrer le nombre total de personnes
  if (totalGuests && Number.isInteger(totalGuests) && totalGuests >= 1 && totalGuests <= 20) {
    await run(
      'UPDATE guests SET total_guests = ? WHERE id = ?',
      [totalGuests, guest.id]
    );
  }

  // Enregistrer le message si fourni
  if (message && typeof message === 'string' && message.trim()) {
    const sanitizedMessage = sanitizeString(message, 2000);
    await run(
      'INSERT INTO messages (guest_id, message, created_at) VALUES (?, ?, datetime(\'now\'))',
      [guest.id, sanitizedMessage]
    );
  }

  res.json({
    success: true,
    message: 'Votre réponse a été enregistrée avec succès',
    data: {
      responsesCount: eventResponses.length,
      hasMessage: Boolean(message && message.trim())
    }
  });
}));

// GET /:token/status - Vérifier le statut de réponse d'un invité
router.get('/:token/status', asyncHandler(async (req, res) => {
  const { token } = req.params;

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    throw errors.badRequest('Token invalide');
  }

  const guest = await get('SELECT id, first_name FROM guests WHERE token = ?', [token]);

  if (!guest) {
    throw errors.notFound('Invité');
  }

  const responseCount = await get(
    'SELECT COUNT(*) as count FROM event_responses WHERE guest_id = ?',
    [guest.id]
  );

  res.json({
    success: true,
    data: {
      hasResponded: responseCount.count > 0,
      firstName: guest.first_name
    }
  });
}));

module.exports = router;
