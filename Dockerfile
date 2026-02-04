FROM node:20-alpine

WORKDIR /app

# Copier les fichiers package
COPY backend/package*.json ./

# Installer les dependances
RUN npm ci --production

# Copier le code backend
COPY backend/ ./

# Copier les fichiers statiques du frontend
COPY public/ ./public/

# Creer les dossiers pour les volumes
RUN mkdir -p logs data

# Exposer le port
EXPOSE 3000

# Demarrer l'application
CMD ["node", "server.js"]
