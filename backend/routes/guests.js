const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { run, get, all } = require('../utils/database');
const { asyncHandler, errors } = require('../middleware/errorHandler');
const { sanitizeString } = require('../middleware/validation');

// Configuration email pour les notifications
const getNotificationTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Envoyer une notification par email
const sendNotificationEmail = async (guest, eventResponses, totalGuests, message) => {
  try {
    const transporter = getNotificationTransporter();

    // Formater les réponses aux événements
    const eventLabels = {
      mairie: 'La Mairie',
      vin_honneur: 'Vin d\'Honneur / Henné',
      houppa: 'Houppa / Soirée',
      chabbat: 'Le Chabbat'
    };

    let eventsHtml = '';
    for (const response of eventResponses) {
      const status = response.willAttend ? '✅ Présent' : '❌ Absent';
      const peopleInfo = response.willAttend && response.plusOne > 0 ? ` (${response.plusOne} personne${response.plusOne > 1 ? 's' : ''})` : '';
      eventsHtml += `<li><strong>${eventLabels[response.eventName] || response.eventName}</strong>: ${status}${peopleInfo}</li>`;
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: 'ibguinathan@gmail.com',
      subject: `🎊 Nouvelle réponse de ${guest.first_name} ${guest.last_name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #C9A961; border-bottom: 2px solid #C9A961; padding-bottom: 10px;">
            Nouvelle réponse au formulaire
          </h2>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Invité</h3>
            <p><strong>Nom:</strong> ${guest.first_name} ${guest.last_name}</p>
            <p><strong>Email:</strong> ${guest.email || 'Non renseigné'}</p>
            <p><strong>Téléphone:</strong> ${guest.phone || 'Non renseigné'}</p>
            <p><strong>Nombre de personnes:</strong> ${totalGuests || 1}</p>
          </div>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Réponses aux événements</h3>
            <ul style="list-style: none; padding: 0;">
              ${eventsHtml}
            </ul>
          </div>

          ${message ? `
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C9A961;">
            <h3 style="margin-top: 0; color: #333;">💬 Message</h3>
            <p style="font-style: italic;">"${message}"</p>
          </div>
          ` : ''}

          <p style="color: #888; font-size: 12px; margin-top: 30px;">
            Réponse reçue le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Notification envoyée pour ${guest.first_name} ${guest.last_name}`);
  } catch (error) {
    console.error('Erreur envoi notification:', error.message);
    // Ne pas bloquer la réponse si l'email échoue
  }
};

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
      plusOne: r.will_attend ? (r.plus_one || 1) : 0
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
    const safeTotalGuests = Math.min(Math.max(parseInt(totalGuests) || 1, 1), 20);
    const plusOne = Math.min(Math.max(parseInt(eventData.plusOne) || 1, 1), safeTotalGuests);

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
  let sanitizedMessage = '';
  if (message && typeof message === 'string' && message.trim()) {
    sanitizedMessage = sanitizeString(message, 2000);
    await run(
      'INSERT INTO messages (guest_id, message, created_at) VALUES (?, ?, datetime(\'now\'))',
      [guest.id, sanitizedMessage]
    );
  }

  // Envoyer une notification par email (en arrière-plan)
  sendNotificationEmail(guest, eventResponses, totalGuests, sanitizedMessage);

  // Envoyer vers n8n / Google Sheets (en arrière-plan)
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (webhookUrl) {
    const webhookData = {
      type: 'invitation_response',
      timestamp: new Date().toISOString(),
      prenom: guest.first_name,
      nom: guest.last_name,
      email: guest.email || '',
      telephone: guest.phone || '',
      famille: guest.family || '',
      total_personnes: totalGuests || 1,
      mairie: '',
      vin_honneur: '',
      houppa: '',
      chabbat: '',
      message: sanitizedMessage || ''
    };
    eventResponses.forEach(r => {
      webhookData[r.eventName] = r.willAttend ? `Oui (${r.plusOne})` : 'Non';
    });
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(webhookData)
    }).catch(err => console.error('Erreur webhook n8n:', err.message));
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
