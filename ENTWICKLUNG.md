# Entwicklungsumgebung auf dem eigenen Rechner

Diese Anleitung richtet den kompletten Stand auf einem Windows- oder
Mac-Rechner mit **Docker Desktop** ein. Sie ist für Dominik geschrieben, nicht
für Claude.

## Wozu

Bisher hatten die drei Ebenen eine Lücke:

```
claude/<thema>   →   develop   →   main
   (Arbeit)        (Sammlung)    (veröffentlicht)
```

`develop` war eine Sammelstelle, die **nirgends lief**. Geprüft wurde der
Quelltext — Typen, Regeln, Playwright gegen einen von Hand gestarteten Server.
Alles richtig, aber der Weg, den der Betrieb wirklich geht, blieb ungeprüft:
das Abbild bauen, der Containerstart, `payload migrate` gegen eine frische
Datenbank, die Volumes. Genau dort ist es schon zweimal schiefgegangen — eine
Migration, die eine Spalte vergaß, fällt erst auf, wenn ein Container mit
leerer Datenbank hochkommt.

**Ab jetzt gilt: `develop` wird gebaut und ausprobiert, `main` geht in
Produktion.** Was hier durchläuft, hat den Ausrollweg schon einmal hinter sich.

## Einmalig einrichten

Voraussetzung ist **Docker Desktop** (Windows: mit WSL2-Backend) und **Git**.

```bash
git clone https://github.com/DomCim/vh-website.git
cd vh-website
git checkout develop
```

Dann eine `.env` anlegen. Für den eigenen Rechner reichen vier Zeilen — alles
Weitere (SMTP, PayPal, Facebook) pflegt man bequemer im Admin unter
Verwaltung → Integrationen:

```dotenv
NEXT_PUBLIC_SERVER_URL=http://localhost:8001
PAYLOAD_SECRET=<irgendetwas Langes, z. B. openssl rand -hex 32>
POSTGRES_PASSWORD=vh
PORT=8001
```

Starten:

```bash
docker compose -f docker-compose.entwicklung.yml up -d --build
```

Der erste Lauf dauert ein paar Minuten — das Abbild wird gebaut, nicht
gezogen. Danach steht alles unter **http://localhost:8001**:
Website `/de`, Admin `/admin`, Büro `/office`.

### Was beim ersten Start von selbst passiert

Der Einstiegspunkt (`docker-entrypoint.sh`) wendet die **Migrationen** an und
wartet dabei geduldig auf die Datenbank. Zusätzlich sind in der
Entwicklungsfassung zwei Schalter voreingestellt, die im Betrieb aus sind:

- `SEED=true` — spielt Beispielinhalte ein. Das Skript sieht selbst nach, ob
  die Datenbank schon eingerichtet ist, und tut dann nichts.
- `BENUTZER=true` — legt die beiden Büro-Zugänge an. Ohne gesetzte Passwörter
  würfelt es sie und schreibt sie **ins Log**:

```bash
docker compose -f docker-compose.entwicklung.yml logs app | grep -A3 Zugänge
```

Wer feste Passwörter will, trägt `VH_PASSWORT` und `ADMIN_PASSWORT` in die
`.env` ein. Vorhandene Konten werden nie überschrieben.

## Der Port und die Firewall

Der Stack veröffentlicht **8001** (8000 ist auf dem Firmenrechner belegt).
Beim ersten Start fragt die Windows-Firewall, ob Docker Verbindungen annehmen
darf — **nur „Private Netzwerke" ankreuzen, „Öffentliche Netzwerke" nicht.**

Das ist mehr als eine Formalie, denn es entscheidet, wer drankommt:

- **Privat** heißt: Geräte im selben WLAN. Also der Firmenrechner selbst und
  — das ist der eigentliche Gewinn — **das iPhone.**
- **Öffentlich** hieße: auch fremde Netze, in denen der Rechner unterwegs ist.
  Ein Stack mit Beispieldaten und geratenen Passwörtern gehört dort nicht hin.

### Warum das iPhone der wichtigste Teil ist

Die Meldungen #38, #40 und #42 waren allesamt iPhone-Eigenheiten: die
Zubehörleiste über der Tastatur, der Sichtbereich, der sich verschiebt statt
zu schrumpfen, der Dateidialog, der mal geht und mal nicht. **Kein Chromium
der Welt stellt das nach** — deshalb sind diese Fehler überhaupt erst im
Betrieb aufgefallen. Mit dem Stack im WLAN lässt sich das Handy auf einen
Stand richten, der noch nicht ausgerollt ist.

Dafür muss die Adresse aber die des Rechners sein und nicht `localhost` —
sonst zeigen alle Links und Bilder ins Leere:

```dotenv
NEXT_PUBLIC_SERVER_URL=http://192.168.x.y:8001
```

(die eigene Adresse mit `ipconfig` bzw. `ifconfig` nachsehen; nach der
Änderung `up -d` erneut ausführen).

**Zwei Dinge gehen über `http://` nicht**, und das ist keine Fehlfunktion des
Stacks: **Passkeys** und die **Zwischenablage für Bilder** verlangen einen
gesicherten Zusammenhang. Der Browser erlaubt beides nur über `https://` oder
auf `localhost`. Passwort-Anmeldung und der normale Dateidialog funktionieren.

## Was das für Claude bedeutet — und was nicht

Ehrlich, damit die Erwartung stimmt: **Ein offener Port im privaten Netz
erreicht Claude nicht.** Claude läuft nicht auf dem Firmenrechner, sondern in
einem Rechenzentrum. Zwischen beiden liegt der Router, und der reicht von
außen nichts durch. Dafür bräuchte es einen Tunnel (Cloudflare Tunnel,
Tailscale) — machbar, aber eine eigene Entscheidung, und eine Weiterleitung
im Router wäre für einen Stack mit Beispieldaten der falsche Weg.

Gebraucht wird das aber gar nicht: **Claude kann Docker in seiner eigenen
Sitzung fahren** — nachgemessen am 24.08.2026: der Dienst startet, `compose`
ist da, Abbilder lassen sich ziehen und bauen. Seeds, Migrationen gegen eine
frische Datenbank, Volume- und Sicherungsprüfungen laufen also dort, ohne dass
hier etwas offenstehen muss.

Die Arbeitsteilung ist damit:

| | Claude in seiner Sitzung | Dieser Rechner |
|---|---|---|
| Bauen, Migrationen, Volumes, Seeds | ✅ | ✅ |
| Playwright, Chromium | ✅ | ✅ |
| **Echtes iPhone** | ❌ | ✅ |
| Draufschauen, ausprobieren, Gefühl bekommen | ❌ | ✅ |

Die untersten beiden Zeilen sind der Grund, aus dem sich das lohnt.

## Im Alltag

```bash
# Neuen Stand holen und bauen
git pull && docker compose -f docker-compose.entwicklung.yml up -d --build

# Was sagt der Container?
docker compose -f docker-compose.entwicklung.yml logs -f app

# Alles zurück auf Anfang (Datenbank UND hochgeladene Dateien weg)
docker compose -f docker-compose.entwicklung.yml down -v

# Nur die Beispielinhalte nachtragen
docker compose -f docker-compose.entwicklung.yml exec app \
  node_modules/.bin/payload run scripts/seed.ts
```

`down -v` löscht die Volumes und damit alles Eingegebene. Das ist hier
erwünscht — genau so prüft man, ob ein Containerstart auf einer **leeren**
Datenbank durchläuft, und das ist die Frage, die dieser Aufbau beantworten
soll.

## Was hier nicht hineingehört

Keine echten Zugangsdaten, keine Produktionsdaten. Der Stack ist zum
Ausprobieren da: geratene Passwörter, Beispielinhalte, ein offener Port im
WLAN. Wer eine Sicherung aus dem Betrieb einspielt, hat auf einmal die Daten
der Kundschaft auf einem Laptop liegen.
