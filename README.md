# Vincent Hellmann — Website & Shop

Neuaufbau von [vincent-hellmann.com](https://www.vincent-hellmann.com) als moderne, selbst verwaltbare Website mit Online-Shop — ohne TYPO3.

**Stack:** Next.js 15 · Payload CMS 3 (Admin-Backend unter `/admin`) · PostgreSQL · Tailwind CSS 4 · Motion (Scroll-Animationen) · Stripe Checkout · PayPal · Docker/Traefik

## Funktionen

- **1:1-Design** angelehnt an die bestehende Website (Logo, Navigation, Hero-Slider, dunkler Footer), veredelt mit dezenten Scroll-Animationen; der Header übernimmt auf der Startseite automatisch den Farbton des aktiven Hero-Bildes (berechnet aus dem oberen Bildstreifen, Schrift/Logo wechseln je nach Helligkeit)
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

Die Website bringt einen eingebauten MCP-Server mit, über den sich Shop und Inhalte per Claude (oder anderem MCP-Client) verwalten lassen — Produkte, Kategorien, Referenzen, Kundenstimmen, News inkl. Facebook-/Instagram-Post, Aktionen, Bestellungen, Anfragen, Mediathek, Seitentexte und Auswertungen.

### Einrichten

1. Im Admin unter **Verwaltung → Integrationen → KI-Assistent** einen Schlüssel erzeugen und **speichern**. Dort steht darunter die fertige Verbindungs-URL zum Kopieren.
2. Verbinden:
   - **claude.ai / Cowork** (Custom Connector, ohne Header-Support): die kopierte URL mit `?key=…` eintragen.
   - **Claude Code**: `claude mcp add --transport http vh-website https://vh.dominikdill.com/api/mcp --header "Authorization: Bearer <Schlüssel>"`

Alternativ lassen sich die Schlüssel weiterhin als Umgebungsvariablen `MCP_API_KEY` / `MCP_READONLY_API_KEY` setzen — sie greifen nur, wenn im Admin nichts hinterlegt ist. Ohne jeden Schlüssel antwortet der Endpunkt mit 503.

Es gibt **zwei Schlüssel**: Der volle Zugriff bringt alle 47 Werkzeuge und wirkt wie ein Admin-Passwort. Der Nur-Lese-Schlüssel bringt 19 — Schreib- und Löschwerkzeuge erscheinen damit gar nicht erst in der Werkzeugliste. Praktisch für Auswertungen, ohne den Vollzugriff aus der Hand zu geben.

### Was der Assistent kann

| Bereich | Werkzeuge |
|---|---|
| **Produkte** | `produkte_liste`, `produkt_lesen`, `produkt_anlegen`, `produkt_aendern`, `produkt_bilder_setzen`, `produkt_varianten_setzen`, `produkt_loeschen` |
| **Kategorien** | `kategorien_liste`, `kategorie_anlegen`, `kategorie_aendern` |
| **Referenzen** | `referenzen_liste`, `referenz_lesen`, `referenz_anlegen`, `referenz_aendern`, `referenz_loeschen` |
| **Kundenstimmen** | `kundenstimmen_liste`, `kundenstimme_anlegen`, `kundenstimme_aendern`, `kundenstimme_loeschen` |
| **News** | `news_liste`, `news_lesen`, `news_verfassen`, `news_aendern`, `news_loeschen` |
| **Aktionen** | `aktionen_liste`, `aktion_anlegen`, `aktion_aendern`, `aktion_beenden`, `aktion_loeschen` |
| **Bestellungen** | `bestellungen_liste`, `bestellung_lesen`, `bestellung_in_fertigung`, `bestellung_versenden`, `bestellung_status_setzen` |
| **Anfragen** | `anfragen_liste`, `anfrage_lesen`, `anfrage_status_setzen` |
| **Mediathek** | `medien_liste`, `bild_hochladen`, `bild_aendern`, `bild_loeschen` |
| **Seitentexte** | `seite_lesen`, `seite_schreiben` (Startseite, Über uns, Einstellungen, Rechtliches) |
| **Auswertung** | `suchen`, `uebersetzungen_pruefen`, `website_check`, `shop_statistik` |

### Vier Regeln, die überall gelten

- **Sprachen.** Jedes lesende und ändernde Werkzeug kennt `sprache` (`de`/`fr`/`en`). Angelegt wird immer auf Deutsch, Französisch und Englisch trägt man mit demselben `*_aendern`-Aufruf nach. `uebersetzungen_pruefen` listet auf, was noch fehlt — das ist die Arbeitsliste.
- **Seitentexte.** Vor jedem `seite_schreiben` zuerst `seite_lesen` aufrufen. Listen (Hero-Slider, Zeitleiste, Highlights) werden komplett ersetzt, nicht ergänzt.
- **Löschen ist zweistufig.** Ohne `bestaetigen: true` kommt nur eine Vorschau, was gelöscht würde. Bestellungen und Seitentexte lassen sich gar nicht löschen; Bilder nur, wenn sie nirgends mehr verwendet werden.
- **Zugangsdaten bleiben außen vor.** Das Global *Integrationen* mit SMTP-, Stripe-, PayPal- und Facebook-Zugängen ist bewusst nicht angebunden — weder lesend noch schreibend.

### Bilder hochladen

`bild_hochladen` nimmt zwei Wege:

- **`url` — der empfohlene Weg.** Der Server holt die Datei selbst und schafft bis **150 MB**; ein 32-MB-Foto ist in rund 3,5 Sekunden drin, inklusive der automatisch erzeugten Zuschnitte (480/900/1800 px). Die Datei muss unter einer URL liegen, die der Container erreicht.
- **`datenBase64` — nur bis 8 MB.** Darüber lehnt das Werkzeug ab und verweist auf `url`: Base64 müsste komplett durch die MCP-Nachricht wandern und wird dabei rund ein Drittel größer.

### Sicherheit

Der Schlüsselvergleich läuft zeitkonstant. Die Variante mit `?key=` ist für claude.ai nötig, weil dort keine Kopfzeilen gesetzt werden können — der Schlüssel landet damit aber in Proxy- und Zugriffsprotokollen. Für Claude Code deshalb den Header-Weg nehmen.

## Zwei-Faktor-Anmeldung fürs Backend

Payload bringt von Haus aus kein MFA mit; hier läuft es über einen eigenen Anmelde-Hook mit TOTP — kompatibel mit Google Authenticator, Microsoft Authenticator, 1Password, Aegis und anderen.

1. Im Admin das **eigene Benutzerkonto** öffnen (Verwaltung → Benutzer).
2. **„Zwei-Faktor einrichten"** klicken, den QR-Code scannen oder den angezeigten Schlüssel von Hand eintragen.
3. Den 6-stelligen Code aus der App eingeben und aktivieren.
4. **Die Ersatzcodes notieren — sie werden nur einmal angezeigt.** Jeder funktioniert genau einmal, falls das Handy nicht zur Hand ist.

Ab dann erscheint auf der Anmeldeseite ein zusätzliches Feld für den Code. Unabhängig davon sperrt das Backend ein Konto nach zehn Fehlversuchen für zehn Minuten.

## Inhalte pflegen (Kurzanleitung Redaktion)

Alles unter `https://vh.dominikdill.com/admin`:

| Bereich | Was |
|---|---|
| **Produkte** | Titel, Bilder, Preis, Varianten (z.B. Größen), Farboptionen, „nur auf Anfrage", „auf Startseite hervorheben". Sprachumschalter oben rechts für die französische Fassung. |
| **Kategorien** | Menüpunkte der Website (Reihenfolge über Feld „Reihenfolge"); Unterkategorien über „Übergeordnete Kategorie". |
| **Referenzen** | Projekte für Kommunen, Gewerbe und Privat mit Bildern, Bereich, Jahr und Auftraggeber. Über „Verwendete Produkte" verknüpft — die Referenz erscheint dann auch auf der Produktseite und umgekehrt. |
| **Kundenstimmen** | Zitat, Name und Kontext, optional einem Produkt zugeordnet. **Nur echte Stimmen mit Einverständnis eintragen** — erfundene Bewertungen sind wettbewerbswidrig. |
| **News** | Beiträge mit Titelbild und Teaser; als Entwurf speichern oder veröffentlichen; optional Facebook- und Instagram-Checkbox (Instagram braucht zwingend ein Titelbild). |
| **Aktionen** | Rabatt (% oder €), Zeitraum, Geltungsbereich, optional Gutscheincode. Aktive Aktionen erscheinen automatisch als Banner + im Warenkorb. |
| **Bestellungen** | Status-Pflege bezahlt → **in Fertigung** → versendet → storniert. Vor dem Umstellen auf „Versendet" die Sendungsnummer eintragen, sie geht in die Versandmail. Bei „In Fertigung" kann ein voraussichtlicher Termin mitgegeben werden. |
| **Anfragen** | Alles, was über Kontaktformular, Produktseite und Maßanfertigung hereinkommt — mit Status (neu/in Bearbeitung/beantwortet/erledigt) und interner Notiz. Wird gespeichert, bevor die Mail rausgeht, damit kein Kontakt verloren geht. |
| **Fertigung** | Je Produkt eine Fertigungszeit (z.B. „3–4 Wochen"); Standardwert und Handarbeits-Hinweis stehen in den Website-Einstellungen. „Fertiges Stück — sofort lieferbar" kennzeichnet Werkstattstücke; die werden nach dem Verkauf automatisch ausgeblendet. |
| **Startseite** | Hero-Slider, Mission, Galerie, Highlights, Werte. |
| **Website-Einstellungen** | Kontaktdaten, Social-Media-Links, SEO-Standardwerte, Firmen-/Steuerangaben, Handarbeits-Hinweis und Fertigungszeit sowie optional eine cookiefreie Besucherstatistik. |
| **Rechtliches** | Impressum, Datenschutzerklärung, AGB. |
| **Integrationen** | SMTP-Zugangsdaten, Stripe-Keys, Facebook-Token und die MCP-Schlüssel — direkt im Admin pflegbar (nur für eingeloggte Benutzer sichtbar). Leere Felder fallen auf die Umgebungsvariablen zurück. |

Das Admin-Panel ist responsiv und auch am Handy nutzbar. Die Inhaltsfelder (News, Produkte, Referenzen …) sind vollwertige Rich-Text-Editoren mit fester Toolbar: Überschriften, Fett/Kursiv, Listen, Links und Bilder mitten im Text (Upload-Button in der Toolbar). URL-Slugs können leer gelassen werden — sie entstehen automatisch aus dem Titel.

## Nach dem ersten Deployment zu erledigen

- [ ] Admin-Passwort ändern
- [ ] **Zwei-Faktor-Anmeldung** einrichten und die Ersatzcodes sicher ablegen
- [ ] **Demo-Preise** der Produkte durch echte Preise ersetzen (Seed enthält Platzhalterwerte!)
- [ ] Impressum, Datenschutzerklärung und AGB einpflegen (aktuell Platzhalter)
- [ ] SMTP-Zugangsdaten eintragen (Admin → Integrationen), damit Bestell- und Kontakt-Mails rausgehen
- [ ] Stripe-Keys + Webhook eintragen (Admin → Integrationen)
- [ ] Handarbeits-Hinweis und Standard-Fertigungszeit pflegen (Admin → Website-Einstellungen), danach je Produkt die eigene Fertigungszeit
- [ ] Optional: Facebook-Token eintragen (Admin → Integrationen)
- [ ] Optional: MCP-Schlüssel erzeugen, wenn die Website per KI gepflegt werden soll (Admin → Integrationen)
- [ ] Optional: cookiefreie Besucherstatistik hinterlegen (Admin → Website-Einstellungen) und einen Satz dazu in die Datenschutzerklärung aufnehmen
