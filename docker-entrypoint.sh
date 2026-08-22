#!/bin/sh
set -e

# Website und Büro laufen aus demselben Abbild in getrennten Containern.
# Alles, was es genau einmal geben darf — Migrationen, Startdaten, Zugänge —,
# erledigt der Web-Container. Liefe es in beiden, würden sie einander bei der
# Schema-Änderung in die Quere kommen.

# Sind die Volumes überhaupt beschreibbar?
#
# Ein Volume behält die Eigentümerschaft dessen, der es zuerst angefasst hat.
# Hing früher ein anderer Container daran — etwa ein Sicherungs-Beiwagen aus
# einem Postgres-Abbild —, gehört es dessen Benutzer, und dieser hier (node,
# UID 1000) darf nicht hinein. Das fällt sonst erst auf, wenn jemand auf
# „Jetzt sichern" drückt und einen tar-Fehler zu lesen bekommt, oder gar nicht:
# Die nächtliche Sicherung scheitert still, und niemand vermisst sie, bis sie
# gebraucht wird.
pruefe_schreibbar() {
  verzeichnis="$1"
  zweck="$2"
  mkdir -p "$verzeichnis" 2>/dev/null
  if ! touch "$verzeichnis/.probe" 2>/dev/null; then
    echo "WARNUNG: $verzeichnis ist nicht beschreibbar — $zweck wird scheitern." >&2
    echo "         Einmalig auf dem Server beheben, der Stack darf dabei laufen:" >&2
    echo "         docker run --rm -v <stack>_$(basename "$verzeichnis"):/v alpine chown -R 1000:1000 /v" >&2
  else
    rm -f "$verzeichnis/.probe"
  fi
}

pruefe_schreibbar /app/backups "die Sicherung"
pruefe_schreibbar /app/media "das Hochladen von Bildern"

if [ "$ROLLE" = "buero" ]; then
  echo "Rolle buero: Migrationen und Startdaten macht der Web-Container."
  echo "Starte Server …"
  exec node server.mjs
fi

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

# Optional: Startdaten einspielen (SEED=true im Stack setzen).
#
# Das Skript sieht selbst nach, ob die Datenbank schon eingerichtet ist, und
# tut dann nichts. Ein `SEED=true`, das im Stack stehen geblieben ist, richtet
# damit keinen Schaden mehr an — früher trug es bei jedem Ausrollen gelöschte
# Beispielinhalte wieder nach.
if [ "$SEED" = "true" ]; then
  echo "Prüfe Startdaten …"
  node_modules/.bin/payload run scripts/seed.ts || echo "Seed fehlgeschlagen."
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

echo "Starte Server …"
exec node server.mjs
