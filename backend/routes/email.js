const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { db } = require('../server');

// Configuration du transporteur email
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Middleware d'authentification
const checkAuth = (req, res, next) => {
  const { password } = req.headers;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
};

// Envoyer une invitation par email
router.post('/send/:guestId', checkAuth, async (req, res) => {
  const { guestId } = req.params;

  db.get('SELECT * FROM guests WHERE id = ?', [guestId], async (err, guest) => {
    if (err || !guest) {
      return res.status(404).json({ error: 'Invité non trouvé' });
    }

    const invitationLink = `${process.env.SITE_URL}/invitation/${guest.token}`;

    const events = [];
    if (guest.invited_to_mairie) events.push('La Mairie');
    if (guest.invited_to_vin_honneur) events.push('Vin d\'Honneur / Henné');
    if (guest.invited_to_chabbat) events.push('Le Chabbat');
    if (guest.invited_to_houppa) events.push('Houppa / Soirée');

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: guest.email,
      subject: 'Invitation au Mariage de Dvora & Nathan - 14 Juin 2026',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Georgia', serif; background-color: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; }
            .header { text-align: center; color: #d4af37; font-size: 32px; font-family: 'Pinyon Script', cursive; margin-bottom: 20px; }
            .content { color: #333; line-height: 1.8; }
            .button { display: inline-block; background-color: #d4af37; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .events { background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #d4af37; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">Dvora & Nathan</div>

            <div class="content">
              <p>Cher(ère) ${guest.first_name} ${guest.last_name},</p>

              <p>C'est avec une immense joie que nous vous invitons à célébrer notre mariage le <strong>14 Juin 2026</strong>.</p>

              <div class="events">
                <strong>Vous êtes convié(e) aux événements suivants :</strong>
                <ul>
                  ${events.map(event => `<li>${event}</li>`).join('')}
                </ul>
              </div>

              <p>Pour consulter tous les détails de votre invitation personnalisée et confirmer votre présence, veuillez cliquer sur le lien ci-dessous :</p>

              <div style="text-align: center;">
                <a href="${invitationLink}" class="button">Voir mon invitation</a>
              </div>

              <p>Nous avons hâte de partager ce moment unique avec vous !</p>

              <p style="margin-top: 30px;">Avec toute notre affection,<br><strong>Dvora & Nathan</strong></p>
            </div>

            <div class="footer">
              Ce lien d'invitation est personnel et unique. Ne le partagez pas.
            </div>
          </div>
        </body>
        </html>
      `
    };

    try {
      await transporter.sendMail(mailOptions);

      // Mettre à jour le statut d'envoi
      db.run(
        'UPDATE guests SET email_sent = 1, email_sent_date = ? WHERE id = ?',
        [new Date().toISOString(), guestId],
        (err) => {
          if (err) {
            console.error('Erreur mise à jour statut:', err);
          }
        }
      );

      res.json({ success: true, message: 'Email envoyé avec succès' });
    } catch (error) {
      console.error('Erreur envoi email:', error);
      res.status(500).json({ error: 'Erreur lors de l\'envoi de l\'email' });
    }
  });
});

// Envoyer des invitations à plusieurs invités
router.post('/send-bulk', checkAuth, async (req, res) => {
  const { guestIds } = req.body;

  const results = {
    success: [],
    failed: []
  };

  for (const guestId of guestIds) {
    try {
      await new Promise((resolve, reject) => {
        db.get('SELECT * FROM guests WHERE id = ?', [guestId], async (err, guest) => {
          if (err || !guest) {
            results.failed.push({ guestId, error: 'Invité non trouvé' });
            return resolve();
          }

          const invitationLink = `${process.env.SITE_URL}/invitation/${guest.token}`;

          const events = [];
          if (guest.invited_to_mairie) events.push('La Mairie');
          if (guest.invited_to_vin_honneur) events.push('Vin d\'Honneur / Henné');
          if (guest.invited_to_chabbat) events.push('Le Chabbat');
          if (guest.invited_to_houppa) events.push('Houppa / Soirée');

          const mailOptions = {
            from: process.env.EMAIL_FROM,
            to: guest.email,
            subject: 'Invitation au Mariage de Dvora & Nathan - 14 Juin 2026',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: 'Georgia', serif; background-color: #f5f5f5; }
                  .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; }
                  .header { text-align: center; color: #d4af37; font-size: 32px; margin-bottom: 20px; }
                  .content { color: #333; line-height: 1.8; }
                  .button { display: inline-block; background-color: #d4af37; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .events { background-color: #f9f9f9; padding: 15px; margin: 20px 0; border-left: 4px solid #d4af37; }
                  .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">Dvora & Nathan</div>

                  <div class="content">
                    <p>Cher(ère) ${guest.first_name} ${guest.last_name},</p>

                    <p>C'est avec une immense joie que nous vous invitons à célébrer notre mariage le <strong>14 Juin 2026</strong>.</p>

                    <div class="events">
                      <strong>Vous êtes convié(e) aux événements suivants :</strong>
                      <ul>
                        ${events.map(event => `<li>${event}</li>`).join('')}
                      </ul>
                    </div>

                    <p>Pour consulter tous les détails de votre invitation personnalisée et confirmer votre présence, veuillez cliquer sur le lien ci-dessous :</p>

                    <div style="text-align: center;">
                      <a href="${invitationLink}" class="button">Voir mon invitation</a>
                    </div>

                    <p>Nous avons hâte de partager ce moment unique avec vous !</p>

                    <p style="margin-top: 30px;">Avec toute notre affection,<br><strong>Dvora & Nathan</strong></p>
                  </div>

                  <div class="footer">
                    Ce lien d'invitation est personnel et unique. Ne le partagez pas.
                  </div>
                </div>
              </body>
              </html>
            `
          };

          try {
            await transporter.sendMail(mailOptions);

            db.run(
              'UPDATE guests SET email_sent = 1, email_sent_date = ? WHERE id = ?',
              [new Date().toISOString(), guestId]
            );

            results.success.push({ guestId, email: guest.email });
            resolve();
          } catch (error) {
            results.failed.push({ guestId, error: error.message });
            resolve();
          }
        });
      });

      // Pause de 1 seconde entre chaque email pour éviter les limitations
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      results.failed.push({ guestId, error: error.message });
    }
  }

  res.json({
    message: 'Envoi terminé',
    results
  });
});

// Tester la configuration email
router.get('/test', checkAuth, async (req, res) => {
  try {
    await transporter.verify();
    res.json({ success: true, message: 'Configuration email valide' });
  } catch (error) {
    res.status(500).json({ error: 'Configuration email invalide', details: error.message });
  }
});

module.exports = router;
