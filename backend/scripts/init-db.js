const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Table des invités
  db.run(`
    CREATE TABLE IF NOT EXISTS guests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
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
  db.run(`
    CREATE TABLE IF NOT EXISTS event_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_id INTEGER NOT NULL,
      event_name TEXT NOT NULL,
      will_attend BOOLEAN DEFAULT 0,
      plus_one INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guest_id) REFERENCES guests(id),
      UNIQUE(guest_id, event_name)
    )
  `);

  // Table des messages
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guest_id) REFERENCES guests(id)
    )
  `);

  // Table des reponses publiques (formulaire du site)
  db.run(`
    CREATE TABLE IF NOT EXISTS public_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      mairie BOOLEAN DEFAULT 0,
      vin_honneur BOOLEAN DEFAULT 0,
      chabbat BOOLEAN DEFAULT 0,
      houppa BOOLEAN DEFAULT 0,
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('Base de donnees initialisee avec succes!');
});

db.close();
