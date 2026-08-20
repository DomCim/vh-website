# Vincent Hellmann — Website & Shop

Neuaufbau von [vincent-hellmann.com](https://www.vincent-hellmann.com) als moderne, selbst verwaltbare Website mit Online-Shop — ohne TYPO3.

**Stack:** Next.js 15 · Payload CMS 3 (Admin-Backend unter `/admin`) · PostgreSQL · Tailwind CSS 4 · Motion (Scroll-Animationen) · PayPal · Docker/Traefik

## Funktionen

- **1:1-Design** angelehnt an die bestehende Website (Logo, Navigation, Hero-Slider, dunkler Footer), veredelt mit dezenten Scroll-Animationen; der Header übernimmt auf der Startseite automatisch den Farbton des aktiven Hero-Bildes (berechnet aus dem oberen Bildstreifen, Schrift/Logo wechseln je nach Helligkeit)
- **Dreisprachig** Deutsch/Französisch/Englisch — alle Inhalte im Backend übersetzbar (Fallback: Deutsch)
- **Shop** mit Varianten (Größen), Farboptionen (RAL), **Versandkosten je Artikel**, Warenkorb, **Lieferung oder Abholung** und Checkout über **PayPal** (auch ohne PayPal-Konto mit Karte oder Lastschrift; der Betrag kommt immer als ganzer an, eine Ratenzahlung vereinbart die Kundschaft mit PayPal); Produkte optional „nur auf Anfrage" mit direktem **Anfrage-Formular am Produkt**
- **Bestellverwaltung** im Büro (offen → bezahlt → in Fertigung → versendet) mit Trackingnummer; **automatische Versand-Mail** beim Umstellen auf „versendet“, Bestätigungs-Mail an Kunden + Benachrichtigung an euch
- **Büro unter `/office`**: CRM und Warenwirtschaft mit einer Anmeldung — Angebote, Fertigungsaufträge, Stücklisten mit Dienstleistern, Belege per Foto (von Claude ausgelesen), Inventar mit Inventur, Steuer-Export, **Postfach für mehrere IMAP-Konten** und Push-Benachrichtigungen; als App installierbar
- **News & Ratgeber** mit optionalem **Facebook- und Instagram-Autopost** beim Veröffentlichen; Ratgeber-Artikel als dauerhafter SEO-Content
- **Referenzen** (Projekte für Kommunen/Gewerbe/Privat) mit Filter und Startseiten-Teaser; **Über-uns-Seite** mit Timeline; **Kundenstimmen** (nur echte!) auf Startseite und Produktseiten; optionales **Video im Hero**
- **Aktionen**: Prozent-/Festrabatte mit Zeitraum, auf alles/Kategorien/Produkte, optional mit Gutscheincode; automatische Anwendung im Warenkorb + Banner auf der Startseite
- **Elektronische Rechnung**: Ausgangsrechnungen als **Factur-X** (PDF/A-3 mit eingebetteter XML nach EN 16931), XML auch einzeln herunterladbar
- **Bilder** in fünf Größen als WebP, per `srcset` passend zum Gerät ausgeliefert
- **SEO**: Sitemap, robots.txt, hreflang, Open Graph, schema.org-Produktdaten (Google Rich Results)
- **Kontaktformular** mit Mailversand
- **Newsletter** mit Double-Opt-In, Versand aus dem Büro und Abmeldelink; **Mahnwesen** in drei Stufen; automatisches Nachfassen bei Angeboten und Bitte um Kundenstimmen nach der Lieferung
- **Verbraucherrecht**: Widerrufsbelehrung, Muster-Widerrufsformular, Versand & Zahlung als eigene Seiten; Zustimmung in der Kasse wird mit Zeitpunkt an der Bestellung festgehalten
- **Betrieb**: `/api/healthz` für Monitoring, **nächtliche Komplettsicherung** (Datenbank + Bilder in einem Archiv, auf die NAS geschoben, bedienbar im Büro), Sicherheits-Kopfzeilen inkl. CSP, Erinnerung an fällige Belege

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

Die Kette: **vincent-hellmann.com → Nginx Proxy Manager (TLS) → Traefik (Netzwerk `edge`) → Container**

1. **Image**: Der GitHub-Actions-Workflow (`.github/workflows/docker.yml`) baut bei jedem Push auf `main` das Image und pusht es nach `ghcr.io/domcim/vh-website:latest`.
   Ist das GitHub-Package privat, in Portainer eine Registry-Anmeldung für `ghcr.io` hinterlegen (GitHub-Token mit `read:packages`).
2. **Stack anlegen**: In Portainer → Stacks → „Add stack" → Repository `domcim/vh-website` (Compose-Pfad `docker-compose.yml`) oder Inhalt der Datei einfügen.
3. **Umgebungsvariablen** im Stack setzen — Minimum:
   - `PAYLOAD_SECRET` (z.B. `openssl rand -hex 32`)
   - `POSTGRES_PASSWORD`
   - `SEED=true` **nur beim allerersten Start** (spielt Kategorien, Produkte, Bilder usw. ein; danach wieder auf `false`)
   - optional: SMTP-, PayPal- und Facebook-Variablen (siehe `.env.example`)
4. **NPM-Weiterleitung**: `vincent-hellmann.com` als Proxy-Host auf Traefik zeigen lassen (TLS im NPM). Traefik routet über das Label `Host(vincent-hellmann.com)` auf den Container (Entrypoint per `TRAEFIK_ENTRYPOINT`, Standard `web`). Die anderen Domains kommen als Weiterleitung dazu — siehe **Domains** gleich darunter.
5. **Erster Login**: `https://vincent-hellmann.com/admin` — Zugangsdaten aus dem Seed (`admin@vincent-hellmann.com` / `change-me-123`) → **Passwort sofort ändern!**

### Domains

Vincent hat drei: **.com**, **.de** und **.fr**. Maßgeblich ist genau eine —
`https://vincent-hellmann.com`, ohne `www`. Alles andere leitet mit **301**
dorthin um, unter Beibehaltung des Pfades.

Warum nur eine: Dieselben Inhalte unter mehreren Adressen teilen ihre
Sichtbarkeit bei Google auf, statt sie zu bündeln — und beim Kundenportal wäre
es schlimmer als das. Anmeldung, Warenkorb und Übergabelinks hängen an Cookies,
und Cookies gelten je Adresse. Wer sich auf `.de` anmeldet und auf `.com`
weitersurft, ist dort wieder ausgeloggt.

**Im Nginx Proxy Manager** (die Umleitung passiert dort und nicht in Traefik —
sie kostet dann keinen Weg durch die ganze Kette):

| Domain | Typ im NPM | Ziel |
| --- | --- | --- |
| `vincent-hellmann.com` | Proxy Host | Traefik |
| `www.vincent-hellmann.com` | Redirection Host, 301 | `https://vincent-hellmann.com` |
| `vincent-hellmann.de`, `www.vincent-hellmann.de` | Redirection Host, 301 | `https://vincent-hellmann.com` |
| `vincent-hellmann.fr`, `www.vincent-hellmann.fr` | Redirection Host, 301 | `https://vincent-hellmann.com` |

Bei jedem Redirection Host: **„Preserve Path" an** (sonst landet
`…de/de/kollektion` auf der Startseite statt auf der Kollektion),
**HTTP-Code 301** (dauerhaft — 302 sagt Google „kommt wieder zurück") und ein
eigenes Zertifikat je Domain, damit auch `https://…de` ohne Warnung umleitet.

Beim Proxy Host für `.com` zusätzlich:

- **Websockets Support** an — die Live-Verbindung des Büros läuft über `/ws/buero`.
- Unter *Advanced* → `client_max_body_size 512m;` — die Übergabemappe nimmt
  Dateien bis 500 MB an. Ohne das antwortet Nginx mit **413**, bevor überhaupt
  etwas bei der Anwendung ankommt, und die Fehlermeldung im Browser sagt nur
  „nicht übertragen".
- `X-Forwarded-Proto: https` muss durchgereicht werden (NPM macht das von
  selbst) — sonst baut die Anwendung `http`-Links.

**Traefik** kennt nur `vincent-hellmann.com` (Label `Host(...)`, gesetzt über
`DOMAIN`). Kommt dort eine andere Adresse an, antwortet es mit 404. Das ist
Absicht: ein sichtbarer Fehler ist besser als dieselbe Seite unter vier
Adressen.

### Reihenfolge beim Umzug

Der Stolperstein zuerst: Payload prüft die Herkunft jeder angemeldeten
Anfrage gegen `serverURL` — und die kommt aus `NEXT_PUBLIC_SERVER_URL`.
Stimmen Adresse und Variable nicht überein, antwortet **jede** angemeldete
Anfrage mit 403: Das Büro lädt, bleibt aber leer, und im Admin geht nichts
mehr. Beides gehört deshalb in denselben Schritt.

1. **DNS** für `.com`, `.de`, `.fr` (jeweils mit und ohne `www`) auf den
   Server zeigen lassen. Erst danach kann der NPM Zertifikate holen.
2. Im NPM den **Proxy Host für `.com`** anlegen (Traefik als Ziel,
   Websockets an, `client_max_body_size 512m`) und ein Zertifikat ausstellen.
3. Im Stack **`NEXT_PUBLIC_SERVER_URL=https://vincent-hellmann.com`** und
   **`DOMAIN=vincent-hellmann.com`** setzen, dann neu ausrollen. Ab hier ist
   die Seite unter der neuen Adresse erreichbar.
4. Prüfen: `curl -I https://vincent-hellmann.com/api/healthz`, einmal im Büro
   anmelden, eine Seite im Admin speichern.
5. Die **Redirection Hosts** für `.de`, `.fr` und `www` anlegen.
6. Prüfen, dass jede Umleitung 301 liefert und den Pfad behält:
   `curl -I https://vincent-hellmann.de/de/kollektion` → `location:
   https://vincent-hellmann.com/de/kollektion`
7. Erst zum Schluss die alte Adresse abschalten.

Ein **neues Abbild ist dafür nicht nötig**. Das klingt nach einer
Selbstverständlichkeit, ist bei Next aber keine: Variablen mit dem Vorsatz
`NEXT_PUBLIC_` werden normalerweise beim Bauen fest eingesetzt. Hier nicht —
der Bau (`.github/workflows/docker.yml`) gibt die Variable gar nicht mit, und
was beim Bauen fehlt, lässt Next als Abfrage stehen. Sie wird deshalb erst
beim Start gelesen. Nachgemessen an einem Abbild, das ohne die Variable
gebaut und mit ihr gestartet wurde: kanonische Links, Sitemap und robots.txt
tragen die Adresse aus dem Stack.

### Was ein Adresswechsel mitnimmt

`NEXT_PUBLIC_SERVER_URL` ist nicht nur Kosmetik. Wer sie ändert, muss wissen:

- **Passkeys werden ungültig.** Der Browser bindet sie an die Adresse (RP-ID).
  Nach dem Wechsel meldet man sich einmal mit Passwort an und legt den Passkey
  neu an — im Büro unter *Mein Konto*.
- **Alle sind abgemeldet.** Büro-Anmeldung, Kundenportal und offene
  Übergabe-Sitzungen hängen an Cookies der alten Adresse.
- **Schon verschickte Übergabelinks zeigen ins Leere**, wenn die alte Adresse
  abgeschaltet wird. Läuft noch eine Mappe, im Büro einen neuen Link erzeugen
  (die Mappe bleibt dieselbe).
- **PayPal**: Rücksprung-Adressen entstehen aus der Variablen, in der
  PayPal-App muss die neue Domain aber freigeschaltet sein.
- **Facebook/Instagram**: verknüpfte Domain im Meta-Business-Konto anpassen,
  sonst scheitert das automatische Veröffentlichen.
- **E-Mail**: SPF, DKIM und DMARC gelten für die Absenderdomain in
  `EMAIL_FROM`. Zieht die mit um, gehören die DNS-Einträge angepasst — sonst
  landet Post im Spam.
- **HSTS**: Die Anwendung sendet `max-age=63072000; includeSubDomains`. Ab dem
  ersten Aufruf besteht der Browser also zwei Jahre lang auf HTTPS — für die
  Domain **und jede Unterdomäne**. Vorher sicherstellen, dass es keine
  Unterdomäne ohne Zertifikat gibt.
- **Google Search Console**: neue Property anlegen und
  `https://vincent-hellmann.com/sitemap.xml` einreichen. Sitemap, robots.txt,
  kanonische Links und hreflang entstehen automatisch aus der Variablen.

**Persistenz:** Uploads liegen im Volume `media` (`/app/media`), die Datenbank im Volume `dbdata`, die fertigen Sicherungen im Volume `backups` (`/app/backups`). Alle drei überleben Updates. Gesichert wird nicht von Hand, sondern über **Büro → Sicherung** (siehe unten).

**Update:** Neues Image wird bei Push auf `main` gebaut → in Portainer „Re-pull image & redeploy". Migrationen laufen automatisch beim Start.

**Automatisch ausrollen (optional):** Portainer bietet je Stack einen Webhook an, der genau das auslöst — er ist aber nur im Heimnetz erreichbar, GitHub kommt also nicht heran. Dazwischen steht Home Assistant, das über Nabu Casa von außen ansprechbar ist:

1. In Home Assistant eine Automatisierung mit **Webhook-Auslöser** anlegen (`local_only: false`). Die Adresse ist dann `https://<ha-adresse>/api/webhook/<webhook-id>`. Steht Home Assistant nicht selbst im Internet, stattdessen einen **Cloudhook** über Nabu Casa erzeugen (`https://hooks.nabu.casa/…`) — der kommt ohne Portfreigabe aus.
2. Als Aktion einen `shell_command` aufrufen, der den Portainer-Webhook intern anstößt:

   ```yaml
   shell_command:
     vh_website_ausrollen: >-
       curl -fsS -k -X POST --max-time 60
       "https://<portainer-ip>:9443/api/stacks/webhooks/<stack-webhook-id>"
   ```

   `-k`, weil Portainer auf der IP ein selbstsigniertes Zertifikat ausliefert.
3. In der Automatisierung eine Bedingung auf ein vereinbartes Token im Rumpf setzen — sonst würde eine durchgesickerte Webhook-Adresse allein zum Ausrollen reichen.
4. Im GitHub-Repository unter **Settings → Secrets and variables → Actions** anlegen: `HA_DEPLOY_WEBHOOK` (die Webhook-Adresse) und `HA_DEPLOY_TOKEN` (dasselbe Token). Der letzte Schritt in `.github/workflows/docker.yml` ruft den Webhook nach jedem erfolgreichen `latest`-Build auf; ohne hinterlegte Secrets überspringt er sich stillschweigend.

Der Aufruf bringt den Commit mit, und `/api/healthz` meldet unter `version` den Stand, mit dem das laufende Image gebaut wurde (aus dem Build-Argument `GIT_SHA`). Damit lässt sich in der Automatisierung warten, bis wirklich die neue Fassung antwortet, statt nur den angenommenen Auftrag zu melden — der Webhook ist ja sofort zurück, während drinnen noch migriert und gestartet wird.

### Zwei Container: Website und Büro

Beide entstehen aus **demselben Quelltext**, aber als **zwei Abbilder**:

| Dienst  | Abbild                        | bedient                                  |
| ------- | ----------------------------- | ---------------------------------------- |
| `web`   | `ghcr.io/domcim/vh-website`   | Website, Shop, Admin-Panel, alles Übrige |
| `buero` | `ghcr.io/domcim/vh-buero`     | `/office`, `/api/office`, `/ws/buero`    |

Getrennt wird vor dem Bauen: Beim Bau-Argument `ROLLE=web` verschwindet `src/app/(office)`, bei `ROLLE=buero` verschwinden `(frontend)` und `(payload)`. Ohne Angabe entsteht wie bisher ein Abbild mit beidem — so laufen Entwicklung und Prüfung mit einem einzigen Start.

Der Grund ist nicht Speicherplatz, sondern das Ausrollen: **Gebaut wird nur, was sich geändert hat.**

| Geändert | Neu gebaut |
| --- | --- |
| `src/app/(office)/…`, `src/components/office/…` | nur `vh-buero` |
| `src/app/(frontend)/…`, `(payload)/…` | nur `vh-website` |
| `src/lib`, `src/collections`, `Dockerfile`, `package.json` … | beide |
| README, Tests, `docker-compose.yml` | keines |

Eine reine Büro-Änderung erzeugt damit gar kein neues Website-Abbild — der Shop-Container hat beim Ausrollen nichts zu tun und läuft ohne Unterbrechung weiter. Beide Container können deshalb auf `latest` bleiben, und das automatische Ausrollen funktioniert unverändert.

Der Grund ist nüchtern: Vorher teilten sie sich einen Prozess, und ein Fehler im Büro riss den Shop mit. Getrennt kann das Büro abstürzen, neu starten oder ausgerollt werden, ohne dass ein Kunde etwas merkt.

Was sich dadurch **nicht** ändert: dieselbe Adresse, dieselbe Anmeldung, dieselben Passkeys, dieselbe Datenbank, dasselbe Volume für die Mediathek. Wer wohin geleitet wird, entscheidet Traefik über die Pfade — der Router `vhbuero` hat die höhere Priorität und greift die Büro-Pfade ab, alles andere fällt an `vhweb`.

**Beim Umstellen wichtig:** Der alte Einzelcontainer muss weg. Bleibt er mit seinen Traefik-Labels am Netz `edge` hängen, bedient er weiter dieselbe Adresse — und man sieht den alten Stand, obwohl die neuen Container laufen. In Portainer den alten Stack entfernen (oder ersetzen), nicht danebenstellen.

Die Rolle steuert nur zweierlei:

- **Was es genau einmal geben darf**, macht `web`: Datenbank-Migrationen und Startdaten beim Hochfahren, danach der Takt (nächtliche Sicherung, Erinnerungen, Postfach-Abruf). Liefe das in beiden, gäbe es jede Sicherung doppelt und jede Erinnerung zweimal aufs Handy.
- **Offene Drähte hält `buero`.** Eine Änderung entsteht aber oft im Web-Container — eine bezahlte Bestellung legt dort einen Auftrag an. Weitergereicht wird sie über die Datenbank (`LISTEN`/`NOTIFY`); das kann Postgres von Haus aus, es braucht weder einen Nachrichtendienst noch eine Verbindung zwischen den Containern.

Ohne gesetzte `ROLLE` macht ein Prozess alles — so laufen Entwicklung und Prüfung weiterhin mit einem einzigen Start.

**Welcher Stand läuft wo?** Jeder Container hat seine eigene Auskunft, und die muss man getrennt fragen — sonst antwortet immer nur die Website:

```
curl https://vincent-hellmann.com/api/healthz         → Web-Container
curl https://vincent-hellmann.com/api/office/healthz  → Büro-Container
```

Beide melden unter `version` den Commit, mit dem ihr Abbild gebaut wurde. Stehen dort zwei verschiedene Nummern, ist beim Ausrollen nur einer der beiden getauscht worden. Sieht die Büro-Oberfläche alt aus, ist das die erste Frage — nicht die letzte.

**Update:** Beide Container ziehen dasselbe Abbild. In Portainer „Re-pull image & redeploy" auf den Stack anwenden, dann starten sie gemeinsam neu; die Migrationen laufen dabei nur im Web-Container.

### Welche Fassung der Stack fährt

Es gibt zwei Wege, und sie unterscheiden sich genau in einem Punkt — ob es von selbst passiert:

| | Push auf `main` | Tag `v1.2.3` |
| --- | --- | --- |
| Gebaute Abbilder | `latest`, `sha-…` | `1.2.3`, `sha-…` |
| Rollt sich selbst aus | ja (Webhook) | nein |
| Zu tun | nichts | `VH_FASSUNG` setzen und neu ausrollen |

Der Stack zieht `ghcr.io/domcim/vh-website:${VH_FASSUNG:-latest}`. Ohne die Variable also `latest` — den Stand von `main`, der sich nach jedem Push von selbst ausrollt.

Wer einen bestimmten Stand fahren will, bevor er auf `main` geht, hat zwei Möglichkeiten:

- **Tag setzen:** `git tag v1.2.3 && git push origin v1.2.3`
- **Von Hand anstoßen:** Im Repository unter **Actions → „Docker-Image bauen & veröffentlichen" → Run workflow**, den gewünschten Branch wählen. Gebaut wird dann die Nummer, die in `package.json` steht — dasselbe Ergebnis ohne Tag.

Danach im Portainer-Stack `VH_FASSUNG=1.2.3` eintragen und neu ausrollen. Beide Container ziehen dieselbe Nummer, es ist ein einziges Feld. Zurück auf den laufenden Stand geht es, indem man die Variable wieder auf `latest` setzt.

### Nur eines von beiden ausrollen

Im Normalfall braucht es das gar nicht: Beide bleiben auf `latest`, und weil nur das geänderte Abbild neu gebaut wird, startet ohnehin nur der betroffene Container neu.

Wer trotzdem eine Hälfte einfrieren will — etwa den Shop, während im Büro etwas ausprobiert wird —, kann das: `VH_FASSUNG` setzt beide, `VH_FASSUNG_WEB` und `VH_FASSUNG_BUERO` überstimmen sie einzeln:

```
VH_FASSUNG=1.1.0            # beide
VH_FASSUNG_BUERO=1.1.1      # nur das Büro, Website bleibt auf 1.1.0
```

Zwei Dinge, die man dabei wissen muss:

- **Migrationen wendet der Web-Container an.** Bringt eine Fassung eine Datenbank-Änderung mit, gehört sie auf beide — sonst läuft das neue Büro gegen ein altes Schema. Reine Oberflächen- oder Rechenänderungen im Büro sind davon nicht betroffen.
- **Sie teilen sich die Datenbank.** Zwei Fassungen weit auseinander laufen zu lassen ist kein Dauerzustand, sondern etwas für den Nachmittag, an dem man eine Änderung im Büro ausprobiert.

Was die zwei Abbilder **nicht** trennen, und warum das so ist:

- **Die Anmeldung** liegt im Website-Abbild — Payloads eigene Schnittstelle (`/api/users/…`) gehört zum Admin-Zweig. Wer sich im Büro *neu* anmeldet, braucht also den Web-Container; einmal angemeldet, prüft das Büro das Sitzungs-Cookie im eigenen Prozess und ist unabhängig. Dasselbe gilt für Passkey, Zwei-Faktor und die KI-Texthilfe.
- **Der Unterbau** liegt in beiden: Datenmodell, Collections, Payload, `src/lib`. Das ist keine Nachlässigkeit, sondern die Geschäftslogik selbst — beide Hälften arbeiten mit denselben Rechnungen, Aufträgen und Beständen.
- **`src/components/office`** bleibt auch im Website-Abbild liegen: Der Passkey-Knopf im Admin-Panel benutzt die Anmeldung des Büros.

### Bauen, ohne auszurollen

Manchmal soll der neue Stand ins Regal, aber noch nicht in den Betrieb. Dafür gibt es zwei Bremsen, je nachdem, wie der Lauf ausgelöst wurde:

- **Von Hand:** Beim „Run workflow" steht ein Auswahlfeld *Nach dem Bauen ausrollen?* — auf `nein` stellen.
- **Beim Merge nach `main`:** Dort lässt sich nichts mitgeben, also steht die Bremse im Text des Commits. Wer **`[kein-ausrollen]`** in die Merge-Nachricht schreibt, baut `latest`, ohne dass es gleich live geht.

In beiden Fällen liegt das Abbild danach in der Registry und wartet. Ausgerollt wird es, wenn du im Portainer-Stack „Re-pull image & redeploy" drückst.

Wichtig dabei: **Migrationen laufen vorwärts.** Auf eine ältere Fassung zurückzugehen, nachdem eine neue die Datenbank verändert hat, geht nur über das Einspielen einer Sicherung.

## PayPal einrichten

PayPal ist die einzige Zahlart im Shop. Beim Betrieb kommt immer der **volle
Betrag in einem Schritt** an; ob die Kundschaft ihn später oder in Raten zahlt,
vereinbart sie mit PayPal und nicht mit uns. Genau deshalb reicht diese eine
Zahlart: Teilzahlung ist möglich, ohne dass der Betrieb sie finanzieren muss.

Gestufte Zahlung im Projektgeschäft — Anzahlung, Zwischen-, Schlussrechnung —
läuft davon unabhängig über Rechnungen aus dem Büro (per Überweisung, mit
GiroCode auf dem Papier).

1. [PayPal Developer](https://developer.paypal.com) → REST-App erstellen (Business-Konto nötig) → Client-ID + Secret.
2. Im Admin unter **Verwaltung → Integrationen → PayPal** eintragen; zum Testen Sandbox-Zugangsdaten + Haken „Sandbox-Modus".
3. Testbestellung durchführen — die Zahlung wird beim Rücksprung auf die Danke-Seite server-seitig eingezogen (Capture), danach muss die Bestellung im Admin auf „Bezahlt" stehen.

Ohne PayPal-Zugangsdaten funktioniert die Website vollständig, nur bestellen
lässt sich nicht: Die Kasse sagt das an der Zahlungsart und bittet um eine
Nachricht, statt einen Knopf anzubieten, der ins Leere führt.

**Karten- und Klarna-Zahlung über Stripe gibt es nicht mehr.** Bestellungen aus
der Stripe-Zeit behalten ihren Anbieter und ihre Belegnummern in der Datenbank;
neu hereinkommen kann darüber nichts.

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

## Büro (`/office`) — Betrieb, Zahlen, Postfach

Zwei getrennte Oberflächen mit einer gemeinsamen Anmeldung:

- **`/admin` ist die öffentliche Verwaltung** — Artikel, News, Referenzen, Kundenstimmen, Seitentexte, Mediathek. Alles, was auf der Website landet. Für die Artikel ist es die Wahrheit: Titel, Preis, Bilder, Texte stehen nur hier.
- **`/office` ist der Betrieb** — Aufträge, Angebote, Belege, Inventar, Postfach, Steuern, Einstellungen und Benutzer. Alles, was niemand von außen sieht.

So hat jede Sache genau einen Platz. Die Büro-Daten sind im Admin bewusst ausgeblendet.

Angemeldet wird mit demselben Konto wie im Admin, inklusive Zwei-Faktor; Zugang hat nur, wer die Rolle **Inhaber** trägt. Das Büro lässt sich als App installieren (iPhone: Safari → Teilen → „Zum Home-Bildschirm").

| Bereich | Was |
|---|---|
| **Übersicht** | Einnahmen, Ausgaben, Differenz und Inventarwert des laufenden Jahres, dazu eine Liste „Kümmern": überfällige Rechnungen, Belege ohne Scan, knappes Material, unbeantwortete Anfragen. |
| **Postfach** | Mehrere IMAP-Konten lesen, beantworten, Anhänge laden, löschen. Gelesen wird direkt beim Anbieter — was hier gelöscht wird, ist auch am Rechner weg. Antworten gehen mit der Adresse des jeweiligen Postfachs raus, die Kopie landet in „Gesendet". |
| **Ausgangsprotokoll** | Jede Mail, die das System verschickt, mit Empfänger, Anlass und Ergebnis. Bei „ich habe nie eine Bestätigung bekommen" ist das die Stelle zum Nachsehen. Nur Kopfdaten, kein Inhalt. |
| **Anfragen** | Kontakt-, Produkt- und Maßanfertigungsanfragen mit Status und interner Notiz; „Antworten" öffnet das Postfach mit vorbereitetem Entwurf. |
| **Bestellungen** | Positionen, Anschrift, Stand (bezahlt → in Fertigung → versendet) und Sendungsnummer. Der Statuswechsel löst die E-Mail an die Kundschaft aus; ohne Sendungsnummer geht „Versendet" nicht. |
| **Angebote** | Positionen mit Netto, Steuer und Fertigungszeit. Die Nummer wird erst beim Versenden vergeben — ein verworfener Entwurf reißt keine Lücke in die Reihe. Angenommene Angebote werden per Klick zum Auftrag oder zur Rechnung. |
| **Aufträge** | Der Durchlauf durch die Werkstatt, mit Stoppuhr für die Arbeitszeit und Lieferschein zum Mitgeben. Bezahlte Shop-Bestellungen legen ihren Auftrag selbst an, mit dem Preis von der Website; fertige Werkstattstücke bekommen keinen. Material wird erst beim Abschließen vom Inventar abgezogen. |
| **Artikel** | Stückliste (Material je Stück), externe Dienstleister und die Arbeitszeit je Stück — daraus rechnet die Seite den Einsatz gegen den Website-Preis und schlägt einen Preis vor. Fehlt Material für eine Bestellung, steht das am Auftrag, bevor die Kundschaft wartet. |
| **Kalender** | Ein Monatsblatt mit allem, was ein Datum hat: Fertigstellungen, Liefertermine, ablaufende Angebote, fällige Belege. |
| **Rechnungen & Belege** | Ausgangsrechnungen fürs Projektgeschäft als Factur-X-PDF; Eingangsbelege per Foto oder PDF — steckt eine elektronische Rechnung darin, werden die Werte von dort übernommen, sonst liest Claude den Beleg. |
| **Inventar & Inventur** | Bestand mit Mindestmenge und Wert; die Inventur bringt die Zählliste fertig mit und schreibt die gezählten Mengen beim Abschließen zurück. |
| **Partner** | Lieferanten, Kunden und Dienstleister in einer Kartei. |
| **Steuer** | Jahresauszug für den Steuerberater, inklusive Belegen. |
| **Einstellungen** | Fünf Blätter: Benachrichtigungen dieses Geräts, das eigene Konto (Zwei-Faktor, angemeldete Geräte), Benutzerverwaltung, Betrieb (Firmenangaben, Preise) und Integrationen (SMTP, Postfächer, PayPal, KI, Takt, Sicherung). |

### Ohne Netz arbeiten

Das Büro führt seinen Bestand im Gerät mit — Belege, Rechnungen, Angebote, Aufträge, Bestellungen, Anfragen, Inventar, Partner, Artikel, Inventur. Daraus folgt dreierlei:

- **Die Seiten rechnen im Browser.** Filter wechseln, Monate blättern, Summen bilden: alles ohne Anfrage an den Server. In der Werkstatt öffnet sich das Büro auch dann, wenn kein Netz da ist.
- **Eine Leiste über den Seiten sagt, von wann der Stand ist**, sobald er nicht mehr von jetzt ist. Ein alter Stand ist brauchbar — ein alter Stand, der sich für den aktuellen ausgibt, ist gefährlich.
- **Eingaben gehen nicht verloren.** Beleg fotografieren, Uhr starten, Inventur zählen: Das steht sofort da und geht raus, sobald wieder Netz ist. In der Leiste steht, wie viel noch wartet. Abgeschickt wird der Reihe nach — ein Beleg kann auf einen Lieferanten verweisen, den es beim Server noch gar nicht gibt.

Aktuell gehalten wird das über eine offene Verbindung (`/ws/buero`): Was einer ändert, sehen die anderen ohne Nachladen. Fällt sie aus, gleicht das Gerät alle paar Minuten von selbst ab.

**Beim Abmelden wird alles gelöscht** — Daten wie zwischengespeicherte Seiten. Ein Tablet in der Werkstatt soll keine Umsätze mit sich herumtragen, nachdem sich jemand abgemeldet hat.

Drei Seiten arbeiten bewusst nicht offline, weil sie es ohnehin nicht könnten: Postfach, Steuer-Export und Sicherung. Die Einstellungen ebenfalls — Zugangsdaten im Gerät zwischenzuspeichern wäre falsch, und ein Zugangsdatum, das man ohne Netz ändert, wäre eine Falle.

Der Server startet über `server.mjs` statt über `next start` — er hält damit die offene Verbindung. Seit dem Umbau läuft er zweimal: einmal für die Website, einmal fürs Büro (siehe **Zwei Container** oben).

### Postfächer einrichten

Im Büro unter **Einstellungen → Integrationen → Postfächer** je Konto Bezeichnung, Adresse, IMAP-Server, Benutzername und Passwort eintragen; die Ordnernamen für „Gesendet" und „Papierkorb" heißen je nach Anbieter unterschiedlich (z.B. `Sent`, `INBOX.Sent`, `Gesendete Objekte`). Verschickt wird über den SMTP-Server aus demselben Bereich, sofern beim Postfach nichts Eigenes hinterlegt ist.

Die Absenderadresse der Website (`noreply@…`) steht getrennt davon unter **Integrationen → E-Mail-Versand** und muss hier nicht eingetragen werden — dorthin antwortet ohnehin niemand.

### Benachrichtigungen

Unter **Büro → Einstellungen** lässt sich jedes Gerät einzeln anmelden. Gemeldet werden neue Bestellungen, neue Anfragen und Mails, die nicht zugestellt werden konnten. Das Schlüsselpaar dafür erzeugt der Server beim ersten Mal selbst.

Auf dem iPhone kommen Meldungen erst an, wenn das Büro als App auf dem Home-Bildschirm liegt — das ist eine Vorgabe von iOS, kein Fehler.

Neue Post meldet sich nicht von allein: IMAP hat keinen Rückkanal. Dafür gibt es `GET /api/office/post/pruefen`, gedacht für einen Cron-Job im Minutentakt. Absichern über die Umgebungsvariable `CRON_SECRET` und den Kopf `Authorization: Bearer <CRON_SECRET>`.

## Bilder

Die Website lebt von Werkstattaufnahmen — ausgeliefert wurde davon bisher für jeden dieselbe Datei. Jetzt legt Payload fünf Zuschnitte an (320, 480, 900, 1800 und 2600 Pixel), alle als **WebP**, und jedes Bild bringt sie als `srcset` mit. Der Browser nimmt, was zum Platz im Layout passt: Ein Handy lädt keine 1800er mehr, ein großer Bildschirm bekommt endlich ein scharfes Hero-Bild. Höhe und Breite stehen dabei, damit beim Laden nichts springt.

Die Originaldatei bleibt unangetastet — sie ist das Archiv.

**Wichtig nach dem Update:** Zuschnitte entstehen beim Hochladen, nicht rückwirkend. Vorhandene Bilder haben also weiterhin nur die alten drei Größen. Einmalig:

```bash
pnpm bilder-neu     # rechnet die Zuschnitte aller vorhandenen Bilder neu
```

Im Container läuft das über `node_modules/.bin/payload run scripts/bilder-neu.ts`.

## Werkstatt: Zeit, Kalender, Lieferschein

**Arbeitszeit.** Am Auftrag steht eine Stoppuhr: großer Knopf, läuft sichtbar mit, stoppt in eine Buchung. Zeit lässt sich auch nachtragen, wenn das Telefon in der Jacke geblieben ist. Daraus rechnet das Büro die Lohnkosten (Stundensatz unter **Website-Einstellungen → Einzelfertigung**) und stellt sie neben Material und Fremdleistung — bis dahin war die Nachkalkulation ohne die größte Position.

**Am Artikel** kommt dieselbe Rechnung vor dem Verkauf: Material + Fremdleistung + Arbeitszeit ergeben den Einsatz je Stück, dazu ein **Preisvorschlag** mit dem eingestellten Wunschaufschlag. Liegt der Website-Preis darunter, sagt die Seite es deutlich.

**Kalender** (`/office/kalender`): ein Monatsblatt mit allem, was ein Datum hat — Fertigstellungen, zugesagte Liefertermine aus dem Shop, ablaufende Angebote, fällige Belege. Vorher lagen diese Termine in vier Listen, und eine überfüllte Woche fiel erst auf, wenn sie da war.

**Lieferschein.** Zu jedem Auftrag gibt es einen Bon de livraison zum Ausdrucken oder Verschicken: was geliefert wurde, wohin, ohne Preise — und zwei Zeilen zum Unterschreiben. Bei Montagen ist die Unterschrift zugleich das Abnahmeprotokoll.

## Nachfassen, Mahnen, Newsletter

Drei Stellen, an denen bisher Geld liegen blieb:

**Mahnwesen.** An einer gestellten Rechnung steht im Büro „Erinnern / mahnen". Welche Stufe dran ist, ergibt sich aus dem, was schon draußen war — Zahlungserinnerung (freundlich, ohne Kosten, zehn Tage Frist), Mahnung (mit der gesetzlichen Pauschale von 40 € nach Art. L441-10 Code de commerce) und letzte Mahnung. Verschickt wird über das Postfach wie jedes andere Dokument; erst nach erfolgreichem Versand wird die Stufe hochgezählt. Die Rechnungsliste hat einen Filter „Überfällig", und einmal am Tag meldet das Büro die offenen Posten aufs Handy.

**Angebote nachfassen.** Beim Verschicken merkt sich das Angebot den Tag. Bleibt es sieben Tage ohne Antwort, meldet sich das Büro — danach höchstens wöchentlich, damit die Meldung nicht zur Tapete wird. Läuft die Gültigkeit demnächst ab, steht das dabei.

**Newsletter.** Anmeldung im Fuß jeder Seite, Bestätigung per Mail (Double-Opt-In — ohne den Klick geht nichts raus), Abmeldung mit einem Klick aus jeder Mail. Geschrieben und verschickt wird unter **Büro → Newsletter**: Vorlage aus einem News-Beitrag übernehmen, Testmail an sich selbst, dann an alle. Ein Newsletter lässt sich nicht zurückholen, deshalb die Zwischenschritte.

**Kundenstimmen einholen.** Zwei Wochen nach dem Versand fragt eine Mail, ob die Kundschaft ein paar Sätze schreiben mag — genau einmal. Der Text landet zur Prüfung im Admin (Haken „Zur Prüfung eingegangen") und erscheint erst auf der Website, wenn jemand ihn freigibt. Die Seite dafür ist nur mit dem Schlüssel aus der Bestellung erreichbar: Hinter jeder Stimme steht damit eine echte Lieferung.

## Elektronische Rechnung (Factur-X)

Frankreich stellt die Rechnungsstellung auf elektronische Rechnungen um: Ab **1. September 2026** muss jedes französische Unternehmen E-Rechnungen **empfangen** können, das Ausstellen folgt gestaffelt (kleine Betriebe später). Eine E-Rechnung ist dabei kein PDF im Mailanhang, sondern ein strukturierter Datensatz.

Die Ausgangsrechnungen aus dem Büro sind deshalb jetzt **Factur-X**: ein PDF/A-3, in dem dieselbe Rechnung zusätzlich als XML nach EN 16931 (Profil BASIC) steckt. Das Blatt sieht aus wie vorher, die Maschine liest die Daten.

Damit das aufgeht, sind neue Angaben nötig:

- **Website-Einstellungen → Firmen-/Steuerangaben**: SIRET, TVA-Nummer, **IBAN/BIC** und — falls gewählt — die Option „TVA d'après les débits" (der Pflichtvermerk erscheint dann automatisch auf jeder Rechnung).
- **An der Rechnung**: SIRET/SIREN und TVA-Nummer des Kunden (bei Geschäftskunden Pflicht), Bestellnummer des Kunden, Liefer-/Leistungsdatum, Art des Geschäfts, bei Bedarf eine abweichende Lieferanschrift.

Fehlt etwas davon, steht das als Hinweis an der Rechnung — das PDF entsteht trotzdem, eine Empfängerplattform würde es aber zurückweisen. Neben „PDF ansehen" gibt es „XML herunterladen", falls Steuerberater oder Plattform den Datensatz einzeln wollen.

**Eingehende E-Rechnungen** liest das Büro ebenfalls: Wird ein Beleg als PDF hochgeladen, sucht das System zuerst nach einer eingebetteten Rechnungs-XML (Factur-X/ZUGFeRD ab 1.0, XRechnung im CII-Format). Ist eine da, kommen Lieferant, Nummer, Datum, Zahlungsziel und alle Beträge unverändert von dort — exakt, sofort und ohne KI. Erst wenn keine XML im PDF steckt (oder es ein Foto ist), schaut Claude sich den Beleg an. Damit ist auch die Empfangspflicht ab September 2026 abgedeckt.

**Was hier nicht dabei ist:** die Anbindung an eine *Plateforme Agréée* (PA). Die Datei ist normgerecht, den Übertragungsweg dorthin muss der Betrieb wählen — das ist eine Vertrags-, keine Programmierfrage. Ebenso das **E-Reporting** der Shop-Umsätze an Privatkundschaft. Beides mit dem Expert-Comptable klären; die Angaben hier sind keine Steuerberatung.

Technisch: `src/lib/facturx.ts` baut die XML, `src/lib/invoice.ts` bettet sie ein. Für PDF/A müssen die Schriften im Dokument stecken — deshalb liegen in `public/fonts/` zwei Liberation-Sans-Dateien (SIL Open Font License).

## Rechtstexte für den Shop

Wer an Verbraucher verkauft, braucht mehr als Impressum, Datenschutz und AGB. Unter **Rechtliches** im Admin stehen deshalb zusätzlich:

- **Widerrufsbelehrung** — 14 Tage, Fristbeginn, Folgen. Entscheidend für die Werkstatt ist der zweite Teil: Bei einem nach Kundenvorgabe gefertigten Einzelstück besteht **kein** Widerrufsrecht. Das gilt aber nur, wenn es ausdrücklich dasteht.
- **Muster-Widerrufsformular** — erscheint automatisch unter der Belehrung.
- **Versand & Zahlung** — Lieferzeiten, Versandkosten, Zahlungsarten.

Beide neuen Seiten sind über den Footer erreichbar (`/kontakt/widerruf`, `/kontakt/versand-zahlung`).

Entwürfe in allen drei Sprachen lassen sich einspielen mit

```bash
pnpm rechtstexte                    # schreibt nur, wo noch nichts steht
pnpm rechtstexte --ueberschreiben   # ersetzt vorhandene Texte
```

**Die Entwürfe sind keine Rechtsberatung.** Sie tragen am Ende einen Hinweis darauf und müssen vor dem Verkaufsstart geprüft und an die tatsächliche Praxis angepasst werden — besonders bei den Rücksendekosten für schwere Stahlmöbel.

In der **Kasse** wird vor dem Absenden bestätigt: AGB und Widerrufsbelehrung gelesen, und — falls ein Stück nach Vorgabe entsteht — dass dafür kein Widerrufsrecht besteht. Beides wird mit Zeitpunkt an der Bestellung festgehalten. Der Bestellknopf heißt „Zahlungspflichtig bestellen"; der Hinweis auf die Weiterleitung zu PayPal steht darunter.

## Sicherung (Büro → Sicherung)

Jede Sicherung ist ein einzelnes Archiv mit **der gesamten Datenbank und allen Bildern** — beides gehört zusammen, denn die Datenbank verweist auf die Dateien. Daneben liegt im Archiv eine `LIESMICH.txt` mit den Schritten zum Zurückspielen; im Ernstfall liest niemand mehr Dokumentation.

**Netzwerkspeicher (NAS) eintragen:** Admin → **Integrationen → Sicherung**. Zur Wahl stehen

- **Samba/Windows (CIFS)** — der übliche Weg zur NAS: Server (IP oder Name), Freigabe, optional ein Unterordner (muss dort schon bestehen), Benutzer und Passwort.
- **WebDAV** — für Nextcloud/ownCloud; dort ein App-Passwort verwenden.

Darunter stehen die Uhrzeit des nächtlichen Laufs und wie viele Kopien auf dem Server bzw. auf der NAS aufgehoben werden. Ohne eingetragene NAS läuft die Sicherung trotzdem, bleibt dann aber auf derselben Maschine wie die Daten — das hilft gegen ein gelöschtes Feld, nicht gegen einen verlorenen Server.

**Im Büro** unter *Sicherung*: Stand des letzten Laufs, alle vorhandenen Archive mit Größe, „Jetzt sichern", Herunterladen, einzeln auf die NAS schieben, Löschen. Der erste Lauf dauert am längsten.

**Zurückspielen** (Kurzfassung, ausführlich in der `LIESMICH.txt` im Archiv):

```sh
tar -xzf vh-20260818-0330.tar.gz
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URI" datenbank.dump
# Inhalt von medien/ nach /app/media im Web-Container kopieren, dann Container neu starten
```

Einmal im Jahr ausprobieren — ein Backup, das nie zurückgespielt wurde, ist eine Vermutung.

## Wartungslauf (der Server taktet sich selbst)

Es gibt **keinen Cron einzurichten**. Der Server läuft ohnehin durch und sieht jede Minute selbst nach, ob etwas ansteht (`src/instrumentation.ts`) — ein zweiter Container, der ihm auf die Schulter tippt, wäre ein bewegliches Teil mehr und eine Anleitungszeile, die jemand überliest, bis das Backup fehlt.

Eingestellt wird das im Büro unter **Einstellungen → Integrationen → Takt**, nicht über Umgebungsvariablen: Automatik an/aus, „Wartung alle … Minuten" (Standard 15), „Postfach alle … Minuten" (Standard 5) und wie lange das Ausgangsprotokoll aufgehoben wird. Änderungen greifen **binnen einer Minute**, ohne Neustart und ohne Zugriff auf den Server.

Wie oft ist dabei weniger wichtig, als es klingt: Der Blick auf die Uhr kostet nichts, und die Arbeiten selbst laufen höchstens einmal am Tag. Der Wartungstakt bestimmt nur, wie genau die eingestellte Sicherungszeit getroffen wird — bei 15 Minuten läuft „03:30" zwischen 03:30 und 03:45, bei 60 um 04:00. Beim Postfach zahlt sich häufiger aus, weil IMAP sich nicht von allein meldet.

Beides lässt sich zusätzlich von außen anstoßen — etwa aus Home Assistant, das ohnehin das Ausrollen auslöst. Dafür (und nur dafür) gibt es `CRON_SECRET`:

```sh
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://vincent-hellmann.com/api/wartung
```

Ohne gesetztes `CRON_SECRET` sind diese Endpunkte von außen geschlossen; der eigene Takt läuft trotzdem.

Der Lauf entscheidet selbst, was ansteht:

- **Nächtliche Sicherung** zur eingestellten Uhrzeit (einmal pro Tag, Riegel gegen Doppelläufe).
- **Erinnerung an fällige Belege:** Steht auf einem Eingangsbeleg ein Zahlungsziel und der Beleg ist noch nicht auf „bezahlt", meldet sich das Büro **ab drei Tagen vor Fälligkeit jeden Tag** per Push — vorher bleibt es still. Das Zahlungsziel liest Claude beim Erfassen mit; steht dort nur „zahlbar innerhalb 30 Tagen", rechnet es die KI vom Rechnungsdatum aus.
- **Aufräumen:** abgelaufene Anmeldecodes des Kundenportals und ein Mailprotokoll, das älter ist als eingestellt (Standard zwölf Monate).
- **Stillstandsprüfung:** Meldet, wenn Sicherung oder Postfach-Abruf seit Stunden nichts mehr getan haben — sonst fällt ein toter Cron erst auf, wenn man ihn braucht.

Ohne gesetztes `CRON_SECRET` ist der Endpunkt geschlossen.

## Anmeldung, Passkeys und Geheimnisse

**Wie lange eine Anmeldung gilt:** eine Woche — und sie verlängert sich, solange sie benutzt wird. Payloads Standard sind zwei Stunden; das ist für ein Redaktionssystem gedacht, nicht für ein Tablet in der Werkstatt, das den ganzen Tag am Auftrag hängt und bei jeder Anmeldung einen Code aus der Authenticator-App verlangt. Wer täglich arbeitet, bleibt angemeldet; ein Gerät, das eine Woche nicht angefasst wurde, ist es nicht mehr. Das ist sicherer als ein starres langes Fenster.

**Eine Anmeldung überlebt ein Ausrollen.** Das Token ist mit `PAYLOAD_SECRET` signiert und die Sitzung liegt in der Datenbank — beides überdauert einen neuen Container. Nur wenn `PAYLOAD_SECRET` im Stack geändert wird, sind alle Anmeldungen weg. (Nachgestellt und geprüft: anmelden, Container neu starten, weiterarbeiten.)

**Ein geändertes Passwort macht alle bestehenden Anmeldungen ungültig** — Passkey-Sitzungen eingeschlossen. Das ist der Weg, wenn ein Gerät abhandenkommt. Das Kundenportal gilt weiterhin 30 Tage.

### Anmelden mit Face ID, Fingerabdruck oder Geräte-PIN (Passkeys)

Statt langem Passwort plus sechsstelligem Code: ein Knopf, ein Blick aufs Gerät, drin. Der Schlüssel entsteht im Gerät und verlässt es nie; herausgegeben wird er erst nach Gesicht, Finger oder PIN. Er lässt sich nicht abtippen, nicht abfischen und nicht auf einer gefälschten Seite eingeben — der Browser gibt ihn nur an die Adresse heraus, für die er angelegt wurde.

Eingerichtet wird das **je Benutzer**, genau wie die Zwei-Faktor-Anmeldung: im Admin unter **Mein Konto → „Dieses Gerät hinzufügen"**. Wichtig dabei:

- Das muss an dem Gerät passieren, mit dem man sich später anmelden will. Ein iPhone reicht seinen Passkey über den Schlüsselbund an iPad und Mac weiter; für ein Android-Handy legt man einen eigenen an. Mehrere Geräte sind kein Problem, jedes bekommt einen eigenen Eintrag.
- **Passkeys brauchen https.** Auf `http://localhost` geht es zum Ausprobieren, im Betrieb nur über die verschlüsselte Adresse.
- Die Anmeldung mit Passwort bleibt bestehen — ein Gerät kann kaputtgehen. Der Passkey-Knopf steht auf beiden Anmeldeseiten (`/office/login` und `/admin`) und erscheint nur, wenn das Gerät ihn überhaupt kann.
- **Kein zusätzlicher Zwei-Faktor-Code**: Ein Passkey ist bereits beides — das Gerät, das man hat, und das Gesicht (oder der Finger), das man ist.

**Passwörter und Schlüssel** (SMTP, Postfächer, PayPal, Anthropic, MCP, Facebook, NAS) stehen in der Verwaltung nicht mehr im Klartext: Sie sind verdeckt wie ein Passwortfeld, lassen sich mit einem Knopf aufdecken — und mit einem zweiten kopieren, ohne sie überhaupt sichtbar zu machen. Denn getippt werden solche Werte nie, sie werden von woanders hierher und wieder zurück kopiert.

## Sicherheits-Kopfzeilen

Die Anwendung schickt CSP, HSTS, `X-Frame-Options`, `Referrer-Policy` und `Permissions-Policy` mit (siehe `next.config.mjs`). Eine Sache ist dabei zu beachten: Wird im Admin eine **cookiefreie Besucherstatistik** hinterlegt, muss deren Herkunft zusätzlich in der Umgebungsvariable `CSP_EXTRA_SCRIPT` stehen (z.B. `https://plausible.io`) — sonst blockiert der Browser das Skript stillschweigend.

### Zugänge anlegen

```bash
pnpm benutzer
```

Das braucht man nur einmal, für den allerersten Zugang — danach werden Konten im Büro unter **Einstellungen → Benutzer** angelegt und verwaltet.

Legt `vh@vincent-hellmann.com` und `admin@vincent-hellmann.com` mit der Rolle **Inhaber** an. Die Passwörter kommen aus `VH_PASSWORT` und `ADMIN_PASSWORT`; fehlen sie, würfelt das Skript je eines und gibt es **einmal** auf der Konsole aus. Ein zweiter Aufruf ändert an vorhandenen Konten nichts.

**Im Container** gibt es zwei Wege:

- **Über den Stack** (bequemer): `BENUTZER=true` als Umgebungsvariable setzen, Container neu starten, die Passwörter aus dem Container-Log holen — danach die Variable wieder entfernen.
- **Über die Console**: Das Image ist Alpine-basiert, es gibt also **kein `bash`** — in Portainer als Kommando `/bin/sh` wählen. Auch `pnpm` fehlt im Laufzeit-Image, deshalb direkt:

  ```sh
  node_modules/.bin/payload run scripts/benutzer.ts
  ```

## MCP-Server (Verwaltung per KI-Assistent, optional)

Die Website bringt einen eingebauten MCP-Server mit, über den sich Shop und Inhalte per Claude (oder anderem MCP-Client) verwalten lassen — Produkte, Kategorien, Referenzen, Kundenstimmen, News inkl. Facebook-/Instagram-Post, Aktionen, Bestellungen, Anfragen, Mediathek, Seitentexte und Auswertungen.

### Einrichten

1. Im Admin unter **Verwaltung → Integrationen → KI-Assistent** einen Schlüssel erzeugen und **speichern**. Dort steht darunter die fertige Verbindungs-URL zum Kopieren.
2. Verbinden:
   - **claude.ai / Cowork** (Custom Connector, ohne Header-Support): die kopierte URL mit `?key=…` eintragen.
   - **Claude Code**: `claude mcp add --transport http vh-website https://vincent-hellmann.com/api/mcp --header "Authorization: Bearer <Schlüssel>"`

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
- **Zugangsdaten bleiben außen vor.** Das Global *Integrationen* mit SMTP-, PayPal- und Facebook-Zugängen ist bewusst nicht angebunden — weder lesend noch schreibend.

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

Alles unter `https://vincent-hellmann.com/admin` — das ist die Verwaltung dessen, was auf der Website steht. Bestellungen, Anfragen, Aufträge und Zahlen liegen im **Büro** unter `/office` (siehe oben).

| Bereich | Was |
|---|---|
| **Produkte** | Titel, Bilder, Preis, Varianten (z.B. Größen), Farboptionen, „nur auf Anfrage", „auf Startseite hervorheben". Sprachumschalter oben rechts für die französische Fassung. |
| **Kategorien** | Menüpunkte der Website (Reihenfolge über Feld „Reihenfolge"); Unterkategorien über „Übergeordnete Kategorie". |
| **Referenzen** | Projekte für Kommunen, Gewerbe und Privat mit Bildern, Bereich, Jahr und Auftraggeber. Über „Verwendete Produkte" verknüpft — die Referenz erscheint dann auch auf der Produktseite und umgekehrt. |
| **Kundenstimmen** | Zitat, Name und Kontext, optional einem Produkt zugeordnet. **Nur echte Stimmen mit Einverständnis eintragen** — erfundene Bewertungen sind wettbewerbswidrig. |
| **News** | Beiträge mit Titelbild und Teaser; als Entwurf speichern oder veröffentlichen; optional Facebook- und Instagram-Checkbox (Instagram braucht zwingend ein Titelbild). |
| **Aktionen** | Rabatt (% oder €), Zeitraum, Geltungsbereich, optional Gutscheincode. Aktive Aktionen erscheinen automatisch als Banner + im Warenkorb. |
| **Fertigung** | Je Produkt eine Fertigungszeit (z.B. „3–4 Wochen“); Standardwert und Handarbeits-Hinweis stehen in den Website-Einstellungen. „Fertiges Stück — sofort lieferbar“ kennzeichnet Werkstattstücke; die werden nach dem Verkauf automatisch ausgeblendet. Stückliste und Dienstleister eines Artikels stehen im Büro unter **Artikel**. |
| **Startseite** | Hero-Slider, Mission, Galerie, Highlights, Werte. |
| **Website-Einstellungen** | Kontaktdaten, Social-Media-Links, SEO-Standardwerte, Firmen-/Steuerangaben, Handarbeits-Hinweis und Fertigungszeit sowie optional eine cookiefreie Besucherstatistik. |
| **Rechtliches** | Impressum, Datenschutzerklärung, AGB. |
| **Integrationen** | SMTP-Zugangsdaten, **Postfächer (IMAP)**, PayPal, Facebook-Token, der Claude-Schlüssel und die MCP-Schlüssel — direkt im Admin pflegbar (nur für eingeloggte Benutzer sichtbar). Leere Felder fallen auf die Umgebungsvariablen zurück. |

Das Admin-Panel ist responsiv und auch am Handy nutzbar. Die Inhaltsfelder (News, Produkte, Referenzen …) sind vollwertige Rich-Text-Editoren mit fester Toolbar: Überschriften, Fett/Kursiv, Listen, Links und Bilder mitten im Text (Upload-Button in der Toolbar). URL-Slugs können leer gelassen werden — sie entstehen automatisch aus dem Titel.

## Nach dem ersten Deployment zu erledigen

- [ ] Admin-Passwort ändern
- [ ] **Zwei-Faktor-Anmeldung** einrichten und die Ersatzcodes sicher ablegen
- [ ] **Demo-Preise** der Produkte durch echte Preise ersetzen (Seed enthält Platzhalterwerte!)
- [ ] Impressum, Datenschutzerklärung und AGB einpflegen (aktuell Platzhalter)
- [ ] SMTP-Zugangsdaten eintragen (Büro → Einstellungen → Integrationen), damit Bestell- und Kontakt-Mails rausgehen
- [ ] Büro-Zugänge anlegen (`pnpm benutzer`) und die Passwörter gleich ändern
- [ ] Postfächer eintragen (Büro → Einstellungen → Integrationen → Postfächer), damit `/office/post` Post zeigt
- [ ] Büro auf dem Handy als App ablegen und dort die Benachrichtigungen anmelden
- [ ] Unter Büro → Einstellungen → Integrationen → Takt nachsehen, ob die Automatik läuft (Standard: ja)
- [ ] NAS unter Integrationen → Sicherung eintragen und einmal „Jetzt sichern" drücken
- [ ] Bei hinterlegter Besucherstatistik: `CSP_EXTRA_SCRIPT` auf deren Herkunft setzen
- [ ] Claude-Schlüssel eintragen (Büro → Einstellungen → Integrationen), damit Belege ausgelesen werden können
- [ ] PayPal-Zugangsdaten eintragen (Büro → Einstellungen → Integrationen)
- [ ] Handarbeits-Hinweis und Standard-Fertigungszeit pflegen (Admin → Website-Einstellungen), danach je Produkt die eigene Fertigungszeit
- [ ] Optional: Facebook-Token eintragen (Büro → Einstellungen → Integrationen)
- [ ] Optional: MCP-Schlüssel erzeugen, wenn die Website per KI gepflegt werden soll (Büro → Einstellungen → Integrationen)
- [ ] Optional: cookiefreie Besucherstatistik hinterlegen (Admin → Website-Einstellungen) und einen Satz dazu in die Datenschutzerklärung aufnehmen
