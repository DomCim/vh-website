# Vincent Hellmann — Website & Shop

Neuaufbau von [vincent-hellmann.com](https://www.vincent-hellmann.com) als moderne, selbst verwaltbare Website mit Online-Shop — ohne TYPO3.

**Stack:** Next.js 15 · Payload CMS 3 (Admin-Backend unter `/admin`) · PostgreSQL · Tailwind CSS 4 · Motion (Scroll-Animationen) · Stripe Checkout · PayPal · Docker/Traefik

## Funktionen

- **1:1-Design** angelehnt an die bestehende Website (Logo, Navigation, Hero-Slider, dunkler Footer), veredelt mit dezenten Scroll-Animationen
- **Dreisprachig** Deutsch/Französisch/Englisch — alle Inhalte im Backend übersetzbar (Fallback: Deutsch)
- **Shop** mit Varianten (Größen), Farboptionen (RAL), **Versandkosten je Artikel**, Warenkorb, **Lieferung oder Abholung** und Checkout via **Stripe** (Karte, Apple/Google Pay, Klarna) oder **PayPal**; Produkte optional „nur auf Anfrage" mit direktem **Anfrage-Formular am Produkt**
- **Bestellverwaltung** im Admin (offen → bezahlt → versendet) mit Trackingnummer; **automatische Versand-Mail** beim Umstellen auf „versendet", Bestätigungs-Mail an Kunden + Benachrichtigung an euch
- **News & Ratgeber** mit optionalem **Facebook- und Instagram-Autopost** beim Veröffentlichen; Ratgeber-Artikel als dauerhafter SEO-Content
- **Referenzen** (Projekte für Kommunen/Gewerbe/Privat) mit Filter und Startseiten-Teaser; **Über-uns-Seite** mit Timeline; **Kundenstimmen** (nur echte!) auf Startseite und Produktseiten; optionales **Video im Hero**
- **Aktionen**: Prozent-/Festrabatte mit Zeitraum, auf alles/Kategorien/Produkte, optional mit Gutscheincode; automatische Anwendung im Warenkorb + Banner auf der Startseite
- **SEO**: Sitemap, robots.txt, hreflang, Open Graph, schema.org-Produktdaten (Google Rich Results)
- **Kontaktformular** mit Mailversand
- **Betrieb**: `/api/healthz` für Monitoring, tägliche DB-Backups (pg_dump-Sidecar, letzte 14 Dumps im Volume `backups`)

## Lokale Entwicklung

```bash
pnpm install
cp .env.example .env        # Werte anpassen (mind. PAYLOAD_SECRET, DATABASE_URI)
pnpm seed                   # Startdaten inkl. Bilder einspielen (einmalig)
pnpm dev                    # http://localhost:3000, Admin: /admin
```

Es wird eine erreichbare PostgreSQL-Datenbank benötigt (`DATABASE_URI`). Im Dev-Modus synchronisiert Payload das Schema automatisch; in Produktion laufen Migrationen (`src/migrations/`) beim Containerstart.

Nach Schema-Änderungen an Collections: `pnpm generate:types` und `pnpm payload migrate:create <name>` ausführen und die Migration mit committen.

## Deployment (Portainer + Traefik + Nginx Proxy Manager)

Die Kette: **vh.dominikdill.com → Nginx Proxy Manager (TLS) → Traefik (Netzwerk `edge`) → Container**

1. **Image**: Der GitHub-Actions-Workflow (`.github/workflows/docker.yml`) baut bei jedem Push auf `main` das Image und pusht es nach `ghcr.io/domcim/vh-website:latest`.
   Ist das GitHub-Package privat, in Portainer eine Registry-Anmeldung für `ghcr.io` hinterlegen (GitHub-Token mit `read:packages`).
2. **Stack anlegen**: In Portainer → Stacks → „Add stack" → Repository `domcim/vh-website` (Compose-Pfad `docker-compose.yml`) oder Inhalt der Datei einfügen.
3. **Umgebungsvariablen** im Stack setzen — Minimum:
   - `PAYLOAD_SECRET` (z.B. `openssl rand -hex 32`)
   - `POSTGRES_PASSWORD`
   - `SEED=true` **nur beim allerersten Start** (spielt Kategorien, Produkte, Bilder usw. ein; danach wieder auf `false`)
   - optional: SMTP-, Stripe- und Facebook-Variablen (siehe `.env.example`)
4. **NPM-Weiterleitung**: `vh.dominikdill.com` als Proxy-Host auf Traefik zeigen lassen (TLS im NPM). Traefik routet über das Label `Host(vh.dominikdill.com)` auf den Container (Entrypoint per `TRAEFIK_ENTRYPOINT`, Standard `web`).
5. **Erster Login**: `https://vh.dominikdill.com/admin` — Zugangsdaten aus dem Seed (`admin@vincent-hellmann.com` / `change-me-123`) → **Passwort sofort ändern!**

**Persistenz:** Uploads liegen im Volume `media` (`/app/media`), die Datenbank im Volume `dbdata`. Beide überleben Updates — für Backups diese beiden Volumes sichern (DB z.B. per `pg_dump`).

**Update:** Neues Image wird bei Push auf `main` gebaut → in Portainer „Re-pull image & redeploy". Migrationen laufen automatisch beim Start.

## Stripe einrichten

1. [Stripe-Konto](https://dashboard.stripe.com) → API-Keys → `STRIPE_SECRET_KEY` setzen (erst Test-, später Live-Key).
2. Webhook-Endpunkt anlegen: `https://vh.dominikdill.com/api/stripe-webhook`, Event `checkout.session.completed` → Signing-Secret als `STRIPE_WEBHOOK_SECRET` setzen.
3. Testbestellung mit Karte `4242 4242 4242 4242` durchführen — die Bestellung muss im Admin auf „Bezahlt" springen.

Ohne Stripe-Keys funktioniert die Website vollständig, nur der Checkout meldet dann einen Fehler.

## PayPal einrichten (optional)

1. [PayPal Developer](https://developer.paypal.com) → REST-App erstellen (Business-Konto nötig) → Client-ID + Secret.
2. Im Admin unter **Verwaltung → Integrationen → PayPal** eintragen; zum Testen Sandbox-Zugangsdaten + Haken „Sandbox-Modus".
3. Sobald Zugangsdaten hinterlegt sind, erscheint PayPal automatisch als Zahlungsart in der Kasse. Die Zahlung wird beim Rücksprung auf die Danke-Seite server-seitig eingezogen (Capture).

## Facebook- & Instagram-Autopost einrichten (optional)

1. [Meta for Developers](https://developers.facebook.com) → App erstellen (Typ „Business").
2. Berechtigungen `pages_manage_posts` + `pages_read_engagement` (für Instagram zusätzlich `instagram_content_publish`) für die Facebook-Seite erteilen und einen **langlebigen Page Access Token** erzeugen.
3. Im Admin unter **Verwaltung → Integrationen** eintragen: Facebook-Seiten-ID, Token und — für Instagram — die ID des mit der Seite verknüpften **Instagram-Business-Kontos**.
4. Bei einem News-Beitrag die Checkboxen „auf Facebook posten" / „auf Instagram posten" aktivieren — nach dem Veröffentlichen erscheinen die Post-IDs (oder Fehlermeldungen) in der Seitenleiste des Beitrags. Instagram benötigt zwingend ein Titelbild.

## Steuern (TVA)

Die Preise im Shop sind Bruttopreise. Auf Bestellbestätigungen wird die enthaltene MwSt./TVA ausgewiesen und die Fußzeile trägt die Pflichtangaben — dafür im Admin unter **Website-Einstellungen → Firmen-/Steuerangaben** pflegen: SIRET-Nummer, TVA-Nummer und Steuersatz (Frankreich: 20 %).

**Wichtig (mit dem Steuerberater/Expert-Comptable klären, keine Steuerberatung):** Beim Verkauf an Privatkunden in anderen EU-Ländern gilt ab 10.000 € Fernverkaufsumsatz pro Jahr EU-weit das **OSS-Verfahren** — dann ist z.B. für deutsche Kunden deutsche USt. abzuführen. Bis dahin gilt die französische TVA.

## Pinterest einrichten (optional)

Möbel- und Garteninhalte funktionieren auf Pinterest hervorragend, und die Produktseiten liefern bereits alle Daten für Rich Pins.

1. Pinterest-**Business-Konto** anlegen und unter Einstellungen → „Website beanspruchen" den Meta-Tag-Code kopieren (nur den `content`-Wert).
2. Code im Admin unter **Website-Einstellungen → Pinterest-Verifizierungscode** eintragen — das Meta-Tag erscheint automatisch auf allen Seiten.
3. In Pinterest die Verifizierung abschließen und Produktbilder pinnen bzw. pinnen lassen.

## MCP-Server (Verwaltung per KI-Assistent, optional)

Die Website bringt einen eingebauten MCP-Server mit, über den sich Shop und Inhalte per Claude (oder anderem MCP-Client) verwalten lassen — Produkte anlegen/ändern, News verfassen (inkl. Facebook-Post), Aktionen starten, Bestellungen einsehen und Status setzen, Shop-Statistik abrufen.

1. Im Portainer-Stack `MCP_API_KEY` setzen (z.B. `openssl rand -hex 24`). Ohne Schlüssel ist der Endpunkt deaktiviert (503).
2. Endpunkt: `https://vh.dominikdill.com/api/mcp` (Streamable HTTP).
3. Verbinden:
   - **claude.ai / Cowork** (Custom Connector, ohne Header-Support): URL mit Schlüssel als Query-Parameter angeben — `https://vh.dominikdill.com/api/mcp?key=<MCP_API_KEY>`
   - **Claude Code**: `claude mcp add --transport http vh-website https://vh.dominikdill.com/api/mcp --header "Authorization: Bearer <MCP_API_KEY>"`

Der Schlüssel gewährt vollen Verwaltungszugriff — wie ein Admin-Passwort behandeln.

## Inhalte pflegen (Kurzanleitung Redaktion)

Alles unter `https://vh.dominikdill.com/admin`:

| Bereich | Was |
|---|---|
| **Produkte** | Titel, Bilder, Preis, Varianten (z.B. Größen), Farboptionen, „nur auf Anfrage", „auf Startseite hervorheben". Sprachumschalter oben rechts für die französische Fassung. |
| **Kategorien** | Menüpunkte der Website (Reihenfolge über Feld „Reihenfolge"); Unterkategorien über „Übergeordnete Kategorie". |
| **News** | Beiträge mit Titelbild und Teaser; als Entwurf speichern oder veröffentlichen; optional Facebook-Checkbox. |
| **Aktionen** | Rabatt (% oder €), Zeitraum, Geltungsbereich, optional Gutscheincode. Aktive Aktionen erscheinen automatisch als Banner + im Warenkorb. |
| **Bestellungen** | Eingegangene Bestellungen mit Status-Pflege (bezahlt/versendet/storniert). |
| **Startseite** | Hero-Slider, Mission, Galerie, Highlights, Werte. |
| **Website-Einstellungen** | Kontaktdaten, Social-Media-Links, SEO-Standardwerte. |
| **Rechtliches** | Impressum, Datenschutzerklärung, AGB. |
| **Integrationen** | SMTP-Zugangsdaten, Stripe-Keys und Facebook-Token — direkt im Admin pflegbar (nur für eingeloggte Benutzer sichtbar). Leere Felder fallen auf die Umgebungsvariablen zurück. |

Das Admin-Panel ist responsiv und auch am Handy nutzbar. Die Inhaltsfelder (News, Produkte, Referenzen …) sind vollwertige Rich-Text-Editoren mit fester Toolbar: Überschriften, Fett/Kursiv, Listen, Links und Bilder mitten im Text (Upload-Button in der Toolbar). URL-Slugs können leer gelassen werden — sie entstehen automatisch aus dem Titel.

## Nach dem ersten Deployment zu erledigen

- [ ] Admin-Passwort ändern
- [ ] **Demo-Preise** der Produkte durch echte Preise ersetzen (Seed enthält Platzhalterwerte!)
- [ ] Impressum, Datenschutzerklärung und AGB einpflegen (aktuell Platzhalter)
- [ ] SMTP-Zugangsdaten eintragen (Admin → Integrationen), damit Bestell- und Kontakt-Mails rausgehen
- [ ] Stripe-Keys + Webhook eintragen (Admin → Integrationen)
- [ ] Optional: Facebook-Token eintragen (Admin → Integrationen)
