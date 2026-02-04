# Backend - Mariage Dvora & Nathan

Backend Node.js/Express pour gérer les invitations personnalisées au mariage.

## Fonctionnalités

- ✅ Gestion de base de données SQLite pour les invités
- ✅ Génération de pages d'invitation personnalisées avec token unique
- ✅ Envoi d'emails personnalisés avec Nodemailer
- ✅ Interface d'administration pour gérer les invités
- ✅ API REST pour les réponses aux invitations
- ✅ Système de tracking des réponses et messages

## Installation

### 1. Installer Node.js

Téléchargez et installez Node.js depuis https://nodejs.org/ (version LTS recommandée)

### 2. Installer les dépendances

```bash
cd backend
npm install
```

### 3. Configuration

Copiez le fichier `.env.example` vers `.env` et modifiez les paramètres:

```bash
copy .env.example .env
```

Éditez le fichier `.env` avec vos paramètres:

```env
PORT=3000
NODE_ENV=development

# Configuration email Gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=votre-email@gmail.com
EMAIL_PASS=votre-mot-de-passe-application

EMAIL_FROM=Dvora & Nathan <votre-email@gmail.com>

SITE_URL=http://localhost:3000

# Mot de passe admin
ADMIN_PASSWORD=VotreMotDePasseSecurise123
```

#### Configuration Gmail:

1. Allez dans votre compte Google: https://myaccount.google.com/
2. Sécurité → Validation en deux étapes (activez-la si ce n'est pas fait)
3. Sécurité → Mots de passe des applications
4. Générez un mot de passe pour "Autre (nom personnalisé)"
5. Utilisez ce mot de passe dans `EMAIL_PASS`

### 4. Initialiser la base de données

```bash
npm run init-db
```

### 5. Démarrer le serveur

Mode développement (redémarre automatiquement):
```bash
npm run dev
```

Mode production:
```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`

## Utilisation

### Interface Admin

Accédez à: `http://localhost:3000/admin`

Connectez-vous avec le mot de passe défini dans `.env`

Fonctionnalités:
- Ajouter/modifier/supprimer des invités
- Envoyer des invitations par email
- Voir les statistiques
- Consulter les réponses et messages

### Ajouter des invités

1. Ouvrez l'interface admin
2. Cliquez sur "Ajouter un invité"
3. Renseignez les informations
4. Sélectionnez les événements auxquels l'invité est convié
5. Sauvegardez

### Envoyer les invitations

**Option 1 - Email individuel:**
- Dans la liste des invités, cliquez sur "Envoyer" pour chaque invité

**Option 2 - Envoi groupé:**
1. Cochez les invités à qui envoyer
2. Cliquez sur "Envoyer emails sélectionnés"
3. Confirmez

Chaque invité recevra un email avec un lien unique vers son invitation personnalisée.

### URLs des invitations

Format: `http://localhost:3000/invitation/[TOKEN-UNIQUE]`

Exemple: `http://localhost:3000/invitation/a1b2c3d4-e5f6-7890-abcd-ef1234567890`

## Structure du projet

```
backend/
├── routes/
│   ├── admin.js          # Routes admin (CRUD invités, stats)
│   ├── guests.js         # Routes invités (récupération, réponses)
│   └── email.js          # Routes emails (envoi individuel/groupé)
├── scripts/
│   └── init-db.js        # Script d'initialisation base de données
├── views/
│   └── invitation.ejs    # Template invitation personnalisée
├── public/
│   └── admin.html        # Interface d'administration
├── server.js             # Serveur Express principal
├── package.json          # Dépendances npm
├── .env                  # Configuration (à créer)
└── database.sqlite       # Base de données (créée automatiquement)
```

## API Endpoints

### Invités
- `GET /api/guests/:token` - Récupérer un invité par token
- `POST /api/guests/:token/response` - Enregistrer une réponse

### Admin (nécessite mot de passe dans header)
- `GET /api/admin/guests` - Liste des invités
- `POST /api/admin/guests` - Créer un invité
- `PUT /api/admin/guests/:id` - Modifier un invité
- `DELETE /api/admin/guests/:id` - Supprimer un invité
- `GET /api/admin/stats` - Statistiques
- `GET /api/admin/responses` - Toutes les réponses
- `GET /api/admin/messages` - Tous les messages

### Email (nécessite mot de passe dans header)
- `POST /api/email/send/:guestId` - Envoyer email à un invité
- `POST /api/email/send-bulk` - Envoyer emails groupés
- `GET /api/email/test` - Tester configuration email

## Base de données

### Table `guests`
- id, first_name, last_name, email, phone
- token (unique par invité)
- invited_to_mairie, invited_to_vin_honneur, invited_to_chabbat, invited_to_houppa
- email_sent, email_sent_date
- created_at

### Table `event_responses`
- id, guest_id, event_name
- will_attend, plus_one
- created_at

### Table `messages`
- id, guest_id, message
- created_at

## Déploiement en production

### Option 1 - Serveur VPS (Digital Ocean, OVH, etc.)

1. Installer Node.js sur le serveur
2. Transférer les fichiers
3. Installer les dépendances: `npm install --production`
4. Utiliser PM2 pour gérer le processus:

```bash
npm install -g pm2
pm2 start server.js --name mariage-backend
pm2 startup
pm2 save
```

5. Configurer un reverse proxy Nginx
6. Activer HTTPS avec Let's Encrypt

### Option 2 - Heroku

1. Créer une app Heroku
2. Ajouter les variables d'environnement
3. Déployer avec Git

### Option 3 - Vercel / Netlify Functions

Adapter le code pour utiliser des fonctions serverless.

## Sécurité

- ✅ Tokens uniques par invité (UUID v4)
- ✅ Authentification admin par mot de passe
- ⚠️ Pour production, améliorer:
  - Utiliser JWT pour l'admin
  - Ajouter rate limiting
  - Activer HTTPS
  - Hash le mot de passe admin

## Support

Pour toute question ou problème:
1. Vérifiez les logs du serveur
2. Testez la configuration email: `GET /api/email/test`
3. Vérifiez que la base de données est initialisée

## License

Privé - Usage personnel uniquement
