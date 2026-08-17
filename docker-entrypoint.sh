#!/bin/sh
set -e

# Auf die Datenbank warten und Migrationen anwenden (bei Fehlern mehrfach versuchen)
echo "Wende Datenbank-Migrationen an …"
tries=0
until node_modules/.bin/payload migrate; do
  tries=$((tries + 1))
  if [ "$tries" -ge 10 ]; then
    echo "Migrationen nach 10 Versuchen fehlgeschlagen — Abbruch." >&2
    exit 1
  fi
  echo "Datenbank noch nicht erreichbar, neuer Versuch in 3s …"
  sleep 3
done

# Optional: Startdaten einspielen (SEED=true im Stack setzen, nur beim ersten Start)
if [ "$SEED" = "true" ]; then
  echo "Führe Seed aus …"
  node_modules/.bin/payload run scripts/seed.ts || echo "Seed fehlgeschlagen oder bereits vorhanden."
fi

echo "Starte Next.js …"
exec node_modules/.bin/next start -p "${PORT:-3000}"
