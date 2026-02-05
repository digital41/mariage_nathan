#!/bin/sh

# Persister la base de donnees dans le volume /data
mkdir -p /data

if [ -f /data/database.sqlite ]; then
  ln -sf /data/database.sqlite /app/backend/database.sqlite
else
  touch /data/database.sqlite
  ln -sf /data/database.sqlite /app/backend/database.sqlite
fi

exec node server.js
