const express = require('express');
const router = express.Router();
const { db } = require('../server');

// Récupérer un invité par token
router.get('/:token', (req, res) => {
  const { token } = req.params;

  db.get('SELECT * FROM guests WHERE token = ?', [token], (err, guest) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (!guest) {
      return res.status(404).json({ error: 'Invité non trouvé' });
    }

    res.json(guest);
  });
});

// Enregistrer la réponse d'un invité
router.post('/:token/response', (req, res) => {
  const { token } = req.params;
  const { events, message } = req.body;

  // Trouver l'invité
  db.get('SELECT * FROM guests WHERE token = ?', [token], (err, guest) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }

    if (!guest) {
      return res.status(404).json({ error: 'Invité non trouvé' });
    }

    // Enregistrer les réponses pour chaque événement
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO event_responses (guest_id, event_name, will_attend, plus_one)
      VALUES (?, ?, ?, ?)
    `);

    Object.entries(events).forEach(([eventName, eventData]) => {
      stmt.run(guest.id, eventName, eventData.attend ? 1 : 0, eventData.plusOne || 0);
    });

    stmt.finalize();

    // Enregistrer le message si fourni
    if (message && message.trim()) {
      db.run(
        'INSERT INTO messages (guest_id, message) VALUES (?, ?)',
        [guest.id, message],
        (err) => {
          if (err) console.error('Erreur enregistrement message:', err);
        }
      );
    }

    res.json({ success: true, message: 'Réponse enregistrée avec succès' });
  });
});

module.exports = router;
