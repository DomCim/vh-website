# Verfahrensdokumentation

**Vincent Hellmann — Metallgestaltung**

Stand: 12.09.2026 · Fassung 1

---

## Wozu dieses Papier

Wer seine Aufzeichnungen elektronisch führt, muss beschreiben können, **wie**
er das tut. Die GoBD (BMF-Schreiben zu §§ 145–147 AO) nennen das eine
Verfahrensdokumentation: Ein Prüfer soll ohne Vorwissen nachvollziehen können,
auf welchem Weg ein Beleg in die Bücher kommt, was danach mit ihm geschieht,
wer daran etwas ändern kann und wie lange er aufbewahrt wird.

Dieses Papier beschreibt **den Ist-Zustand** des Büros unter `/office` — nicht
einen Wunschzustand. Wo etwas von Hand geschieht, steht das so da; wo die
Software etwas erzwingt, ist die Stelle im Quelltext genannt, damit es
überprüfbar bleibt.

> **Hinweis:** Verfasst vom Entwickler des Systems, nicht von einem
> Steuerberater. Vor der ersten Vorlage beim Finanzamt gehört es einmal durch
> die Kanzlei.

---

## 1. Der Betrieb und der Umfang

Einzelunternehmen, Metallgestaltung, Einzelfertigung. Kein Serienbau: Jedes
Stück entsteht einzeln, auf Anfrage oder über den Shop.

**Im System geführt werden:**

| Bereich | Was darin liegt |
|---|---|
| Ausgangsrechnungen | Rechnungen an Kommunen, Gewerbe und Privat |
| Shop-Bestellungen | Verkäufe über die Website, Zahlung über PayPal |
| Belege | Eingangsrechnungen und Ausgaben, mit Bild oder PDF |
| Aufträge | Fertigungsaufträge samt Zeiten, Material und Ablauf |
| Angebote | Angebote und deren Antwort |
| Inventar | Lagerbestand, Zugänge, Abgänge, Inventur |
| Lieferantenbestellungen | Was bestellt und was geliefert wurde |
| Geschäftspartner | Kunden, Lieferanten, Dienstleister |
| Kontobewegungen | Eingelesene Umsätze zum Abgleich mit Rechnungen |

**Nicht im System:** die Buchführung selbst. Gebucht wird in der Kanzlei; das
Büro liefert die Grundaufzeichnungen und den Export (Abschnitt 6).

---

## 2. Wie ein Beleg hereinkommt

Es gibt **drei Wege**, und alle enden im selben Datensatz:

1. **Foto in der Werkstatt.** Tankquittung, Baumarktbon, Materialrechnung —
   abfotografiert unter `/office/belege/neu`. Bild oder PDF hängen am Beleg.
2. **Aus dem Postfach.** Der Takt sieht regelmäßig ins Mailfach; PDF-Anhänge,
   die wie eine Rechnung aussehen, werden als Belegentwurf angelegt.
3. **Von Hand erfasst**, wenn kein Papier vorliegt (z.B. Bankgebühren).

**Erkennung und Prüfung.** Was maschinell aus einem PDF gelesen wurde, steht
zunächst auf `ungeprueft` — mit der Sicherheit, mit der es gelesen wurde.
Erst wenn ein Mensch den Beleg speichert, wird daraus `bestaetigt`. Ungeprüfte
Belege stehen als eigener Filter in der Liste und als Zahl auf der Übersicht;
sie gehen also nicht unter.

**Was am Beleg festgehalten wird:** Lieferant, Rechnungsnummer,
Rechnungsdatum, Kategorie, Bruttobetrag, Steuersatz, bezahlt ja/nein,
Fälligkeit, steuerlich absetzbar ja/nein, dazu das Bild.

---

## 3. Wie eine Ausgangsrechnung entsteht

**Nummernkreis.** `RE-<Jahr>-<vierstellig>`, z.B. `RE-2026-0007`. Die Nummer
kommt aus einem eigenen Zähler (`Counters`), der über ein einzelnes atomares
SQL-Statement hochgezählt wird (`lib/nummernkreis.ts`) — **nicht** aus „Anzahl
vorhandener Datensätze + 1". Damit ist die Reihe lückenlos und chronologisch,
auch wenn ein Datensatz verschwindet. Eigene Kreise gibt es für Angebote
(`AN-`), Aufträge (`AU-`), Shop-Bestellungen (`VH-`), Wareneingänge (`WE-`)
und Lieferantenbestellungen (`LB-`).

**Entwurf und Festschreiben.** Solange eine Rechnung keine Nummer trägt, ist
sie ein Entwurf und frei änderbar. Mit dem Festschreiben bekommt sie ihre
Nummer — und ist ab diesem Moment **gesperrt**: Der Server weist jede weitere
Änderung mit `409 schon-gestellt` ab
(`app/(office)/api/office/rechnung/route.ts`). Erlaubt bleiben nur noch drei
Wege, und die ändern den Inhalt nicht:

- **bezahlt** setzt das Zahldatum,
- **stornieren** legt die Gegenrechnung an,
- **verschicken** erzeugt Papier und Mail.

**Korrektur nur über Storno.** Eine gestellte Rechnung wird nicht berichtigt,
sondern storniert; dabei entsteht eine Gegenrechnung mit eigener Nummer, die
auf die stornierte verweist (`stornoVon`). Beide Papiere bleiben stehen. Für
Umsatz- und Offene-Posten-Rechnungen zählt das stornierte Paar zusammen null
(`lib/zahlungsstand.ts`).

**Löschen ist gesperrt.** Eine Rechnung mit Nummer lässt sich weder im Büro
noch über die Schnittstelle löschen.

**Form.** Ausgangsrechnungen entstehen als PDF/A-3 mit eingebettetem
Factur-X/ZUGFeRD-XML nach EN 16931. Der Steuerfall (Inland, innergemein­schaft­liche
Lieferung, Reverse Charge) steht als Code im XML und als Satz auf dem Papier.

---

## 4. Wer was darf

Zugang nur mit eigenem Konto (E-Mail und Kennwort, wahlweise Passkey oder
Zwei-Faktor). Jedes Konto trägt genau eine Rolle, jede Rolle ein Bündel
Rechte:

`buero.oeffnen` · `anfragen.bearbeiten` · `angebote.schreiben` ·
`auftraege.bearbeiten` · `rechnungen.schreiben` · `belege.erfassen` ·
`inventar.pflegen` · `partner.pflegen` · `zahlen.sehen` · `postfach.lesen` ·
`newsletter.versenden` · `website.pflegen` · `sicherung.ausloesen` ·
`benutzer.verwalten`

Eingebaut sind **Inhaber** (darf alles) und **Redaktion** (nur die Website).
Weitere Rollen lassen sich unter `/office/einstellungen` anlegen.

Die Rechte wirken **nicht nur in der Anzeige**: Der Abgleich, der die Daten
auf ein Gerät bringt, liefert nur die Bereiche, die das Konto sehen darf
(`lib/bereiche.ts`, `BEREICH_RECHTE`). Ein Werkstattkonto bekommt Aufträge und
Inventar, aber keine Rechnungen, Belege oder Kontobewegungen — auch nicht in
den Zwischenspeicher seines Geräts.

---

## 5. Unveränderbarkeit und Nachvollziehbarkeit

Drei Mechanismen, und sie greifen an verschiedenen Stellen:

**a) Sperre.** Eine festgeschriebene Rechnung ist unveränderlich (Abschnitt 3).

**b) Änderungshistorie.** Ausgangsrechnungen, Belege, Angebote und
Shop-Bestellungen führen seit dem 12.09.2026 eine Versionshistorie: Jedes
Speichern legt den vorherigen Stand ab, mit Zeitpunkt und Benutzer. Damit ist
erkennbar, wenn etwa der Betrag eines Belegs nachträglich geändert wurde.

> **Ehrlich dazu:** Vor dem 12.09.2026 gab es diese Historie nicht. Änderungen
> an Belegen aus der Zeit davor sind nicht rekonstruierbar; die Belege selbst
> (Bild/PDF) liegen unverändert vor.

**c) Löschen ist zweistufig.** Was weggeworfen wird, landet im Papierkorb und
bleibt dort, bis es jemand ausdrücklich endgültig entfernt. Über jede
Löschung entsteht zusätzlich ein Grabstein (`Deletions`), damit die Geräte
mitbekommen, was verschwunden ist; Grabsteine werden nach 60 Tagen
aufgeräumt. Für gestellte Rechnungen ist auch der erste Schritt gesperrt.

---

## 6. Auswertung und Übergabe an die Kanzlei

Unter `/office/steuer` steht je Kalenderjahr:

- eine **Tabelle für Menschen** (Datum, Partner, Kategorie, Netto, Steuer,
  Brutto),
- ein **DATEV-Buchungsstapel im EXTF-Format**, den die Kanzlei direkt
  einliest — dieselben Daten, nur ohne Abtippen.

Für den Stapel braucht es Berater- und Mandantennummer; fehlen sie, sagt die
Seite das und bietet den Export nicht an.

Belege lassen sich zusätzlich als Monatspaket an die Kanzlei schicken.

---

## 7. Aufbewahrung und Sicherung

**Wo die Daten liegen.** PostgreSQL-Datenbank und ein Dateispeicher für
Bilder und PDFs, beides in getrennten Datenträgern des Containers.

**Sicherung.** Die Anwendung sichert sich selbst: Datenbank **und** Dateien in
einem Archiv, anschließend auf ein zweites Gerät (NAS) geschoben. Ausgelöst
wird sie vom Takt-Container, zusätzlich von Hand unter `/office/sicherung`.
Wie viele Stände lokal und auf der NAS behalten werden, ist einstellbar.

Der Grund für „beides zusammen": Eine Datenbanksicherung ohne die Dateien wäre
wertlos — sie verwiese auf Belegbilder, die es dann nicht mehr gäbe.

**Überwachung.** Bleibt die Sicherung länger als 36 Stunden aus, meldet der
Wartungslauf das im Büro (`lib/wartung.ts`, `stillstandPruefen`). Dasselbe
gilt für den Postfach-Abruf.

**Aufbewahrungsfrist.** Die gesetzlichen Fristen werden vom System **nicht**
überwacht, und es wird nichts automatisch gelöscht — was erfasst ist, bleibt
stehen, bis ein Mensch es wegwirft. Aufgeräumt werden nur technische Nebendaten
(Grabsteine nach 60 Tagen, alte Sicherungsstände nach Einstellung).

---

## 8. Das System

| | |
|---|---|
| Anwendung | Next.js 15, Payload CMS 3, PostgreSQL |
| Betrieb | Docker, zwei Container (Website/Shop und Büro) plus Takt |
| Erreichbar | `https://www.vincent-hellmann.de` (Büro unter `/office`) |
| Verschlüsselung | TLS über den vorgelagerten Proxy, erzwungen |
| Datenhaltung | Deutschland/EU |
| Versionsstand | siehe `/api/healthz` — nennt den Stand, mit dem das laufende Abbild gebaut wurde |

**Änderungen am System** entstehen über ein Versionsverwaltungssystem (Git).
Jede Änderung ist als Commit mit Datum, Urheber und Begründung
nachvollziehbar; ausgerollt wird ein Abbild, das aus einem bestimmten Stand
gebaut wurde. Was sich für den Betrieb ändert, steht zusätzlich im Büro unter
`/office/neuerungen`.

**Schnittstellen nach außen:** PayPal (Zahlung im Shop), Mailversand und
IMAP-Postfach, CalDAV (Kalender), eine abgesicherte Schnittstelle für den
KI-Assistenten (nur mit Freigabe, und alles, was Geld oder Recht berührt,
entsteht dort ausschließlich als Entwurf).

---

## 9. Was von Hand geschieht

Bewusst nicht automatisiert — und das gehört in dieses Papier, weil ein
Prüfer sonst eine Automatik vermutet, die es nicht gibt:

- **Festschreiben und Verschicken** von Rechnungen, Angeboten und Mahnungen
- **Buchen einer Zahlung** als „bezahlt" (mit Vorschlag aus den
  Kontobewegungen, aber ohne automatische Zuordnung)
- **Prüfen** maschinell gelesener Belege
- **Stornieren**
- **Auslösen** der Sicherung, wenn sie außer der Reihe gebraucht wird

---

## 10. Änderungen an diesem Papier

| Datum | Fassung | Was |
|---|---|---|
| 12.09.2026 | 1 | Erstfassung. Anlass: Änderungshistorie für Rechnungen, Belege, Angebote und Bestellungen eingeschaltet. |
