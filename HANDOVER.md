# Übergabe — Stand 19.08.2026, zweiter Durchgang

Diese Datei ist für den nächsten Durchgang gedacht: was steht, was offen ist,
und welche Entscheidungen schon gefallen sind, damit sie niemand ein zweites
Mal führen muss. Sie darf gelöscht werden, sobald die offenen Punkte erledigt
sind.

---

## Wo die Arbeit liegt

**Branch:** `claude/handover-md-repository-4zemch` — er enthält den kompletten
Stand von `claude/weitere-anforderungen-o5whjc` (dem Branch des ersten
Durchgangs) plus alles Folgende. **Der alte Branch ist damit überholt.**

`main` steht weiterhin auf `c31ee2f` (PR #19). **Vor dem Merge: CI abwarten.**
Die Fassung in `package.json` ist auf **1.2.0** gehoben — von Hand gebaute
Abbilder tragen diese Nummer und lassen sich mit `VH_FASSUNG=1.2.0` auf dem
Server ausprobieren, bevor etwas auf `main` geht.

---

## Was in diesem Durchgang entschieden und gebaut wurde

### Stripe ist raus, PayPal ist die einzige Zahlart

So entschieden. Über PayPal geht auch Karte und Lastschrift ohne PayPal-Konto;
**wer nicht alles auf einmal zahlen will, vereinbart Raten mit PayPal** — beim
Betrieb kommt der Betrag als ganzer an, die Teilzahlung finanziert PayPal.
Steht so in Kasse, AGB (drei Sprachen) und README. Der Stripe-Webhook ist
ersatzlos weg (PayPal wird beim Rücksprung auf die Danke-Seite eingezogen).
Alte Bestellungen behalten Anbieter und Belegnummern; nur die Zugangsdaten
sind aus der Datenbank gefallen (Migration `stripe_ausbau`).

### Die Kasse bestätigt die E-Mail-Adresse, bevor sie bestellt

Sechsstelliger Code an die eingegebene Adresse, erst dann entsteht die
Bestellung (409 `code-noetig` → Formular blendet das Feld ein). Dieselbe
Code-Maschinerie wie das Kundenportal; wer bestätigt, hat damit gleich die
Portal-Sitzung, und wer eine gültige hat, sieht den Schritt nicht. Grund:
An der Adresse hängt der Portal-Zugang — ein Tippfehler wäre ein Datenleck
an den Besitzer der vertippten Adresse.

### Rechnungsentwürfe an den drei Auslösern

Anzahlung bei Auftragsanlage, Zwischenrechnung bei `meilenstein.erreichtAm`,
Schlussrechnung bei Status `fertig`. Immer nur ein **Entwurf** plus Meldung
aufs Handy; verschickt wird von Hand. Die Schlussrechnung zieht die Vorstufen
einzeln ab (`abzugsZeilen`), mit Nummer, Datum und Steuer. Der Zahlplan steht
als Abschrift am Auftrag (`zahlplan`-Gruppe), kommt über Anfrage → Angebot →
Auftrag vom Artikel und wird nicht nachgeführt. Kern: `lib/rechnungsstufen.ts`.

### GiroCode, Zahlungsverzug, Rollen, Navigation, Kundenportal, Benutzername

- **GiroCode** auf jeder Rechnung mit gültiger IBAN; bei unbrauchbarer keiner
  (lieber keiner als ein falscher), auf Angeboten nie.
- **Zahlungsleiste am Auftrag** (`components/office/Zahlungsleiste.tsx`):
  eingegangen/offen, überfällige Stufe, Terminvorschlag per Knopf über den
  schmalen Weg `aktion: 'termin'` — verschoben wird von Hand, nie automatisch.
  Liste zeigt „wartet auf Zahlung" getrennt von „überfällig".
- **Rollen-Oberfläche** unter Einstellungen → Benutzer; Katalog kommt vom
  Server (`/api/office/rolle`). Navigation und Übersicht blenden aus, wozu
  das Recht fehlt (`lib/buero/rechte.ts`, Rechte kommen im Abgleich-Rahmen mit).
- **Navigation oben** in vier Gruppen (Kundschaft/Werkstatt/Geld/Sonstiges)
  mit Aufklapp-Menü — gleiche Ordnung wie das Blatt am Handy.
- **Kundenportal** (`/konto`): Aufträge mit Stand, Rechnungen als PDF,
  „Ihre Anzahlung steht noch aus", Laufendes oben, Abgeschlossenes darunter.
  Wem was gehört, entscheidet **nur** `lib/portalDaten.ts`. Fremde Rechnung →
  „nicht gefunden", nie „nicht erlaubt". Anmeldecode geht jetzt auch an
  Projektkunden ohne Shop-Bestellung.
- **Benutzername statt E-Mail** fürs Büro (`loginWithUsername`, ein
  Anmeldefeld für beides). Konten ohne E-Mail verzichten auf „Passwort
  vergessen" — zurücksetzen kann die Benutzerverwaltung.

---

## Dritter Durchgang: sechs Lücken im Büro

Branch `claude/office-gaps-payment-workflows-o0lynv`, aufbauend auf dem Stand
oben. Was dazugekommen ist, im Einzelnen im Changelog; hier nur die
Entscheidungen, die man nicht am Code abliest:

**Der Zahlungsabgleich schlägt vor, er bucht nicht.** Drei Stufen (Nummer im
Verwendungszweck / Betrag und Name / einziger Betragstreffer), und bei zwei
gleichen Beträgen gar keinen Vorschlag. Eine irrtümlich abgehakte Rechnung
fällt erst auf, wenn gemahnt wird — und dann beim Kunden. Die Buchungen
bleiben mit einem Fingerabdruck aus Tag, Betrag, Gegenpartei und Zweck
liegen; Auszüge werden mit Überschneidung heruntergeladen, und beiseite
Gelegtes soll nicht wiederkommen.

**Die Stornorechnung bekommt eine Nummer aus der laufenden Reihe, keine
Stufennummer.** Als Stufe gezählt verschöbe sie den Nenner (`-1/3`) aller
anderen Rechnungen desselben Auftrags — und die liegen längst beim Kunden.
Dafür rechnet `betraege()` jetzt im Vorzeichen der Positionen; vorher stand
ein Storno mit Nachlass bei netto null.

**Die geplante Fertigungszeit steht am Auftrag, nicht am Artikel.** Aus einer
Shop-Bestellung wird sie beim Anlegen abgeschrieben. Kennt auch nur ein
Artikel im Korb seine Zeit nicht, bleibt das Feld **leer statt zu klein** —
eine zu kleine Zahl täuscht in der Auslastung eine freie Woche vor. Aufträge
ohne Schätzung stehen dort in einer eigenen Liste.

**Die Nachkalkulation ändert nichts.** Kein Preisvorschlag, keine Automatik.
Aufträge ohne erfasste Zeit zählen im Zeitvergleich nicht mit und werden
ausgewiesen; sonst sähe die Deckung besser aus, als sie ist.

**Die Portal-Annahme legt keinen Auftrag an.** Der Auftrag ist die Zusage der
Werkstatt, nicht die des Kunden — Termin, Material und Werkstattplatz
entscheidet der Betrieb. Das Büro bekommt die Annahme per Push.

**Die Kopfleiste zeigt die Produktwelten nur noch im Aufklappmenü.** Sie kamen
aus dem CMS und wurden einzeln in die oberste Reihe geschrieben — jede neue
Kategorie machte die Leiste voller, bis Punkte umbrachen. Die volle Reihe
erscheint ab 1280 px; darunter ist das Blatt ehrlicher als eine gequetschte
Zeile. Die Leiste ist bewusst breiter als der Seiteninhalt (`max-w-[88rem]`
gegen `max-w-7xl`), sonst stößt die Navigation an den Schriftzug.

**Die Wochenstunden sind kein fester Wert.** `craft.weeklyHours` ist nur noch
die Faustregel; abweichende Wochen stehen als eigene Datensätze
(`workshop-weeks`, Schlüssel `2026-38`). Leeres Feld löscht den Datensatz und
stellt die Faustregel wieder her — eine Null bedeutet dagegen ausdrücklich
„diese Woche geht nichts". Das ist nicht dasselbe, und beide Fälle kommen vor.

**Stücklisten hängen an der Variante, nicht am Artikel.** Aufgelöst wird in
`lib/material.ts` (`variantenStueckliste`, `variantenMinuten`): eigene Liste der
Variante, sonst die Grundliste des Artikels. Eine **leere** Variantenliste ist
dabei ausdrücklich „es gilt die Grundlage" und nicht „braucht kein Material" —
sonst stünde jede neu angelegte Variante ohne Material da und die
Bestandswarnung schwiege genau dann, wenn sie gebraucht wird. Die
Bestellposition trägt dafür `variantId`; die Bezeichnung ist übersetzt und
änderbar und taugt nur als Rückfallweg für Bestellungen von vorher. Dieselbe
Regel gilt für Arbeitszeit und Fremdleistung der Variante.

**Wareneingang ist ein Vorgang, keine Korrektur.** Eigene Sammlung
(`goods-receipts`) mit Lieferant, Datum, Lieferscheinnummer, Papier und Zeilen.
Gebucht wird im `afterChange`-Auslöser der Sammlung und nicht in der
Schnittstelle — so greift es auch aus dem Admin-Panel und über den KI-Zugang;
der Haken `booked` sorgt dafür, dass es genau einmal passiert. Zeilen eines
gebuchten Wareneingangs werden nicht mehr geändert: Korrigiert wird am Posten,
damit die Änderung im Verlauf steht.

**Nachbestellen fragt an, es bestellt nicht.** Die Mail an den Lieferanten
bittet um Preis und Liefertermin; verbindlich bestellt wird danach von Hand.
`reorderedAt` am Posten hält fest, dass etwas unterwegs ist — sonst stünde
dieselbe Anfrage täglich wieder auf der Liste. Ein Zugang im Bestandsverlauf
(positive Korrektur) setzt den Merker automatisch zurück. Bewusst **keine**
Bedarfsprognose aus vergangenen Aufträgen: Bei ein paar Stück im Jahr wäre das
eine Zahl mit erfundener Genauigkeit.

**Der Bestand wird als Veränderung gebucht, nicht gesetzt.** `/api/office/inventar`
mit `aktion: 'korrektur'` rechnet `delta` auf den Bestand und hängt eine Zeile
an `movements` — Grund, Zeit, Person, Rest. Das normale Speichern des
Formulars fasst `movements` bewusst nicht an: Was das Formular nicht kennt,
darf es nicht leeren. Ein negativer Bestand wird **nicht** auf null gedeckelt;
er ist die Aussage „mehr verbraucht als gebucht" und gehört sichtbar.

**Die Zahlungseingänge-Seite ist die einzige Büro-Seite ohne Offline-Betrieb.**
Sie fragt den Server, weil die Zuordnung über Geld entscheidet und überall
dieselbe sein soll — auch dann, wenn im Gerät der Bestand von gestern liegt.
Sie steht deshalb nicht im Vorrat des Service Workers.

---

## Vierter Durchgang: Erscheinungsbild und Bedienung

### Knopfhierarchie statt fünf gleich aussehender Varianten

`src/styles/office.css` kennt jetzt drei Stufen, und sie sind es auch
optisch: `.buero-knopf` primär (gefüllt in Bronze, 48 px), `.leise` sekundär
(eigene Fläche, 2 px Rahmen, 44 px), `.stumm` beiläufig (unterstrichener
Text). `.schmal` ist nur noch eine **Größe**, keine Bedeutung mehr — vorher
war es „zweitrangig", und ohne diese Umstellung wären die sechzehn
`schmal`-Knöpfe im Büro schlagartig gefüllte Hauptknöpfe geworden.

Der Kern des alten Problems steckte in einer einzigen Variablen: Trennstrich
und Bedienrahmen waren dieselbe Farbe (`--buero-linie`, 1,3:1 gegen die
Fläche). Es gibt jetzt zusätzlich `--buero-rahmen`. Wer eine neue Fläche
baut, nimmt `--buero-linie` zum Trennen und `--buero-rahmen` für alles, was
man anfassen kann.

**Genau eine primäre Aktion je Seite.** Steht daneben noch etwas, ist es
`leise` oder `stumm`. In Rechnung und Angebot wandert die Hauptsache mit dem
Stand des Vorgangs (festschreiben → verschicken → angenommen → Auftrag), und
es ist immer nur eine davon sichtbar.

### Dunkles Thema: dieselbe Ordnung, andere Mittel

Nicht invertiert, sondern drei bewusste Abweichungen (`office.css`,
`globals.css`, jeweils im `prefers-color-scheme`-Block dokumentiert):

- **Bronze dreht die Schriftfarbe um.** `#c98a52` mit weißer Schrift kommt
  auf 2,9:1. Im Dunkeln wird Bronze heller und trägt dunkle Schrift
  (`--buero-auf-bronze` bzw. `--color-on-ink`) — 7,6:1. Ohne das wäre der
  primäre Knopf ein weißer Block: das lauteste Element der Seite, egal ob
  dort „senden" oder „löschen" steht.
- **Schatten werden zu Flächen.** Im Dunkeln hebt kein Schatten etwas an;
  dort macht das eine hellere Fläche mit 5-%-Oberkante (`--buero-schatten`).
- **Kennzeichen mischen gegen `--buero-marker-grund`** — im Hellen Weiß, im
  Dunkeln die Karte. Eine Variable statt zweier Regelsätze.

Auf der Website reicht es, die `--color-*`-Variablen umzuschalten: Die
Tailwind-Utilities lesen dieselben. Zwei Ausnahmen sind Absicht — der
Fußbereich bleibt der dunkelste Block, und `text-white` auf gefüllten
Flächen wurde durch `text-on-ink` ersetzt, das mitdreht. Reines `text-white`
bleibt nur dort, wo der Grund in beiden Themen dunkel ist (Bilder, Banner,
Fußbereich).

### Der Schriftzug als Bauteil

`src/components/layout/Logo.tsx` — das SVG inline mit `fill="currentColor"`.
Damit fällt `filter: invert(1)` weg, das aus jedem Farbwert sein Gegenteil
machte und mit zwei Themen vier Sonderfälle gebraucht hätte. `public/logo.svg`
bleibt für die Verwendung als Datei (Mail, OG-Bild) und hat dafür selbst eine
`prefers-color-scheme`-Regel bekommen.

### Bedienung am Daumen

`src/components/office/Fussleiste.tsx` trägt die Hauptaktion; am Handy klebt
sie über der Tableiste, am Rechner steht sie rechts unter dem Formular.
Bewusst `position: sticky` und nicht `fixed`: Ein festgenagelter Balken
springt, sobald die Bildschirmtastatur aufgeht, weil iOS dann nur den
sichtbaren Ausschnitt verschiebt.

`src/components/office/Tastaturwache.tsx` erkennt die Tastatur über
`visualViewport` (Fensterhöhe minus sichtbare Höhe) und setzt
`html.tastatur-offen`; das Stylesheet blendet daraufhin die Tableiste aus und
nimmt die Fußleiste aus dem Kleben. Die Schwelle ist grob (120 px bzw. ein
Viertel der Höhe) — feiner wäre sie beim Ein- und Ausblenden der
Adressleiste am Flackern.

### Untere Leiste: vier Bereiche, vier Blätter

`BueroNavigation` zeigt am Handy Übersicht plus die vier Arbeitsbereiche;
jeder öffnet **sein** Blatt. Wichtig sind die drei Ebenen: abdunkelnder
Grund 30, Blatt 31, Leiste 32. Lag der Grund darüber (wie zuerst gebaut),
schluckte er den Tipp auf die Leiste und schloss das Blatt, statt in den
nächsten Bereich zu wechseln — sichtbar war das nicht, der Knopf leuchtete
auf und es passierte das Falsche. `tests/bueroleiste.spec.ts` hält das fest.

---

## Offen

1. **Plateforme Agréée: Anmeldung.** Das ist der einzige offene Punkt mit
   Datum — **1. September 2026**. Technisch ist alles da: Rechnungen entstehen
   als Factur-X, eingehende werden aus dem PDF gelesen. Offen ist der Vertrag
   mit einer zugelassenen Plattform. Der Stand steht jetzt im Büro unter
   Einstellungen → Elektronische Rechnung; bis er auf „angemeldet" steht,
   erinnert die Übersicht daran. **Das erledigt kein Code.**
2. **Hinweis aufs Kundenportal** in Bestätigungsmail und auf der Rechnung
   („Den Stand Ihres Auftrags sehen Sie unter …/konto"). Vorgeschlagen, noch
   nicht entschieden.
3. **Merge nach `main`** — CI abwarten, dann PR. Danach Abbilder als `latest`.
4. Aus dem ersten Durchgang weiter offen (Betrieb, nicht Code):
   Volumes gehören dem falschen Benutzer (`chown 1000:1000`), `SEED=true`
   steht noch im Stack, `MCP_API_KEY` und `POSTGRES_PASSWORD` sind derselbe
   Wert, übriggebliebener Container `vincent-hellmann-backup-1`.

---

## Fallen, die in diesem Durchgang Zeit gekostet haben

**Das Projekt hat keine Prettier-Konfiguration.** `npx prettier --write` läuft
deshalb mit den Voreinstellungen (doppelte Anführungszeichen, 80 Zeichen) und
formatiert das halbe Repo um — aus 51 geänderten Dateien wurden 174. Nicht
laufen lassen; ESLint (`pnpm lint`) prüft, was zu prüfen ist.

**Zwei Server auf Port 3000.** Startet man `pnpm start` neu, ohne den alten
Prozess sicher zu beenden, bindet der neue den Port nicht — und der alte
bedient weiter aus einem `.next`, das der Neubau gerade ersetzt hat. Ergebnis
sind `ChunkLoadError` und Stylesheets mit MIME-Typ `text/html`, die wie ein
Fehler im Service Worker aussehen. Erst `ps -eo pid,cmd | grep "node
server.mjs"` prüfen. `pkill -f server.mjs` ist dabei die falsche Wahl: Das
Muster trifft die eigene Shell mit.


**Payload-Hooks laufen in der Transaktion des Auslösers.** Jede Abfrage in
einem Hook braucht `req` — ohne das nimmt sie eine eigene Verbindung, sieht
den eben angelegten Datensatz nicht und wartet auf Sperren der eigenen
Transaktion. So blieb das Fertigmelden stehen (Materialbuchung schrieb auf
zweiter Verbindung an denselben Auftrag zurück) und die Anzahlung entstand
nicht. Beides behoben; bei neuen Hooks daran denken.

**PDFKit darf nicht ins Next-Bundle.** Gebündelt findet es seine
Schriftmaße (Helvetica.afm) nicht — jede über die Website ausgelieferte
PDF-Route war ein stiller 404, obwohl dieselbe Funktion in `payload run`
lief. Steht jetzt in `serverExternalPackages` (next.config.mjs). Das Abbild
kopiert node_modules mit, also trägt das auch in Docker.

**`payload migrate` bleibt stumm stehen, wenn vorher `pnpm dev` lief.** Der
Dev-Push schreibt einen `dev`-Eintrag in `payload_migrations`, und migrate
wartet dann interaktiv auf eine Antwort. Lösung:
`delete from payload_migrations where name='dev'`, dann migrieren.

**Feld-Untergrenzen fressen Abzugszeilen.** `unitPrice` hatte `min: 0` — die
negativen Abzugszeilen der Schlussrechnung scheiterten still an der
Validierung. Wer neue Betragsfelder anlegt: an Gutschriften denken.

**Playwright in dieser Umgebung:** vorinstallierter Chromium passt nicht zur
gepinnten Fassung. `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
setzen (der Haken dafür ist schon in `playwright.config.ts`). Der MCP-Test
braucht `MCP_API_KEY` am laufenden Server (CI setzt ihn).

Die Fallen aus dem ersten Durchgang gelten weiter: `NODE_ENV` bei den
Payload-Werkzeugen (migrate braucht production, run das Gegenteil),
Traefik-Prioritäten 100/200, Dateiadressen der zwei Abbilder
(`/office/_next/…`), `.buero-reiter` statt `.buero-nav` für Reiter in Seiten,
kein `type: 'row'` in Gruppen, Rechnungs- und Auftrags-Schnittstelle schreiben
immer den ganzen Datensatz (schmale Wege: `aktion: 'bezahlt'`, `aktion:
'termin'`).

---

## Wie geprüft wird

```
pnpm typecheck && pnpm lint
ADMIN_TEST_PASSWORT=… PLAYWRIGHT_CHROMIUM_PATH=… pnpm exec playwright test --reporter=line
```

Stand dieses Durchgangs: **78 von 78 grün** (1 bedingt übersprungen), Build
sauber, jede Funktion zusätzlich am gebauten Stand nachgemessen. Postgres in
der Umgebung starten wie im ersten Durchgang beschrieben (initdb + pg_ctl,
`DATABASE_URI=postgres://vh@127.0.0.1:5432/vh`).

---

## Ton und Arbeitsweise

Deutsch, auch im Code. Kommentare erklären das *Warum* und den Fall, für den
etwas gebaut ist. Commit-Nachrichten in ganzen Sätzen, mit dem Fehler, der
dahinterstand. Nicht veröffentlichen, ohne dass die Prüfung grün ist — und
lieber einmal nachmessen als einmal behaupten: Die teuersten Fehler beider
Durchgänge waren die, die still gescheitert sind.
