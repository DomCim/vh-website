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
änderbar und taugt nur als Rückfallweg für Bestellungen von vorher.

**Die Zahlungseingänge-Seite ist die einzige Büro-Seite ohne Offline-Betrieb.**
Sie fragt den Server, weil die Zuordnung über Geld entscheidet und überall
dieselbe sein soll — auch dann, wenn im Gerät der Bestand von gestern liegt.
Sie steht deshalb nicht im Vorrat des Service Workers.

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
