# Übergabe — Stand 19.08.2026

Diese Datei ist für den nächsten Durchgang gedacht: was steht, was offen ist,
und welche Entscheidungen schon gefallen sind, damit sie niemand ein zweites
Mal führen muss. Sie darf gelöscht werden, sobald die offenen Punkte erledigt
sind.

---

## Wo die Arbeit liegt

**Branch:** `claude/weitere-anforderungen-o5whjc` — 49 Commits vor `main`.

`main` steht auf `c31ee2f` (Merge von PR #19). Alles danach liegt nur auf dem
Branch. **Vor dem nächsten Merge:** CI abwarten, nicht wie beim letzten Mal
vorher mergen.

**Was in der Registry liegt:**

```
ghcr.io/domcim/vh-website:latest   ghcr.io/domcim/vh-buero:latest
```

Beide zuletzt von Hand gebaut (Actions → „Docker-Image bauen &
veröffentlichen" → *Run workflow*, Auswahlfeld *Auch als latest
veröffentlichen* auf `ja`).

---

## Was seit dem letzten Stand fertig ist

### Das Büro arbeitet ohne Netz

Bestand im Gerät (IndexedDB), alle Listen rechnen im Browser, Eingaben gehen
über eine Warteschlange raus, sobald wieder Netz da ist. Eine Leiste sagt, von
wann der Stand ist. Beim Abmelden wird alles gelöscht.

**Nachgemessen mit abgeschaltetem Server**, nicht mit Playwrights
`setOffline` — das kappt den Service Worker nicht und liefert einen grünen
Test, obwohl nichts funktioniert. Wer das prüfen will, muss den Serverprozess
wirklich beenden.

### Live-Verbindung

`/ws/buero`, gemeldet wird am Datenmodell (`liveHooks`), zwischen den
Containern über Postgres `LISTEN`/`NOTIFY`. Kein Nachrichtendienst, keine
Verbindung zwischen den Containern.

### Einstellungen, Integrationen, Benutzer im Büro

Unter `/office/einstellungen`, fünf Reiter. Die Formulare entstehen aus
Payloads eigener Feldbeschreibung (`lib/felderLesen.ts`) — kommt dort ein Feld
dazu, erscheint es hier von selbst.

### Zwei Abbilder statt einem

| | enthält |
| --- | --- |
| `vh-website` | Website, Shop, Admin-Panel |
| `vh-buero` | `/office`, `/api/office`, Live-Verbindung |

Gebaut wird nur, was sich geändert hat (Auftrag `aenderungen` in
`docker.yml`). Eine reine Büro-Änderung erzeugt kein neues Website-Abbild, der
Shop-Container hat beim Ausrollen also nichts zu tun.

Getrennt wird im `Dockerfile` über `ARG ROLLE`: Vor dem Bauen verschwindet der
jeweils andere Routenbaum. **`src/components/office` bleibt im
Website-Abbild** — der Passkey-Knopf im Admin-Panel benutzt die Anmeldung des
Büros.

Im Stack: `VH_FASSUNG` setzt beide, `VH_FASSUNG_WEB` und `VH_FASSUNG_BUERO`
überstimmen einzeln.

### Rollen mit Rechten

`collections/Roles.ts`, Katalog in `lib/rechte.ts` (15 Rechte). Alle 30
Büro-Endpunkte fragen über `lib/wache.ts` nach einem **Recht**, nicht nach der
Rolle.

Drei Vorkehrungen gegen das Aussperren: Die Inhaberrolle darf immer alles,
unabhängig von Haken. Eingebaute Rollen und Rollen mit Konten daran lassen
sich nicht löschen. Das alte Auswahlfeld `role` bleibt als Rückweg stehen.

### Entwürfe am Benutzer

`collections/Drafts.ts`, `lib/buero/entwurf.ts`, `EntwurfLeiste.tsx`. Alle
sechs großen Formulare sind angeschlossen. Zwei Ablagen: sofort ins Gerät,
nach 2,5 s Ruhe zum Server. Beim Öffnen wird ein Entwurf **angeboten, nicht
eingesetzt**.

### Zahlung in Stufen (angefangen)

Fertig und geprüft:

- **Artikel:** `anzahlungProzent`, `zwischenProzent`. Der Rest ist immer die
  Schlussrechnung und wird nicht eingetragen.
- **Auftrag:** Gruppe `meilenstein` (Bezeichnung + Datum). Das Datum ist der
  Auslöser für die Zwischenrechnung. Bewusst kein Status.
- **Rechnung:** `stufe`, `auftrag`.
- **`lib/anzahlung.ts`** — die Rechenwege. Die Schlussrechnung wird *nicht
  gerechnet, sondern ist der Rest*: 1000 € gedrittelt macht sonst 999,99 €.
- **`lib/zahlungsstand.ts`** — was eine offene Rechnung für den Auftrag heißt.
- **`lib/girocode.ts`** — EPC-QR, `qrcode` war schon Abhängigkeit.
- **Rechnungsnummern:** `RE-2026-0042-1/3`. Basis und Nenner liegen am Auftrag
  (`rechnungsBasis`, `stufenGesamt`) und werden beim Stellen der ersten Stufe
  eingefroren.
- **Rechnungsliste:** Stufe, Verzugstage und ein Knopf „Eingegangen".

---

## Offen — in dieser Reihenfolge gedacht

### 1. Rechnungsentwürfe an den drei Auslösern

Noch nicht gebaut. Vereinbart:

| Stufe | Auslöser |
| --- | --- |
| Anzahlung | Auftragsbestätigung / Anlage des Auftrags |
| Zwischenrechnung | `meilenstein.erreichtAm` wird gesetzt |
| Schlussrechnung | Status → `fertig`, fällig vor Lieferung |

**Vorbereiten, nicht verschicken.** Der Auslöser legt einen Entwurf an und
setzt ihn im Büro auf die Liste; abgeschickt wird von Hand. Ein versehentlich
gesetzter Status kostet dann einen Entwurf und keine Rechnung beim Kunden.

Dazu gehört der Abzug auf der Schlussrechnung — `abzugsZeilen()` liegt bereit.
**Rechtlich der heikelste Teil:** Ohne benannten Abzug ist dieselbe
Umsatzsteuer zweimal erklärt.

### 2. GiroCode aufs Papier

`giroBild()` liefert das PNG. Es fehlt der Einbau in `lib/invoice.ts` /
`lib/dokumente.ts`. IBAN und BIC stehen in den Firmenangaben.

### 3. Zahlungsverzug sichtbar machen

`zahlungsstand()` und `terminVerschiebung()` liegen bereit, werden aber
nirgends angezeigt. Gedacht: Der Auftrag zeigt „Zahlung 9 Tage überfällig,
Fertigstellung verschiebt sich um 9 Tage" — verschieben tut der Mensch.

Bei offener **Anzahlung** wird erinnert, nicht gemahnt (so entschieden). Nach
`platzFreigebenNachTagen` fragt das Büro nach dem Werkstattplatz.

### 4. Rollen-Oberfläche im Büro

Das Datenmodell steht, die Oberfläche fehlt. Heute läuft es noch über das alte
Auswahlfeld „Inhaber / Redaktion", das im Hintergrund die passende Rolle
mitsetzt (`rolleFuer()` in `api/office/benutzer/route.ts`). Zu bauen: Rollen
anlegen, Rechte anhaken, Benutzern zuweisen. Und die Navigation sollte
ausblenden, wozu jemand kein Recht hat.

### 5. Kundenportal

Gewünscht, noch nichts gebaut. Ansatzpunkt vorhanden: `/api/konto`,
`components/shop/KontoAnmeldung.tsx`. Gedacht: Bestellungen und Aufträge des
Kunden, Rechnungen als PDF, Stand des Auftrags, und der Hinweis „Ihre
Anzahlung steht noch aus" — genau deswegen rufen Leute an.

„Fast in Echtzeit" ginge über die bestehende Live-Verbindung, bräuchte aber
eine engere Fassung: Ein Kunde darf mitbekommen, wenn sich *sein* Auftrag
ändert, und sonst nichts.

### 6. Kleinkram

- `verstaendlich()` in `api/office/sicherung/route.ts` übersetzt „Permission
  denied" — die Kasse (`api/checkout/route.ts`) gibt bei fehlender
  Stripe-Konfiguration schon `zahlung-nicht-eingerichtet` (503) zurück, aber
  die Oberfläche zeigt weiterhin den allgemeinen Text. Es fehlen die
  Wörterbuch-Einträge `checkout.errorNoPayment` in `lib/i18n.ts` (de/fr/en)
  und ihre Verwendung in `CheckoutForm.tsx`.
- `HANDOVER.md` löschen, wenn das hier erledigt ist.

---

## Beim Betrieb zu erledigen (nicht im Code)

1. **Volumes gehören dem falschen Benutzer.** Die Sicherung aus dem Büro
   scheitert mit „Permission denied". Einmalig, der Stack darf laufen:

   ```
   docker run --rm -v vincent-hellmann_backups:/b alpine chown -R 1000:1000 /b
   docker run --rm -v vincent-hellmann_media:/m   alpine chown -R 1000:1000 /m
   ```

   Seit `d1ca6c9` warnt der Container beim Start, wenn das nötig ist.

2. **`SEED=true`** steht noch im Stack. Läuft bei jedem Start durch und trägt
   gelöschte Demo-Inhalte wieder nach. Gehört auf `false`.

3. **`MCP_API_KEY` und `POSTGRES_PASSWORD` sind derselbe Wert.** Der
   MCP-Schlüssel wird herausgegeben, das Datenbank-Passwort soll nirgends hin.
   Zwei getrennte Werte, `openssl rand -hex 32`.

4. **Übriggebliebener Container** `vincent-hellmann-backup-1` aus dem alten
   Stack. Die App sichert selbst; „Prune services" in Portainer einschalten
   oder ihn löschen.

---

## Fallen, die schon einmal Zeit gekostet haben

**Payload-Werkzeuge und `NODE_ENV`.** `payload migrate` braucht
`NODE_ENV=production` — sonst steht der Adapter auf `push` und überspringt die
Migrationen *wortlos*. `payload run` braucht das Gegenteil: In
Produktionsstellung findet es die Entwicklungswerkzeuge nicht und endet ohne
Ausgabe. Beides ist in `ci.yml` richtig gesetzt; nicht „vereinheitlichen".

**Traefik-Prioritäten.** Ohne Angabe vergibt Traefik sie nach der *Länge der
Regel* — `Host(...)` allein kommt auf 26. Die Router stehen deshalb auf 100
und 200, nicht auf 1 und 10.

**Dateiadressen der zwei Abbilder.** Das Büro liefert seine Skripte unter
`/office/_next/…` (`assetPrefix` in `next.config.mjs`), weil `/_next/…` laut
Traefik-Regel zur Website geht. `tests/aufteilung.spec.ts` vergleicht die
beiden Seiten dieser Übereinkunft.

**Reiter innerhalb einer Seite** brauchen `.buero-reiter`, nicht
`.buero-nav` — letztere wird unter 720 px ausgeblendet.

**`type: 'row'` innerhalb einer Gruppe** wird im Admin still weggelassen. Die
Felder sind dann schlicht nicht da. Flach lassen.

**Die Rechnungs-Schnittstelle schreibt immer den ganzen Datensatz.** Ein
Aufruf mit nur `{ id, status }` löscht die Positionen. Für schmale Änderungen
gibt es `aktion: 'bezahlt'`; weitere gehören genauso angelegt.

**Der Service Worker darf beim Einbau nicht bummeln.** Wer dort Anfragen
verdoppelt, macht ihn so langsam, dass Prüfungen ihn nicht bereit finden.

---

## Wie geprüft wird

```
pnpm typecheck && pnpm lint
pnpm exec playwright test tests/<datei>.spec.ts --reporter=line
```

Die Oberflächen-Prüfungen brauchen `ADMIN_TEST_PASSWORT` und einen laufenden
Server; ohne das überspringen sie sich. Reine Rechenwege
(`anzahlung`, `girocode`, `zahlungsstand`, `aufteilung`) laufen ohne beides.

Postgres läuft in dieser Umgebung nicht von selbst:

```
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /var/lib/postgresql/vhdata -U vh --auth=trust"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/vhdata -o '-p 5432 -k /tmp' -l /var/lib/postgresql/vhdata/log start"
```

`DATABASE_URI=postgres://vh@127.0.0.1:5432/vh` in `.env`.

---

## Ton und Arbeitsweise

Deutsch, auch im Code. Kommentare erklären das *Warum* und den Fall, für den
etwas gebaut ist — nicht, was die Zeile tut. Commit-Nachrichten in ganzen
Sätzen, mit dem Fehler, der dahinterstand.

Nicht veröffentlichen, ohne dass die Prüfung grün ist. Und lieber einmal
nachmessen als einmal behaupten — die teuersten Fehler dieses Tages waren alle
solche, die still gescheitert sind.
