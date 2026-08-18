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

# Optional: Büro-Zugänge anlegen (BENUTZER=true im Stack setzen, danach wieder
# entfernen). Vorhandene Konten bleiben unangetastet; ohne VH_PASSWORT bzw.
# ADMIN_PASSWORT würfelt das Skript die Passwörter und zeigt sie hier im Log.
if [ "$BENUTZER" = "true" ]; then
  echo "Lege Büro-Zugänge an …"
  node_modules/.bin/payload run scripts/benutzer.ts || echo "Anlegen der Zugänge fehlgeschlagen."
fi

# Optional: Englische Übersetzungen der Seed-Inhalte einspielen (einmalig TRANSLATE_EN=true)
if [ "$TRANSLATE_EN" = "true" ]; then
  echo "Spiele EN-Übersetzungen ein …"
  node_modules/.bin/payload run scripts/translate-en.ts || echo "EN-Übersetzung fehlgeschlagen."
fi

echo "Starte Next.js …"
exec node_modules/.bin/next start -p "${PORT:-3000}"
