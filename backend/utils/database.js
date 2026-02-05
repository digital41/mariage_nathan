const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Chemin vers la base de données
const dbPath = path.join(__dirname, '..', 'database.sqlite');

// Créer la connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err);
    process.exit(1);
  }
  console.log('Connecté à la base de données SQLite');
});

// Activer les clés étrangères
db.run('PRAGMA foreign_keys = ON');

// Wrapper promisifié pour db.run
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

// Wrapper promisifié pour db.get
const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

// Wrapper promisifié pour db.all
const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Initialisation des tables
const initDatabase = async () => {
  try {
    // Table des invités
    await run(`
      CREATE TABLE IF NOT EXISTS guests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT DEFAULT '',
        phone TEXT,
        token TEXT UNIQUE NOT NULL,
        invited_to_mairie BOOLEAN DEFAULT 0,
        invited_to_vin_honneur BOOLEAN DEFAULT 0,
        invited_to_chabbat BOOLEAN DEFAULT 0,
        invited_to_houppa BOOLEAN DEFAULT 0,
        email_sent BOOLEAN DEFAULT 0,
        email_sent_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Table des réponses aux événements
    await run(`
      CREATE TABLE IF NOT EXISTS event_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_id INTEGER NOT NULL,
        event_name TEXT NOT NULL,
        will_attend BOOLEAN DEFAULT 0,
        plus_one INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE,
        UNIQUE(guest_id, event_name)
      )
    `);

    // Table des messages
    await run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guest_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE CASCADE
      )
    `);

    // Table des réponses publiques
    await run(`
      CREATE TABLE IF NOT EXISTS public_responses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        guests INTEGER DEFAULT 1,
        mairie BOOLEAN DEFAULT 0,
        vin_honneur BOOLEAN DEFAULT 0,
        chabbat BOOLEAN DEFAULT 0,
        houppa BOOLEAN DEFAULT 0,
        message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrations : ajouter les colonnes manquantes sur les tables existantes
    const migrations = [
      { table: 'public_responses', column: 'guests', definition: 'INTEGER DEFAULT 1' },
      { table: 'public_responses', column: 'mairie', definition: 'BOOLEAN DEFAULT 0' },
      { table: 'public_responses', column: 'vin_honneur', definition: 'BOOLEAN DEFAULT 0' },
      { table: 'public_responses', column: 'chabbat', definition: 'BOOLEAN DEFAULT 0' },
      { table: 'public_responses', column: 'houppa', definition: 'BOOLEAN DEFAULT 0' },
      { table: 'public_responses', column: 'message', definition: 'TEXT' },
      { table: 'guests', column: 'phone', definition: 'TEXT' },
      { table: 'guests', column: 'email_sent', definition: 'BOOLEAN DEFAULT 0' },
      { table: 'guests', column: 'email_sent_date', definition: 'TEXT' },
      { table: 'guests', column: 'sms_sent', definition: 'BOOLEAN DEFAULT 0' },
      { table: 'guests', column: 'sms_sent_date', definition: 'TEXT' },
      { table: 'guests', column: 'whatsapp_sent', definition: 'BOOLEAN DEFAULT 0' },
      { table: 'guests', column: 'whatsapp_sent_date', definition: 'TEXT' },
      { table: 'guests', column: 'family', definition: 'TEXT' },
      { table: 'guests', column: 'country', definition: 'TEXT DEFAULT \'France\'' },
      { table: 'guests', column: 'total_guests', definition: 'INTEGER DEFAULT 1' },
    ];

    for (const migration of migrations) {
      try {
        await run(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.definition}`);
        console.log(`Migration: ajout de ${migration.column} à ${migration.table}`);
      } catch (err) {
        // La colonne existe déjà - on ignore
      }
    }

    // Index pour améliorer les performances
    await run('CREATE INDEX IF NOT EXISTS idx_guests_token ON guests(token)');
    await run('CREATE INDEX IF NOT EXISTS idx_guests_email ON guests(email)');
    await run('CREATE INDEX IF NOT EXISTS idx_event_responses_guest ON event_responses(guest_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_messages_guest ON messages(guest_id)');

    console.log('Base de données initialisée avec succès');
  } catch (err) {
    console.error('Erreur lors de l\'initialisation de la base de données:', err);
    throw err;
  }
};

// Fermer proprement la base de données
const closeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err);
      } else {
        console.log('Connexion à la base de données fermée');
        resolve();
      }
    });
  });
};

module.exports = {
  db,
  run,
  get,
  all,
  initDatabase,
  closeDatabase
};
