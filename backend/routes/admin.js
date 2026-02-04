const express = require('express');
const router = express.Router();
const { db } = require('../server');
const { v4: uuidv4 } = require('uuid');

// Middleware simple d'authentification (à améliorer en production)
const checkAuth = (req, res, next) => {
  const { password } = req.headers;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Non autorisé' });
  }
  next();
};

// Récupérer tous les invités
router.get('/guests', checkAuth, (req, res) => {
  db.all('SELECT * FROM guests ORDER BY last_name, first_name', (err, guests) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(guests);
  });
});

// Ajouter un invité
router.post('/guests', checkAuth, (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    invited_to_mairie,
    invited_to_vin_honneur,
    invited_to_chabbat,
    invited_to_houppa
  } = req.body;

  const token = uuidv4();

  db.run(
    `INSERT INTO guests (
      first_name, last_name, email, phone, token,
      invited_to_mairie, invited_to_vin_honneur, invited_to_chabbat, invited_to_houppa
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      first_name,
      last_name,
      email,
      phone,
      token,
      invited_to_mairie ? 1 : 0,
      invited_to_vin_honneur ? 1 : 0,
      invited_to_chabbat ? 1 : 0,
      invited_to_houppa ? 1 : 0
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la création' });
      }
      res.json({
        id: this.lastID,
        token,
        message: 'Invité créé avec succès'
      });
    }
  );
});

// Mettre à jour un invité
router.put('/guests/:id', checkAuth, (req, res) => {
  const { id } = req.params;
  const {
    first_name,
    last_name,
    email,
    phone,
    invited_to_mairie,
    invited_to_vin_honneur,
    invited_to_chabbat,
    invited_to_houppa
  } = req.body;

  db.run(
    `UPDATE guests SET
      first_name = ?, last_name = ?, email = ?, phone = ?,
      invited_to_mairie = ?, invited_to_vin_honneur = ?,
      invited_to_chabbat = ?, invited_to_houppa = ?
    WHERE id = ?`,
    [
      first_name,
      last_name,
      email,
      phone,
      invited_to_mairie ? 1 : 0,
      invited_to_vin_honneur ? 1 : 0,
      invited_to_chabbat ? 1 : 0,
      invited_to_houppa ? 1 : 0,
      id
    ],
    (err) => {
      if (err) {
        return res.status(500).json({ error: 'Erreur lors de la mise à jour' });
      }
      res.json({ message: 'Invité mis à jour avec succès' });
    }
  );
});

// Supprimer un invité
router.delete('/guests/:id', checkAuth, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM guests WHERE id = ?', [id], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
    res.json({ message: 'Invité supprimé avec succès' });
  });
});

// Récupérer les statistiques
router.get('/stats', checkAuth, (req, res) => {
  const stats = {};

  // Total invités
  db.get('SELECT COUNT(*) as total FROM guests', (err, row) => {
    stats.totalGuests = row.total;

    // Emails envoyés
    db.get('SELECT COUNT(*) as sent FROM guests WHERE email_sent = 1', (err, row) => {
      stats.emailsSent = row.sent;

      // Réponses reçues
      db.get('SELECT COUNT(DISTINCT guest_id) as responded FROM event_responses', (err, row) => {
        stats.responsesReceived = row.responded;

        // Messages reçus
        db.get('SELECT COUNT(*) as messages FROM messages', (err, row) => {
          stats.messagesReceived = row.messages;

          res.json(stats);
        });
      });
    });
  });
});

// Récupérer toutes les réponses
router.get('/responses', checkAuth, (req, res) => {
  db.all(`
    SELECT g.first_name, g.last_name, g.email,
           er.event_name, er.will_attend, er.plus_one, er.created_at
    FROM event_responses er
    JOIN guests g ON er.guest_id = g.id
    ORDER BY er.created_at DESC
  `, (err, responses) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(responses);
  });
});

// Récupérer tous les messages
router.get('/messages', checkAuth, (req, res) => {
  db.all(`
    SELECT m.*, g.first_name, g.last_name, g.email
    FROM messages m
    JOIN guests g ON m.guest_id = g.id
    ORDER BY m.created_at DESC
  `, (err, messages) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    res.json(messages);
  });
});

module.exports = router;
