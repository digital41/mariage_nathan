const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { run, get, all } = require('../utils/database');
const { checkAuth, emailRateLimit } = require('../middleware/auth');
const { asyncHandler, errors } = require('../middleware/errorHandler');
const { generateInvitationEmail, generateInvitationEmailText } = require('../utils/emailTemplate');

// Configuration du transporteur email (lazy initialization)
let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      pool: true, // Utiliser un pool de connexions pour de meilleures performances
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000, // Délai minimum entre les emails
      rateLimit: 10 // Max 10 emails par seconde
    });
  }
  return transporter;
};

// Tous les endpoints email requièrent une authentification
router.use(checkAuth);

// GET /test - Tester la configuration email
router.get('/test', asyncHandler(async (req, res) => {
  try {
    await getTransporter().verify();
    res.json({
      success: true,
      message: 'Configuration email valide',
      config: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: process.env.EMAIL_SECURE === 'true',
        from: process.env.EMAIL_FROM
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Configuration email invalide',
      details: error.message
    });
  }
}));

// POST /send/:guestId - Envoyer une invitation à un invité
router.post('/send/:guestId', emailRateLimit, asyncHandler(async (req, res) => {
  const { guestId } = req.params;

  const guest = await get('SELECT * FROM guests WHERE id = ?', [guestId]);

  if (!guest) {
    throw errors.notFound('Invité');
  }

  if (!guest.email) {
    throw errors.badRequest('Cet invité n\'a pas d\'adresse email');
  }

  const invitationLink = `${process.env.SITE_URL}/invitation/${guest.token}`;

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: guest.email,
    subject: 'Invitation au Mariage de Dvora & Nathan - 14 Juin 2026',
    html: generateInvitationEmail(guest, invitationLink),
    text: generateInvitationEmailText(guest, invitationLink)
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);

    // Mettre à jour le statut d'envoi
    await run(
      'UPDATE guests SET email_sent = 1, email_sent_date = datetime(\'now\') WHERE id = ?',
      [guestId]
    );

    res.json({
      success: true,
      message: 'Email envoyé avec succès',
      data: {
        guestId: guest.id,
        email: guest.email,
        messageId: info.messageId
      }
    });
  } catch (error) {
    console.error('Erreur envoi email:', error);
    throw errors.serverError('Erreur lors de l\'envoi de l\'email: ' + error.message);
  }
}));

// POST /send-bulk - Envoyer des invitations à plusieurs invités
router.post('/send-bulk', asyncHandler(async (req, res) => {
  const { guestIds } = req.body;

  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    throw errors.badRequest('Liste d\'invités invalide');
  }

  // Limiter le nombre d'envois en une fois
  if (guestIds.length > 50) {
    throw errors.badRequest('Maximum 50 emails par envoi groupé');
  }

  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  // Récupérer tous les invités en une seule requête
  const placeholders = guestIds.map(() => '?').join(',');
  const guests = await all(
    `SELECT * FROM guests WHERE id IN (${placeholders})`,
    guestIds
  );

  // Créer un map pour un accès rapide
  const guestsMap = new Map(guests.map(g => [g.id, g]));

  for (const guestId of guestIds) {
    const guest = guestsMap.get(guestId);

    if (!guest) {
      results.failed.push({
        guestId,
        error: 'Invité non trouvé'
      });
      continue;
    }

    if (!guest.email) {
      results.skipped.push({
        guestId,
        name: `${guest.first_name} ${guest.last_name}`,
        reason: 'Pas d\'adresse email'
      });
      continue;
    }

    const invitationLink = `${process.env.SITE_URL}/invitation/${guest.token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: guest.email,
      subject: 'Invitation au Mariage de Dvora & Nathan - 14 Juin 2026',
      html: generateInvitationEmail(guest, invitationLink),
      text: generateInvitationEmailText(guest, invitationLink)
    };

    try {
      await getTransporter().sendMail(mailOptions);

      await run(
        'UPDATE guests SET email_sent = 1, email_sent_date = datetime(\'now\') WHERE id = ?',
        [guestId]
      );

      results.success.push({
        guestId,
        email: guest.email,
        name: `${guest.first_name} ${guest.last_name}`
      });
    } catch (error) {
      results.failed.push({
        guestId,
        email: guest.email,
        error: error.message
      });
    }

    // Pause entre chaque email pour éviter les limitations
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  res.json({
    success: true,
    message: 'Envoi groupé terminé',
    data: {
      total: guestIds.length,
      sent: results.success.length,
      failed: results.failed.length,
      skipped: results.skipped.length,
      results
    }
  });
}));

// POST /preview/:guestId - Prévisualiser un email (sans envoyer)
router.post('/preview/:guestId', asyncHandler(async (req, res) => {
  const { guestId } = req.params;

  const guest = await get('SELECT * FROM guests WHERE id = ?', [guestId]);

  if (!guest) {
    throw errors.notFound('Invité');
  }

  const invitationLink = `${process.env.SITE_URL}/invitation/${guest.token}`;

  res.json({
    success: true,
    data: {
      to: guest.email,
      subject: 'Invitation au Mariage de Dvora & Nathan - 14 Juin 2026',
      html: generateInvitationEmail(guest, invitationLink),
      invitationLink
    }
  });
}));

// POST /resend-failed - Renvoyer les emails échoués
router.post('/resend-failed', asyncHandler(async (req, res) => {
  // Récupérer tous les invités dont l'email n'a pas été envoyé
  const guests = await all(
    'SELECT * FROM guests WHERE email_sent = 0 AND email IS NOT NULL AND email != \'\''
  );

  if (guests.length === 0) {
    return res.json({
      success: true,
      message: 'Aucun email à renvoyer',
      data: { count: 0 }
    });
  }

  const guestIds = guests.map(g => g.id);

  // Réutiliser la logique d'envoi groupé
  req.body.guestIds = guestIds;

  // Rediriger vers send-bulk
  const results = {
    success: [],
    failed: []
  };

  for (const guest of guests) {
    const invitationLink = `${process.env.SITE_URL}/invitation/${guest.token}`;

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: guest.email,
      subject: 'Invitation au Mariage de Dvora & Nathan - 14 Juin 2026',
      html: generateInvitationEmail(guest, invitationLink),
      text: generateInvitationEmailText(guest, invitationLink)
    };

    try {
      await getTransporter().sendMail(mailOptions);

      await run(
        'UPDATE guests SET email_sent = 1, email_sent_date = datetime(\'now\') WHERE id = ?',
        [guest.id]
      );

      results.success.push({ guestId: guest.id, email: guest.email });
    } catch (error) {
      results.failed.push({ guestId: guest.id, error: error.message });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  res.json({
    success: true,
    message: 'Renvoi terminé',
    data: {
      total: guests.length,
      sent: results.success.length,
      failed: results.failed.length,
      results
    }
  });
}));

module.exports = router;
