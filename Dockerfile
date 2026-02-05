FROM node:20-alpine

WORKDIR /app

# Installer les deps de compilation pour sqlite3
RUN apk add --no-cache python3 make g++ sqlite-dev

# Copier et installer les dependances
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Nettoyer les deps de compilation
RUN apk del python3 make g++

# Copier le code
COPY backend/ ./backend/
COPY public/ ./public/

# Creer les dossiers necessaires
RUN mkdir -p backend/logs /data

# Copier l'entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 3000

WORKDIR /app/backend
ENTRYPOINT ["/entrypoint.sh"]
