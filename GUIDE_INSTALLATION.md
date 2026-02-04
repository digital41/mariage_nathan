# Guide d'Installation - Site Mariage Dvora & Nathan

## Vue d'ensemble

Vous disposez maintenant d'un système complet pour gérer les invitations de mariage avec:
- ✅ Site web statique personnalisé (sans références HTTrack/Invitee)
- ✅ Backend Node.js pour gérer les invités
- ✅ Envoi d'emails personnalisés avec liens uniques
- ✅ Interface admin pour tout gérer
- ✅ Base de données pour tracking des réponses

## Installation Rapide (5 minutes)

### Étape 1: Installer Node.js

1. Téléchargez Node.js: https://nodejs.org/
2. Choisissez la version LTS (Long Term Support)
3. Installez avec les paramètres par défaut
4. Vérifiez l'installation:
   ```bash
   node --version
   npm --version
   ```

### Étape 2: Configuration Email

Pour Gmail:
1. Connectez-vous à https://myaccount.google.com/
2. Menu "Sécurité"
3. Activez la "Validation en deux étapes"
4. Allez dans "Mots de passe des applications"
5. Créez un mot de passe pour "Autre" → "Mariage"
6. Copiez le mot de passe généré (16 caractères)

### Étape 3: Configuration du Backend

1. Ouvrez un terminal dans le dossier `backend`:
   ```bash
   cd backend
   ```

2. Installez les dépendances:
   ```bash
   npm install
   ```

3. Créez le fichier de configuration:
   ```bash
   copy .env.example .env
   ```

4. Éditez `.env` avec un éditeur de texte:
   ```env
   PORT=3000
   EMAIL_USER=votre-email@gmail.com
   EMAIL_PASS=mot-de-passe-application-16-caracteres
   EMAIL_FROM=Dvora & Nathan <votre-email@gmail.com>
   SITE_URL=http://localhost:3000
   ADMIN_PASSWORD=ChoisissezUnMotDePasseSecurise123
   ```

5. Initialisez la base de données:
   ```bash
   npm run init-db
   ```

6. Démarrez le serveur:
   ```bash
   npm start
   ```

### Étape 4: Accéder à l'Admin

1. Ouvrez votre navigateur
2. Allez à: `http://localhost:3000/admin`
3. Connectez-vous avec le mot de passe défini dans `.env`

## Utilisation

### Ajouter des invités

1. Dans l'admin, cliquez "Ajouter un invité"
2. Renseignez:
   - Prénom, Nom, Email
   - Cochez les événements auxquels il/elle est invité(e)
3. Sauvegardez

### Envoyer les invitations

**Méthode 1 - Un par un:**
- Cliquez sur "Envoyer" à côté de chaque invité

**Méthode 2 - Groupée:**
1. Cochez les invités
2. Cliquez "Envoyer emails sélectionnés"

Chaque invité reçoit un email avec un lien unique vers sa page personnalisée.

### Voir les réponses

- Onglet "Réponses": Qui participe à quels événements
- Onglet "Messages": Messages personnels des invités

## Structure des Fichiers

```
Mariage_Nathan/
│
├── index.html                          # Page d'accueil (redirige vers l'invitation)
├── www.invitee.fr/mariage/dvora-nathan/
│   └── 6841923e08825.html             # Site principal (nettoyé)
│
├── backend/                            # ⭐ BACKEND
│   ├── server.js                       # Serveur principal
│   ├── package.json                    # Dépendances
│   ├── .env                            # Configuration (À CRÉER)
│   ├── database.sqlite                 # Base de données (auto-créée)
│   ├── routes/                         # API
│   │   ├── admin.js                    # Gestion invités
│   │   ├── guests.js                   # Réponses invités
│   │   └── email.js                    # Envoi emails
│   ├── views/
│   │   └── invitation.ejs              # Template invitation personnalisée
│   ├── public/
│   │   └── admin.html                  # Interface admin
│   └── scripts/
│       └── init-db.js                  # Init base de données
│
└── assets/                             # CSS, JS, images du site
```

## Commandes Utiles

```bash
# Démarrer le serveur
npm start

# Mode développement (redémarre automatiquement)
npm run dev

# Réinitialiser la base de données
npm run init-db

# Voir les logs en temps réel
# (dans le terminal où tourne le serveur)
```

## Tester le Système

### Test 1: Configuration Email
```
GET http://localhost:3000/api/email/test
Headers: password: VotreMotDePasseAdmin
```

Si OK, vous verrez: `{"success":true,"message":"Configuration email valide"}`

### Test 2: Ajouter un invité test

1. Ajoutez-vous comme invité de test
2. Envoyez-vous l'invitation
3. Vérifiez que vous recevez l'email
4. Cliquez sur le lien dans l'email
5. Remplissez le formulaire de réponse
6. Vérifiez dans l'admin que la réponse est enregistrée

## Problèmes Courants

### "npm n'est pas reconnu"
→ Redémarrez votre terminal après l'installation de Node.js

### "Erreur configuration email"
→ Vérifiez que vous utilisez bien un mot de passe d'application Gmail (pas votre mot de passe normal)

### "Port 3000 déjà utilisé"
→ Changez le PORT dans `.env` (ex: 3001)

### "Erreur base de données"
→ Supprimez `database.sqlite` et relancez `npm run init-db`

## Conseils

### Sauvegarde
Sauvegardez régulièrement:
- `backend/database.sqlite` (vos invités et réponses)
- `backend/.env` (votre configuration)

### Test avant envoi massif
Avant d'envoyer à tous les invités:
1. Créez 2-3 invités de test
2. Envoyez-leur les invitations
3. Testez le formulaire de réponse
4. Vérifiez les emails et les réponses

### Personnalisation

Vous pouvez personnaliser:
- Le template email dans `backend/routes/email.js`
- La page d'invitation dans `backend/views/invitation.ejs`
- L'interface admin dans `backend/public/admin.html`

## Déploiement en Production

### Option Simple: Serveur VPS

1. Louez un serveur (Digital Ocean, OVH, etc.)
2. Installez Node.js sur le serveur
3. Transférez vos fichiers
4. Lancez avec PM2:
   ```bash
   npm install -g pm2
   pm2 start server.js --name mariage
   pm2 startup
   pm2 save
   ```
5. Configurez un nom de domaine
6. Activez HTTPS avec Let's Encrypt

### Option Gratuite: Heroku / Render.com

1. Créez un compte gratuit
2. Liez votre projet Git
3. Configurez les variables d'environnement
4. Déployez

## Support

Si vous rencontrez des problèmes:
1. Vérifiez les logs du serveur (terminal)
2. Testez la configuration email
3. Vérifiez le fichier `.env`
4. Consultez le README du backend

## Modifications Effectuées

### Site Web
- ✅ Supprimé toutes les références HTTrack
- ✅ Supprimé toutes les références invitee.fr
- ✅ Retiré les scripts de tracking tiers (Smartlook, Google Analytics)
- ✅ Nettoyé le footer

### Backend Créé
- ✅ Serveur Express.js
- ✅ Base de données SQLite
- ✅ Système d'envoi d'emails personnalisés
- ✅ Interface admin complète
- ✅ API REST pour les réponses
- ✅ Génération de tokens uniques par invité

## Prochaines Étapes

1. [ ] Installer Node.js
2. [ ] Configurer Gmail
3. [ ] Lancer le backend
4. [ ] Tester avec un invité
5. [ ] Ajouter tous vos invités
6. [ ] Envoyer les invitations
7. [ ] Suivre les réponses dans l'admin

Bon mariage! 💍
