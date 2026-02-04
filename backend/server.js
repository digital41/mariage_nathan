const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir les fichiers statiques depuis le dossier public
app.use(express.static(path.join(__dirname, '..', 'public')));

// Template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Database connection
const db = new sqlite3.Database(path.join(__dirname, 'database.sqlite'), (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err);
  } else {
    console.log('Connecté à la base de données SQLite');
  }
});

// Routes
const guestRoutes = require('./routes/guests');
const adminRoutes = require('./routes/admin');
const emailRoutes = require('./routes/email');

app.use('/api/guests', guestRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/email', emailRoutes);

// Route pour afficher l'invitation personnalisée
app.get('/invitation/:token', (req, res) => {
  const token = req.params.token;

  db.get('SELECT * FROM guests WHERE token = ?', [token], (err, guest) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Erreur serveur');
    }

    if (!guest) {
      return res.status(404).send('Invitation non trouvée');
    }

    // Récupérer les événements auxquels l'invité est convié
    db.all('SELECT * FROM guest_events WHERE guest_id = ?', [guest.id], (err, events) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Erreur serveur');
      }

      res.render('invitation', { guest, events });
    });
  });
});

// Route de base
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Route pour les reponses publiques (formulaire du site)
app.post('/api/guests/public-response', (req, res) => {
  const { name, email, events, message } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Nom et email requis' });
  }

  // Enregistrer la reponse dans une table dediee
  db.run(
    `INSERT INTO public_responses (name, email, mairie, vin_honneur, chabbat, houppa, message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      name,
      email,
      events?.mairie?.attend ? 1 : 0,
      events?.vin_honneur?.attend ? 1 : 0,
      events?.chabbat?.attend ? 1 : 0,
      events?.houppa?.attend ? 1 : 0,
      message || ''
    ],
    function(err) {
      if (err) {
        console.error('Erreur enregistrement reponse:', err);
        return res.status(500).json({ error: 'Erreur serveur' });
      }
      res.json({ success: true, message: 'Reponse enregistree' });
    }
  );
});

// Route admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Gestion des erreurs
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Une erreur est survenue!' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
});

// Export pour utilisation dans d'autres fichiers
module.exports = { app, db };
