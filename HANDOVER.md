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

## Offen

1. **Hinweis aufs Kundenportal** in Bestätigungsmail und auf der Rechnung
   („Den Stand Ihres Auftrags sehen Sie unter …/konto"). Vorgeschlagen, noch
   nicht entschieden.
2. **Merge nach `main`** — CI abwarten, dann PR. Danach Abbilder als `latest`.
3. Aus dem ersten Durchgang weiter offen (Betrieb, nicht Code):
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
