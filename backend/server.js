const express = require('express');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const { initDatabase, run, get, all } = require('./utils/database');
const { rateLimit, loginRateLimit } = require('./middleware/auth');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');
const { validatePublicResponseMiddleware } = require('./middleware/validation');

// Fonction pour envoyer une notification email pour les réponses publiques
const sendPublicResponseNotification = async (data) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const eventLabels = {
      mairie: 'La Mairie',
      vin_honneur: 'Vin d\'Honneur / Henné',
      houppa: 'Houppa / Soirée',
      chabbat: 'Le Chabbat'
    };

    let eventsHtml = '';
    if (data.mairie) eventsHtml += `<li>✅ ${eventLabels.mairie}</li>`;
    if (data.vin_honneur) eventsHtml += `<li>✅ ${eventLabels.vin_honneur}</li>`;
    if (data.houppa) eventsHtml += `<li>✅ ${eventLabels.houppa}</li>`;
    if (data.chabbat) eventsHtml += `<li>✅ ${eventLabels.chabbat}</li>`;
    if (!eventsHtml) eventsHtml = '<li>Aucun événement sélectionné</li>';

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: 'ibguinathan@gmail.com',
      subject: `🎊 Nouvelle réponse publique de ${data.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #C9A961; border-bottom: 2px solid #C9A961; padding-bottom: 10px;">
            Nouvelle réponse (formulaire public)
          </h2>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Informations</h3>
            <p><strong>Nom:</strong> ${data.name}</p>
            <p><strong>Nombre de personnes:</strong> ${data.guests}</p>
          </div>

          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #333;">Événements confirmés</h3>
            <ul style="list-style: none; padding: 0;">
              ${eventsHtml}
            </ul>
          </div>

          ${data.message ? `
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #C9A961;">
            <h3 style="margin-top: 0; color: #333;">💬 Message</h3>
            <p style="font-style: italic;">"${data.message}"</p>
          </div>
          ` : ''}

          <p style="color: #888; font-size: 12px; margin-top: 30px;">
            Réponse reçue le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`Notification publique envoyée pour ${data.name}`);
  } catch (error) {
    console.error('Erreur envoi notification publique:', error.message);
  }
};

// Import des routes
const adminRoutes = require('./routes/admin');
const guestRoutes = require('./routes/guests');
const messagingRoutes = require('./routes/messaging');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================
// MIDDLEWARE GLOBAUX
// ============================================

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.SITE_URL
    : '*',
  credentials: true
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting global (100 requêtes par minute)
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: 'Trop de requêtes, veuillez réessayer plus tard'
}));

// Logging des requêtes en développement
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  });
}

// Headers de sécurité
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// ============================================
// FICHIERS STATIQUES
// ============================================

// Servir les fichiers statiques du site public
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0
}));

// Servir les fichiers de l'admin
app.use('/admin', express.static(path.join(__dirname, 'public'), {
  maxAge: 0 // Pas de cache pour l'admin
}));

// ============================================
// ROUTES PRINCIPALES
// ============================================

// Page d'accueil
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Page admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Page d'invitation personnalisée
app.get('/invitation/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Validation du format du token (UUID v4)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return res.status(400).send('Lien d\'invitation invalide');
  }

  const guest = await get('SELECT * FROM guests WHERE token = ?', [token]);

  if (!guest) {
    return res.status(404).send('Invitation non trouvée');
  }

  // Charger les réponses existantes
  const existingResponses = await all(
    'SELECT event_name, will_attend, plus_one FROM event_responses WHERE guest_id = ?',
    [guest.id]
  );

  const responses = {};
  existingResponses.forEach(r => {
    responses[r.event_name] = {
      willAttend: Boolean(r.will_attend),
      plusOne: r.plus_one || 0
    };
  });

  res.render('invitation', { guest, responses, hasResponded: existingResponses.length > 0 });
}));

// Route de vérification du mot de passe admin (avec rate limiting spécifique)
app.post('/api/auth/login', loginRateLimit, asyncHandler(async (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Mot de passe requis'
    });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      error: 'Mot de passe incorrect'
    });
  }

  res.json({
    success: true,
    message: 'Authentification réussie'
  });
}));

// ============================================
// API ROUTES
// ============================================

// Routes admin (protégées par authentification)
app.use('/api/admin', adminRoutes);

// Routes invités (publiques avec token)
app.use('/api/guests', guestRoutes);

// Routes messaging : email + WhatsApp + SMS (protégées par authentification)
app.use('/api/messaging', messagingRoutes);
app.use('/api/email', messagingRoutes); // Alias pour compatibilité

// ============================================
// ROUTES PUBLIQUES
// ============================================

// Réponse publique depuis le formulaire du site
app.post('/api/public/response', validatePublicResponseMiddleware, asyncHandler(async (req, res) => {
  const data = req.validatedData;

  const result = await run(
    `INSERT INTO public_responses (name, guests, mairie, vin_honneur, chabbat, houppa, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      data.name,
      data.guests,
      data.mairie ? 1 : 0,
      data.vin_honneur ? 1 : 0,
      data.chabbat ? 1 : 0,
      data.houppa ? 1 : 0,
      data.message
    ]
  );

  console.log(`Nouvelle réponse publique: ${data.name} (${data.guests} personnes)`);

  // Envoyer notification par email (en arrière-plan)
  sendPublicResponseNotification(data);

  res.status(201).json({
    success: true,
    message: 'Merci ! Votre réponse a été enregistrée avec succès',
    data: {
      id: result.lastID
    }
  });
}));

// Route legacy pour compatibilité (redirige vers la nouvelle route)
app.post('/api/guests/public-response', validatePublicResponseMiddleware, asyncHandler(async (req, res) => {
  const data = req.validatedData;

  const result = await run(
    `INSERT INTO public_responses (name, guests, mairie, vin_honneur, chabbat, houppa, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      data.name,
      data.guests,
      data.mairie ? 1 : 0,
      data.vin_honneur ? 1 : 0,
      data.chabbat ? 1 : 0,
      data.houppa ? 1 : 0,
      data.message
    ]
  );

  // Envoyer notification par email (en arrière-plan)
  sendPublicResponseNotification(data);

  res.json({
    success: true,
    message: 'Réponse enregistrée avec succès'
  });
}));

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// GESTION DES ERREURS
// ============================================

// Route non trouvée
app.use(notFoundHandler);

// Gestionnaire d'erreurs global
app.use(errorHandler);

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================

const startServer = async () => {
  try {
    // Initialiser la base de données
    await initDatabase();

    // Démarrer le serveur
    app.listen(PORT, () => {
      console.log('\n========================================');
      console.log('   Serveur Mariage Dvora & Nathan');
      console.log('========================================');
      console.log(`Mode:     ${process.env.NODE_ENV || 'development'}`);
      console.log(`Site:     http://localhost:${PORT}`);
      console.log(`Admin:    http://localhost:${PORT}/admin`);
      console.log(`API:      http://localhost:${PORT}/api`);
      console.log('========================================\n');
    });

  } catch (error) {
    console.error('Erreur lors du démarrage du serveur:', error);
    process.exit(1);
  }
};

// Gestion de l'arrêt propre
process.on('SIGTERM', async () => {
  console.log('\nArrêt du serveur...');
  const { closeDatabase } = require('./utils/database');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nArrêt du serveur...');
  const { closeDatabase } = require('./utils/database');
  await closeDatabase();
  process.exit(0);
});

// Démarrer le serveur
startServer();

module.exports = { app };
