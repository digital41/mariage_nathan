const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const XLSX = require('xlsx');
const { run, get, all } = require('../utils/database');
const { checkAuth } = require('../middleware/auth');
const { validateGuestMiddleware, sanitizeString } = require('../middleware/validation');
const { asyncHandler, errors } = require('../middleware/errorHandler');

// Multer en mémoire pour l'upload de fichiers
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Tous les endpoints admin requièrent une authentification
router.use(checkAuth);

// GET /admin/guests - Récupérer tous les invités
router.get('/guests', asyncHandler(async (req, res) => {
  const guests = await all(`
    SELECT
      g.*,
      (SELECT COUNT(*) FROM event_responses WHERE guest_id = g.id) as response_count
    FROM guests g
    ORDER BY g.last_name, g.first_name
  `);

  res.json({
    success: true,
    data: guests,
    count: guests.length
  });
}));

// GET /admin/guests/:id - Récupérer un invité par ID
router.get('/guests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const guest = await get('SELECT * FROM guests WHERE id = ?', [id]);

  if (!guest) {
    throw errors.notFound('Invité');
  }

  const responses = await all(
    'SELECT * FROM event_responses WHERE guest_id = ?',
    [id]
  );

  const messages = await all(
    'SELECT * FROM messages WHERE guest_id = ? ORDER BY created_at DESC',
    [id]
  );

  res.json({
    success: true,
    data: { ...guest, responses, messages }
  });
}));

// POST /admin/guests - Créer un invité
router.post('/guests', validateGuestMiddleware, asyncHandler(async (req, res) => {
  const data = req.validatedData;
  const token = uuidv4();

  // Vérifier doublon par email
  if (data.email) {
    const existingEmail = await get('SELECT id FROM guests WHERE email = ?', [data.email]);
    if (existingEmail) {
      throw errors.badRequest('Un invité avec cet email existe déjà');
    }
  }

  // Vérifier doublon par prénom+nom
  const existingName = await get(
    'SELECT id FROM guests WHERE LOWER(first_name) = LOWER(?) AND LOWER(last_name) = LOWER(?)',
    [data.first_name, data.last_name]
  );
  if (existingName) {
    throw errors.badRequest('Un invité avec ce nom existe déjà');
  }

  const result = await run(
    `INSERT INTO guests (
      first_name, last_name, email, phone, token, family, country,
      invited_to_mairie, invited_to_vin_honneur, invited_to_chabbat, invited_to_houppa
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      token,
      data.family,
      data.country,
      data.invited_to_mairie ? 1 : 0,
      data.invited_to_vin_honneur ? 1 : 0,
      data.invited_to_chabbat ? 1 : 0,
      data.invited_to_houppa ? 1 : 0
    ]
  );

  res.status(201).json({
    success: true,
    data: {
      id: result.lastID,
      token,
      ...data
    },
    message: 'Invité créé avec succès'
  });
}));

// PUT /admin/guests/:id - Mettre à jour un invité
router.put('/guests/:id', validateGuestMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const data = req.validatedData;

  const existing = await get('SELECT id FROM guests WHERE id = ?', [id]);
  if (!existing) {
    throw errors.notFound('Invité');
  }

  await run(
    `UPDATE guests SET
      first_name = ?, last_name = ?, email = ?, phone = ?,
      family = ?, country = ?,
      invited_to_mairie = ?, invited_to_vin_honneur = ?,
      invited_to_chabbat = ?, invited_to_houppa = ?
    WHERE id = ?`,
    [
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      data.family,
      data.country,
      data.invited_to_mairie ? 1 : 0,
      data.invited_to_vin_honneur ? 1 : 0,
      data.invited_to_chabbat ? 1 : 0,
      data.invited_to_houppa ? 1 : 0,
      id
    ]
  );

  res.json({
    success: true,
    message: 'Invité mis à jour avec succès'
  });
}));

// DELETE /admin/guests/:id - Supprimer un invité
router.delete('/guests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await run('DELETE FROM guests WHERE id = ?', [id]);

  if (result.changes === 0) {
    throw errors.notFound('Invité');
  }

  res.json({
    success: true,
    message: 'Invité supprimé avec succès'
  });
}));

// ============================================
// IMPORT EXCEL / CSV
// ============================================

router.post('/import', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw errors.badRequest('Aucun fichier fourni');
  }

  const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

  if (rows.length === 0) {
    throw errors.badRequest('Le fichier est vide');
  }

  // Mapper les noms de colonnes (insensible à la casse/accents)
  const mapColumn = (row, keys) => {
    for (const key of keys) {
      for (const col of Object.keys(row)) {
        if (col.toLowerCase().replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a') === key.toLowerCase()) {
          return row[col];
        }
      }
    }
    return '';
  };

  // Charger les emails et noms existants pour détecter les doublons
  const existingGuests = await all('SELECT email, first_name, last_name FROM guests');
  const existingEmails = new Set(existingGuests.map(g => (g.email || '').toLowerCase()).filter(e => e));
  const existingNames = new Set(existingGuests.map(g => `${(g.first_name || '').toLowerCase()}|${(g.last_name || '').toLowerCase()}`));

  const results = { imported: [], duplicates: [], errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // +2 car ligne 1 = en-têtes

    const firstName = sanitizeString(String(mapColumn(row, ['prenom', 'Prenom', 'Prénom', 'first_name', 'FirstName'])), 100);
    const lastName = sanitizeString(String(mapColumn(row, ['nom', 'Nom', 'last_name', 'LastName'])), 100);
    const email = String(mapColumn(row, ['email', 'Email', 'E-mail', 'e-mail'])).trim().toLowerCase();
    const phone = sanitizeString(String(mapColumn(row, ['telephone', 'Telephone', 'Téléphone', 'phone', 'Phone', 'Tel', 'tel'])), 20);
    const family = sanitizeString(String(mapColumn(row, ['famille', 'Famille', 'family', 'Family'])), 100);
    const country = sanitizeString(String(mapColumn(row, ['pays', 'Pays', 'country', 'Country'])), 100) || 'France';

    const mairie = mapColumn(row, ['mairie', 'Mairie']);
    const vinHonneur = mapColumn(row, ['vin_honneur', 'Vin Honneur', 'vin honneur', 'VinHonneur']);
    const chabbat = mapColumn(row, ['chabbat', 'Chabbat']);
    const houppa = mapColumn(row, ['houppa', 'Houppa', 'houppa / soiree', 'Houppa / Soirée']);

    // Validation
    if (!firstName || firstName.length < 2) {
      results.errors.push({ line: lineNum, reason: 'Prénom manquant ou trop court' });
      continue;
    }
    if (!lastName || lastName.length < 2) {
      results.errors.push({ line: lineNum, reason: 'Nom manquant ou trop court' });
      continue;
    }

    // Vérifier doublon par email
    if (email && existingEmails.has(email)) {
      results.duplicates.push({ line: lineNum, name: `${firstName} ${lastName}`, reason: `Email ${email} existe déjà` });
      continue;
    }

    // Vérifier doublon par nom
    const nameKey = `${firstName.toLowerCase()}|${lastName.toLowerCase()}`;
    if (existingNames.has(nameKey)) {
      results.duplicates.push({ line: lineNum, name: `${firstName} ${lastName}`, reason: 'Nom existe déjà' });
      continue;
    }

    const toBool = (val) => {
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val === 1;
      const s = String(val).toLowerCase().trim();
      return s === '1' || s === 'oui' || s === 'true' || s === 'x' || s === 'yes';
    };

    const normalizedCountry = country.toLowerCase().includes('etranger') || country.toLowerCase().includes('étranger') ? 'Etranger' : 'France';
    const normalizedFamily = family === 'Ibgui' || family === 'Chemaoun' ? family : (family.toLowerCase().includes('ibgui') ? 'Ibgui' : (family.toLowerCase().includes('chemaoun') ? 'Chemaoun' : family));

    const token = uuidv4();

    try {
      await run(
        `INSERT INTO guests (
          first_name, last_name, email, phone, token, family, country,
          invited_to_mairie, invited_to_vin_honneur, invited_to_chabbat, invited_to_houppa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          firstName, lastName, email || null, phone, token,
          normalizedFamily, normalizedCountry,
          toBool(mairie) ? 1 : 0,
          toBool(vinHonneur) ? 1 : 0,
          toBool(chabbat) ? 1 : 0,
          toBool(houppa) ? 1 : 0
        ]
      );

      // Ajouter aux sets pour détecter les doublons intra-fichier
      if (email) existingEmails.add(email);
      existingNames.add(nameKey);

      results.imported.push({ line: lineNum, name: `${firstName} ${lastName}` });
    } catch (error) {
      results.errors.push({ line: lineNum, name: `${firstName} ${lastName}`, reason: error.message });
    }
  }

  res.json({
    success: true,
    message: 'Import terminé',
    data: {
      total: rows.length,
      imported: results.imported.length,
      duplicates: results.duplicates.length,
      errors: results.errors.length,
      details: results
    }
  });
}));

// GET /admin/stats - Récupérer les statistiques
router.get('/stats', asyncHandler(async (req, res) => {
  const [guestsStats, responsesStats, messagesCount, eventStats, familyStats, countryStats] = await Promise.all([
    get(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN email_sent = 1 THEN 1 ELSE 0 END) as emails_sent
      FROM guests
    `),
    get('SELECT COUNT(DISTINCT guest_id) as count FROM event_responses'),
    get('SELECT COUNT(*) as count FROM messages'),
    get(`
      SELECT
        SUM(CASE WHEN invited_to_mairie = 1 THEN 1 ELSE 0 END) as invited_mairie,
        SUM(CASE WHEN invited_to_vin_honneur = 1 THEN 1 ELSE 0 END) as invited_vin_honneur,
        SUM(CASE WHEN invited_to_chabbat = 1 THEN 1 ELSE 0 END) as invited_chabbat,
        SUM(CASE WHEN invited_to_houppa = 1 THEN 1 ELSE 0 END) as invited_houppa
      FROM guests
    `),
    all('SELECT family, COUNT(*) as count FROM guests WHERE family IS NOT NULL AND family != \'\' GROUP BY family ORDER BY count DESC'),
    all('SELECT country, COUNT(*) as count FROM guests GROUP BY country ORDER BY count DESC')
  ]);

  const confirmationStats = await get(`
    SELECT
      SUM(CASE WHEN event_name = 'mairie' AND will_attend = 1 THEN plus_one ELSE 0 END) as confirmed_mairie,
      SUM(CASE WHEN event_name = 'vin_honneur' AND will_attend = 1 THEN plus_one ELSE 0 END) as confirmed_vin_honneur,
      SUM(CASE WHEN event_name = 'chabbat' AND will_attend = 1 THEN plus_one ELSE 0 END) as confirmed_chabbat,
      SUM(CASE WHEN event_name = 'houppa' AND will_attend = 1 THEN plus_one ELSE 0 END) as confirmed_houppa
    FROM event_responses
  `);

  const publicStats = await get(`
    SELECT
      COUNT(*) as total_responses,
      SUM(guests) as total_guests,
      SUM(CASE WHEN mairie = 1 THEN guests ELSE 0 END) as mairie,
      SUM(CASE WHEN vin_honneur = 1 THEN guests ELSE 0 END) as vin_honneur,
      SUM(CASE WHEN chabbat = 1 THEN guests ELSE 0 END) as chabbat,
      SUM(CASE WHEN houppa = 1 THEN guests ELSE 0 END) as houppa
    FROM public_responses
  `);

  res.json({
    success: true,
    data: {
      guests: {
        total: guestsStats.total || 0,
        emailsSent: guestsStats.emails_sent || 0,
        invited: {
          mairie: eventStats.invited_mairie || 0,
          vin_honneur: eventStats.invited_vin_honneur || 0,
          chabbat: eventStats.invited_chabbat || 0,
          houppa: eventStats.invited_houppa || 0
        },
        byFamily: familyStats || [],
        byCountry: countryStats || []
      },
      responses: {
        totalGuests: responsesStats.count || 0,
        confirmed: {
          mairie: confirmationStats?.confirmed_mairie || 0,
          vin_honneur: confirmationStats?.confirmed_vin_honneur || 0,
          chabbat: confirmationStats?.confirmed_chabbat || 0,
          houppa: confirmationStats?.confirmed_houppa || 0
        }
      },
      publicResponses: {
        total: publicStats?.total_responses || 0,
        totalGuests: publicStats?.total_guests || 0,
        events: {
          mairie: publicStats?.mairie || 0,
          vin_honneur: publicStats?.vin_honneur || 0,
          chabbat: publicStats?.chabbat || 0,
          houppa: publicStats?.houppa || 0
        }
      },
      messages: messagesCount.count || 0
    }
  });
}));

// GET /admin/responses - Récupérer toutes les réponses des invités
router.get('/responses', asyncHandler(async (req, res) => {
  const responses = await all(`
    SELECT
      g.id as guest_id,
      g.first_name,
      g.last_name,
      g.email,
      er.event_name,
      er.will_attend,
      er.plus_one,
      er.created_at
    FROM event_responses er
    JOIN guests g ON er.guest_id = g.id
    ORDER BY er.created_at DESC
  `);

  res.json({
    success: true,
    data: responses,
    count: responses.length
  });
}));

// GET /admin/public-responses - Récupérer les réponses publiques
router.get('/public-responses', asyncHandler(async (req, res) => {
  const responses = await all(
    'SELECT * FROM public_responses ORDER BY created_at DESC'
  );

  res.json({
    success: true,
    data: responses,
    count: responses.length
  });
}));

// DELETE /admin/public-responses/:id - Supprimer une réponse publique
router.delete('/public-responses/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await run('DELETE FROM public_responses WHERE id = ?', [id]);

  if (result.changes === 0) {
    throw errors.notFound('Réponse');
  }

  res.json({
    success: true,
    message: 'Réponse supprimée avec succès'
  });
}));

// GET /admin/messages - Récupérer tous les messages
router.get('/messages', asyncHandler(async (req, res) => {
  const messages = await all(`
    SELECT
      m.id,
      m.message,
      m.created_at,
      g.id as guest_id,
      g.first_name,
      g.last_name,
      g.email
    FROM messages m
    JOIN guests g ON m.guest_id = g.id
    ORDER BY m.created_at DESC
  `);

  res.json({
    success: true,
    data: messages,
    count: messages.length
  });
}));

// GET /admin/export - Exporter toutes les données en CSV
router.get('/export', asyncHandler(async (req, res) => {
  const { type = 'guests' } = req.query;

  let data, headers, filename;

  if (type === 'public') {
    data = await all('SELECT * FROM public_responses ORDER BY created_at DESC');
    headers = ['ID', 'Nom', 'Personnes', 'Mairie', 'Vin Honneur', 'Chabbat', 'Houppa', 'Message', 'Date'];
    filename = 'reponses-publiques.csv';

    const csvRows = [headers.join(';')];
    data.forEach(row => {
      csvRows.push([
        row.id,
        `"${(row.name || '').replace(/"/g, '""')}"`,
        row.guests,
        row.mairie ? 'Oui' : 'Non',
        row.vin_honneur ? 'Oui' : 'Non',
        row.chabbat ? 'Oui' : 'Non',
        row.houppa ? 'Oui' : 'Non',
        `"${(row.message || '').replace(/"/g, '""')}"`,
        row.created_at
      ].join(';'));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send('\uFEFF' + csvRows.join('\n'));
  } else {
    const guests = await all(`
      SELECT g.*,
        (SELECT GROUP_CONCAT(event_name || ':' || will_attend || ':' || plus_one, '|')
         FROM event_responses WHERE guest_id = g.id) as responses
      FROM guests g
      ORDER BY g.last_name, g.first_name
    `);

    headers = ['ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Famille', 'Pays', 'Mairie', 'Vin Honneur', 'Chabbat', 'Houppa', 'Email Envoyé', 'WhatsApp Envoyé', 'SMS Envoyé', 'Date Création'];
    filename = 'invites.csv';

    const csvRows = [headers.join(';')];
    guests.forEach(row => {
      csvRows.push([
        row.id,
        `"${(row.first_name || '').replace(/"/g, '""')}"`,
        `"${(row.last_name || '').replace(/"/g, '""')}"`,
        `"${(row.email || '').replace(/"/g, '""')}"`,
        `"${(row.phone || '').replace(/"/g, '""')}"`,
        `"${(row.family || '').replace(/"/g, '""')}"`,
        `"${(row.country || '').replace(/"/g, '""')}"`,
        row.invited_to_mairie ? 'Oui' : 'Non',
        row.invited_to_vin_honneur ? 'Oui' : 'Non',
        row.invited_to_chabbat ? 'Oui' : 'Non',
        row.invited_to_houppa ? 'Oui' : 'Non',
        row.email_sent ? 'Oui' : 'Non',
        row.whatsapp_sent ? 'Oui' : 'Non',
        row.sms_sent ? 'Oui' : 'Non',
        row.created_at
      ].join(';'));
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send('\uFEFF' + csvRows.join('\n'));
  }
}));

module.exports = router;
