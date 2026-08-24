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

## Fünfter Durchgang: Bauunterlagen und Bilder

### Werkstattdateien (`product-files`)

Eigene Sammlung, **nicht** die Mediathek: Die ist öffentlich lesbar, weil sie
die Bilder der Website ausliefert. Eine Laserdatei dort abzulegen hieße, sie
ins Netz zu stellen. `access.read` ist deshalb `office`, und
`/api/office/werkstattdatei/[id]` prüft die Anmeldung, bevor es die Datei
ausliefert — mit `Content-Disposition` auf den Originalnamen, denn auf der
Platte steht ein Zeitstempel davor (zwei Varianten hätten sonst dieselbe
`zuschnitt.dxf`).

Abgelegt wird unter `media/werkstattdateien`, also **im vorhandenen
media-Volume**. Ein eigenes Volume wäre die sauberere Schublade, verlöre aber
beim ersten Ausrollen ohne angepassten Stack alle Dateien; hier ist es
persistent und die nächtliche Sicherung nimmt es mit.

**Die Ordner stehen am Artikel** (`products.fileFolders`), nicht an der Datei:
Nur so kann ein Ordner leer bestehen, und genau das braucht man, wenn man
eine Struktur vorbereitet. Eine flache Liste für Artikel und Varianten
zusammen; `variantId` leer heißt „Grundlage", dieselbe Lesart wie bei der
Stückliste. Beim Umbenennen zieht die Schnittstelle die Dateien nach — sie
tragen den Ordner als Namen, nicht als Verweis.

### Artikelbild auf den Papieren

Positionen in `quotes.items`, `outgoing-invoices.items` und `jobs.positions`
haben ein freiwilliges `product`. Es trägt keine Zahl und keinen Text, nur das
Bild. Aus einer Shop-Bestellung wird es gesetzt, durch Angebot → Auftrag →
Rechnung wandert es mit.

**Die Falle dabei: PDFKit kann nur PNG und JPEG.** Die Größenstaffelung der
Mediathek liefert WebP — gut für die Website, für ein PDF unbrauchbar.
`doc.image()` wirft dann, der Auffangblock schluckt es, und im Dokument fehlt
das Bild, ohne dass jemand etwas merkt. `lib/artikelbild.ts` sucht deshalb die
kleinste Fassung, die PDFKit auch lesen kann; in aller Regel ist das die
hochgeladene Originaldatei. Wer dort etwas ändert: mit einem echten Bild
prüfen, nicht mit dem 1×1-Pixel aus den Startdaten — bei dem sieht man am
Dateiumfang keinen Unterschied.

### Zeichen und Bereichsfarben

`PUNKT_ZEICHEN` in `BueroNavigation` hält je einen Umriss pro Ziel, die Farbe
kommt über `--bereich` aus der Bereichsklasse (`bereich-werkstatt` usw.). Wer
einen Navigationspunkt ergänzt, ergänzt dort auch sein Zeichen — fehlt es,
bleibt die Stelle einfach leer, es bricht nichts.

---

## Die Kennung einer Variante trägt alles

`products.variants[].id` — die Zeilenkennung, die Payload beim Anlegen vergibt
— ist der Anker für Stückliste, Fremdleistung, Arbeitszeit, Werkstattdateien
samt Ordnern und für die Bestellpositionen, die sagen, welche Größe jemand
gekauft hat. Der **Name** ist nur Anzeige und Rückfallweg für alte
Bestellungen.

Das trägt, solange jede Schreiboperation die Kennungen mitschickt. Payload
vergibt sonst neue, und zwar lautlos: Die Variante heißt danach gleich, aber
Stückliste, Minuten und Zeichnungen sind ab. Gemessen am laufenden Stand —
dieselbe Liste ohne Kennungen geschrieben:

    vorher   6a860739…c201 | 60 × 30 cm | Stückliste: 1 | Minuten: 42
    nachher  6a86bcf1…7be3 | 60 × 30 cm | Stückliste: 0 | Minuten: null
             die Werkstattdatei zeigt weiter auf 6a860739…c201 — ins Leere

Wer `variants` schreibt, ordnet deshalb über `variantenZuordnen`
(`lib/material.ts`) zu: erst die mitgegebene Kennung, dann der bisherige Name,
dann die Position, solange die Anzahl gleich bleibt (das ist der
Übersetzungsfall — dort ändert sich jeder Name). Das Büro (`/api/office/
stueckliste`) liest die bestehenden Zeilen und schreibt sie mit ihrer Kennung
zurück; der KI-Zugang (`produkt_varianten_setzen`) nimmt zusätzlich eine
`kennung` entgegen, die `produkt_lesen` mitliefert.

---

## Übergabemappe (`customer-uploads`)

Der Weg, auf dem Unterlagen mit der Kundschaft hin und her gehen — gebaut für
Lohnfertigung, wo die Daten **vor** der Entscheidung kommen.

**Sie hängt an einem Menschen, nicht in der Luft.** Die Schnittstelle verlangt
beim Anlegen einen Geschäftspartner oder eine Anfrage; die Bezeichnung entsteht
daraus (`mappenTitel`). Angebot und Auftrag kommen später dazu. Alle Anker der
Mappe werden beim Hochladen an die Datei kopiert — so steht die Zeichnung
später am Auftrag und nicht nur in einer Mappe, an die sich niemand erinnert.

**Zugang.** Kennung (24 zufällige Bytes) in der Adresse, dazu ein Passwort aus
acht Zeichen ohne `I l O 0 1` — eines zum Durchsagen. Verwahrt wird es mit
`scrypt` samt eigenem Salz (`scrypt$salz$abdruck`); im Klartext steht es
**einmal** in der Antwort ans Büro und danach nirgends. Sieben Tage Gültigkeit,
mehrere Zugänge je Mappe (der zweite Link nimmt dem ersten nichts). Nach dem
Passwort trägt der Besucher ein signiertes Cookie für genau diese Mappe, das
nie länger lebt als der Zugang. Zehn Fehlversuche je Viertelstunde und Adresse.
Nach außen sind „gibt es nicht", „abgelaufen" und „zurückgezogen" **dieselbe**
Antwort — sonst verrät der Fehlercode, welche Kennungen existieren.

**Beide Richtungen.** `product-files.herkunft` sagt, wer die Datei abgelegt
hat; `freigabe` sagt, ob der Auftraggeber sie sehen darf. `fuerKunden()` fasst
beides zusammen: eigene immer, fremde nur nach ausdrücklicher Freigabe.
Gespeichert ist voreingestellt **nicht freigegeben**; die Mappenansicht setzt
das Häkchen beim Hochladen sichtbar auf „ja", weil man dort in den Ordner des
Auftraggebers legt — abwählbar, bevor etwas hinausgeht.

**500 MB je Datei, mehrere auf einmal.** Der übliche Weg (`req.formData()` →
`Buffer` → Payload) hielte die Datei zweimal vollständig im Speicher. Deshalb:
Die Datei kommt **unverpackt** als Rumpf der Anfrage, Name und Ordner stehen in
der Adresszeile; `stromAblegen()` schreibt sie stückweise nach
`media/werkstattdateien`, und erst danach entsteht der Datensatz mit
`filename`, `mimeType` und `filesize` von Hand gesetzt (`dateiEintragen()`).
Das umgeht Payloads Upload-Verarbeitung bewusst — die läse die Datei erneut
komplett ein (`getFileByPath`) und hat bei Zeichnungen ohnehin nichts zu tun.
Hooks, Live-Meldungen und das Löschen der Datei beim Löschen des Datensatzes
laufen unverändert, denn der Datensatz entsteht normal über `payload.create`.
Der Browser schickt die Auswahl **nacheinander** (`auswahlSenden`), mit
Fortschrittsbalken je Datei; `fetch` meldet keinen Fortschritt, deshalb XHR.

**Erlaubt ist eine Liste, nicht eine Ausschlussliste** (`dateigrenzen.ts`).
Der Ordner steht im Netz; `html`, `svg` und ausführbare Dateien fehlen mit
Absicht. Was nicht draufsteht, wird mit dem Hinweis „bitte als ZIP packen"
abgelehnt. `dateiName()` macht aus keinem Namen einen Pfad
(`../../etc/passwd` → `passwd`).

**Wichtig beim Ausrollen:** Der Reverse Proxy muss 500 MB durchlassen — Nginx
Proxy Manager steht standardmäßig weit darunter, und dann endet der Upload mit
413, bevor irgendetwas hier ankommt. Die Dateien liegen im bestehenden
Medien-Volume, das die nächtliche Sicherung mitnimmt; sie wird dadurch
wachsen.

Dateien: `lib/uebergabe.ts` (Zugang, Passwort, Sitzung), `lib/dateigrenzen.ts`
(Grenzen, auch im Browser), `lib/dateiAblage.ts` (Strom auf die Platte),
`lib/mappenZugang.ts` (Kennung → Mappe), `lib/hochladen.ts` (Browser),
`collections/CustomerUploads.ts`, Büro unter `/office/uebergabe`, öffentlich
unter `/[locale]/uebergabe/[token]`.

---

## Sprache beim ersten Aufruf (`middleware.ts`)

Bis hierher leitete `/` fest auf `/de` um. Für eine Werkstatt in Frankreich mit
Kundschaft auf beiden Seiten der Grenze war das die falsche Voreinstellung für
die halbe Zielgruppe.

**Die Reihenfolge** (`lib/sprachwahl.ts`, dort auch die Begründungen): eigene
Wahl aus dem Cookie `vh-sprache` — dann `Accept-Language` — dann **Englisch**,
wenn ein Wunsch da war, den wir nicht erfüllen können (Italienisch, Spanisch) —
und `de` nur, wenn gar kein Wunsch geäußert wurde. Der letzte Fall ist kein
Mensch mit Vorliebe, sondern ein Programm; dort gilt dieselbe Sprache wie in
`x-default`. Die Region wird **nicht** gelesen: Sie sagt, wo jemand steht,
nicht was er liest.

**Gemerkt wird nur der Klick** in der Sprachwahl (`SprachWahl.tsx` setzt das
Cookie, ein Jahr). Nicht jeder Aufruf einer französischen Adresse — sonst
stellte ein weitergeleiteter Link die Sprache eines Menschen um, der ihn bloß
angesehen hat.

**Was die Middleware nicht anfasst**, und zwar aus gutem Grund: `/api`,
`/office`, `/admin`, `/_next`, `/media`, `/js` und alles mit einem Punkt im
Namen. Eine Umleitung dort wäre kein Sprachwechsel, sondern ein Ausfall — der
Abhol-Link des Zulieferers zeigt auf `/api/weitergabe`, die installierte
Büro-App holt `/office-sw.js`. Der Filter steht in `config.matcher`; wer ihn
anfasst, prüft ihn gegen genau diese Pfade nach.

Umgeleitet wird mit **307**, nie 308: Das Ziel hängt am Besucher und darf sich
nicht dauerhaft in einem Zwischenspeicher festsetzen. `Vary: Accept-Language,
Cookie` steht aus demselben Grund dabei. `x-default` in den hreflang-Angaben
bleibt Deutsch.

---

## Dateien weitergeben (`/api/weitergabe`)

Der kurze Weg zum Zulieferer, neben der Mappe und bewusst nicht in ihr.

**Warum nicht die Mappe.** Bei Lohnfertigung ohne eigenen Artikel ist die
Mappe richtig: Es gibt einen Ordner, es geht hin und her, es wird hochgeladen.
Für „hier ist die DXF, bitte schneiden" ist sie zu viel Apparat — anlegen,
Bezug wählen, Datei erneut hochladen, Passwort erzeugen. Am Ende lag dieselbe
Zeichnung zweimal im Haus, mit zwei Ständen.

**Wie es läuft.** An der Artikeldatei ein Kästchen, Adresse, abschicken
(`components/office/Werkstattdateien.tsx` → `/api/office/weitergabe`). Je
Datei entsteht ein Link, dessen Signatur Kennung und Ablaufzeit festnagelt
(HMAC mit `PAYLOAD_SECRET`, `lib/weitergabe.ts`); vierzehn Tage, kein
Passwort, kein Konto. Gespeichert wird **nichts** — kein Datensatz, keine
Migration. Dieselbe Bauart wie beim Abhol-Link des Monatspakets.

**Was das kostet.** Ein verschickter Link lässt sich nicht zurückziehen; dazu
müsste festgehalten werden, welche es gibt, und dann wäre es eine halbe Mappe.
Wer einen loswerden muss, löscht die Datei oder ersetzt sie — beides wirkt
sofort, weil immer der Stand von jetzt ausgeliefert wird. Genau das ist auch
der Gewinn: Eine Revision geht automatisch mit hinaus, der Anhang in der Mail
veraltet ab dem Absenden.

**Recht.** `auftraege.bearbeiten`, nicht `website.pflegen`: Wer Dateien am
Artikel pflegt, arbeitet im Haus; wer sie hinausgibt, entscheidet über
Fremdfertigung. Die Werkstattrolle, die unter „Unterlagen" nachschlägt, sieht
die Kästchen deshalb nicht.

Dateien: `lib/weitergabe.ts` (Signatur, Frist), `api/weitergabe` (Abholung,
Strom von der Platte), `api/office/weitergabe` (Auswahl und Mail),
`components/office/Werkstattdateien.tsx` (die Kästchen).

---

## Dateien am Vorgang, im Portal und beigestelltes Material

**Am Vorgang.** `product-files` trägt neben `product` jetzt `anfrage`,
`angebot`, `auftrag` und `mappe`. Genau einer ist gesetzt; die Schnittstelle
(`/api/office/vorgangsdatei`) besteht darauf und prüft bei jeder Änderung, dass
die Datei wirklich an diesem Vorgang hängt — sonst wäre die Nummer in der
Anfrage ein Generalschlüssel auf jede Werkstattdatei im Haus. Angezeigt wird
das über `components/office/Vorgangsdateien.tsx` an Anfrage, Angebot und
Auftrag. Mappendateien tragen die Anker ihrer Mappe, damit sie dort mit
auftauchen.

**Im Portal.** `/api/konto/datei` (Liste, Upload) und `/api/konto/datei/[id]`
(Download). Wem was gehört, entscheidet ausschließlich `lib/portalDaten.ts` —
neu dort: `darfAuftragSehen`. Der Download prüft **zwei** Dinge: Der Vorgang
gehört dieser Adresse, und die Datei ist für die Kundschaft bestimmt
(`fuerKunden`). Ohne das zweite wäre die Nummer ein Schlüssel auf das
Kalkulationsblatt zum eigenen Auftrag. Die Ansicht ist zugeklappt und lädt
erst beim Aufklappen — sonst stellte die Übersicht bei zehn Aufträgen zehn
Anfragen, von denen neun niemanden interessieren.

**Beigestelltes Material.** `jobs.material[].beigestellt`. Drei Stellen lesen
es, und jede fälschte sonst eine Zahl: der `afterChange`-Hook in
`collections/Jobs.ts` (kein Abzug vom Bestand), `materialkosten()` in
`lib/nachkalkulation.ts` (kostet null) und `bestandsPruefung()` in
`lib/buero/material.ts` (fehlt nie). Auf dem Lieferschein steht es als eigener
Block unter den Positionen — es ist keine Lieferung, sondern sein Material,
das zurückkommt.

---

## Offen

1. **Plateforme Agréée: Auswahl und Anbindung.** Das ist der einzige offene
   Punkt mit Datum — **1. September 2026**. Technisch ist alles da: Rechnungen
   entstehen als Factur-X, eingehende werden aus dem PDF gelesen. Offen ist
   der Vertrag mit einer zugelassenen Plattform. Der Stand steht im Büro unter
   Einstellungen → Elektronische Rechnung; bis er auf „angemeldet" steht,
   erinnert die Übersicht daran. **Die Auswahl erledigt kein Code.**

   Mit Dominik besprochen (August 2026): Angebunden wird per
   **Schnittstelle**, nicht durch Hochladen von Hand. Bei der Auswahl —
   am besten mit dem Steuerberater, dessen Software oft eine Plattform
   mitbringt — auf drei Dinge achten: eine ordentliche REST-API mit
   Webhooks, faire Preise je Rechnung, Zugriff für den Steuerberater.
   Wichtig: Standardisiert ist nur der Verkehr *zwischen* den Plattformen;
   die API für die eigenen Kunden ist bei jedem Anbieter anders — die Wahl
   bestimmt also die Anbindungsarbeit. Nicht auf den letzten Drücker: Die
   Anbieter laufen gegen den Stichtag voll, und die Strecke soll ein paar
   Monate im echten Betrieb gelaufen sein, bevor sie Pflicht wird.

   Sobald die Plattform feststeht, wird gebaut: ausgehend Rechnung per API
   übergeben und Statusmeldungen (zugestellt, abgelehnt, bezahlt) an die
   Rechnung zurückschreiben; eingehend den Eingangskorb abholen und daraus
   Belegentwürfe anlegen. Die Bausteine liegen alle im ERP —
   `facturx.ts` schreibt, `facturxLesen.ts` liest, Belegstrecke und
   Statuswesen stehen; es fehlt nur das Kabel zur Plattform. Nicht ins
   Netz gehört: Privatkunden und ausländische Lieferanten bleiben beim
   heutigen Mail- und Beleg-Weg, deren Umsätze laufen später nur ins
   E-Reporting über dieselbe Plattform.
2. **Hinweis aufs Kundenportal** in Bestätigungsmail und auf der Rechnung
   („Den Stand Ihres Auftrags sehen Sie unter …/konto"). Vorgeschlagen, noch
   nicht entschieden.
3. **Umzug auf `vincent-hellmann.com`.** Entschieden: maßgeblich ist die
   Adresse **ohne `www`**; `.de`, `.fr` und alle `www`-Schreibweisen leiten
   dauerhaft dorthin um, und zwar als Redirection Hosts im Nginx Proxy Manager
   (nicht in Traefik — sonst liefe jede Umleitung erst durch die ganze Kette).
   `vh.dominikdill.com` wird abgeschaltet. Der Stack trägt die neuen Vorgaben
   bereits; zu tun bleibt die Arbeit am Server. Reihenfolge, NPM-Einstellungen
   und die Fallen stehen im README unter **Domains** — insbesondere:
   `NEXT_PUBLIC_SERVER_URL` und der NPM-Host müssen im **selben** Schritt
   umgestellt werden, sonst prüft Payload die Herkunft gegen die alte Adresse
   und jede angemeldete Anfrage endet mit 403 (das Büro lädt und bleibt leer).
   Ungültig werden dabei: alle Passkeys (der Browser bindet sie an die
   Adresse), alle offenen Anmeldungen, und schon verschickte Übergabelinks,
   sobald die alte Adresse weg ist.
4. **Merge nach `main`** — CI abwarten, dann PR. Danach Abbilder als `latest`.
5. Aus dem ersten Durchgang weiter offen (Betrieb, nicht Code):
   Volumes gehören dem falschen Benutzer (`chown 1000:1000`),
   übriggebliebener Container `vincent-hellmann-backup-1`, und `SEED=true`
   im Stack ist zu prüfen — auf dem letzten Blick in Portainer stand es nicht
   mehr in der Liste, bestätigt ist das aber nicht.
   Erledigt: `MCP_API_KEY` ist aus dem Stack raus — der Schlüssel steht im
   Büro unter Integrationen, und der Wert aus der Datenbank gewinnt ohnehin
   gegen die Umgebungsvariable. Damit ist auch der Doppelgebrauch desselben
   Wertes als Datenbank-Passwort vom Tisch.
6. **Beim Ausrollen einmal die X-Forwarded-For-Kette nachmessen.** Das
   Anmelde-Limit nimmt jetzt den ersten öffentlichen Eintrag von rechts
   (eigene Proxys — NPM, Traefik — haben private Adressen und werden
   übersprungen). Das ist konfigurationsfrei und sollte hinter der ganzen
   Kette stimmen; ein Blick in die echten Header nach dem Deploy kostet
   eine Minute und beendet die Frage.
7. **Aus dem ERP-Audit bewusst verschoben** (Reihenfolge nach Nutzen, nichts
   davon blockiert den Betrieb):
   - **Einkaufs-Bestellwesen.** `reorderedAt` ist nur ein Merker; bestellte
     Menge, Liefertermin und Prüfung des Wareneingangs gegen die Bestellung
     gibt es nicht. Teillieferungen und Überlieferung fallen nicht auf.
   - ~~**Storno einer Shop-Bestellung ist folgenlos**~~ — **erledigt
     (08/2026).** Das Stornieren bucht Werkstattstücke zurück in den Laden,
     bricht den verknüpften Auftrag ab (außer er ist schon geliefert) und
     legt die **Rückabwicklung** als Vorgang an der Bestellung an
     (`orders.rueckgabe`: Grund storno/widerruf/reklamation, Stand offen →
     wareZurueck → erstattet/abgelehnt, Betrag, Zeitpunkte, Notiz). Auch per
     MCP: `rueckgabe_erfassen`.

     **Bewusst offen bleibt die Erstattung selbst.** Der Weg über PayPal
     gäbe es, wäre aber der einzige Vorgang im Haus, der auf einen Klick hin
     unumkehrbar Geld verschiebt — dieselbe Linie wie bei Rechnungen und
     Mahnungen. Wer das ändern will, ändert damit eine Entscheidung, nicht
     nur Code.
   - ~~**Versand ist ein fester Betrag je Stück, ohne Blick auf die
     Anschrift.**~~ — **erledigt (08/2026).** Versandzonen als Global
     (`globals/Versand.ts`, Logik in `lib/versand.ts`): Länder je Zone plus
     ein Aufschlag je Stück. Kasse, Produktfeed und strukturierte Daten lesen
     dieselbe Quelle — vorher hatten alle drei eine eigene Vorstellung davon,
     wohin geliefert wird. Ohne gepflegte Zone gilt der Stand von vorher
     (FR/DE/AT, kein Aufschlag). Offen bleibt die Schweiz im Produktfeed: Der
     rechnet in Euro, das Merchant Center bräuchte dort Franken.
   - **Zahlungsabgleich für Ausgaben.** Der Kontoauszug-Abgleich schlägt nur
     eigene Rechnungen vor; Belege (`expenses.paid`) müssen weiter von Hand
     abgehakt werden.
   - ~~**Postfach kann beim Antworten keine Anhänge mitschicken**~~ —
     **erledigt (08/2026).** `api/office/post` nimmt beim Senden zusätzlich
     `multipart/form-data` an: JSON im Feld `daten`, Dateien in `dateien`.
     Grenze 25 MB zusammen, geprüft **vor** der Postfachsuche, weil ein
     Mailserver sonst erst nach dem Hochladen ablehnt.
   - ~~**Ein Ratgeber führt nirgendwo hin, und eine Referenz endet in einem
     leeren Maßformular.**~~ — **erledigt (08/2026).** News tragen
     `relatedProducts` (unter dem Text als Kacheln, auch per MCP setz- und
     lesbar); der Knopf an einer Referenz heißt „So etwas anfragen" und
     reicht Titel und Pfad bis in die Anfrage durch — vorbelegter Text,
     Mail-Betreff und eigene Felder `referenceTitle`/`referenceUrl`.
   - **Bestandsabbuchung beim Shop-Verkauf.** Ein verkauftes Einzelstück
     wird nur auf „nicht verfügbar" gestellt; der Inventarposten
     (`fertigware`) bleibt unberührt und der Inventarwert zu hoch. Ebenso
     gibt es keine Reservierung gegen Doppelverkauf im Zahlfenster.
   - **Bestehende Werkstattdateien in die Übergabemappe legen.** Heute wird
     dort hochgeladen; was am Artikel schon liegt, muss man erst
     herunterladen und wieder hinaufschieben. Gewünscht ist die Auswahl aus
     den vorhandenen Dateien — und zwar als **Verweis, nicht als Kopie**:
     Wird die Zeichnung im Haus überarbeitet, soll der Kunde die neue
     Fassung sehen. Dasselbe Prinzip wie bei der Weitergabe an den
     Zulieferer (`lib/weitergabe.ts`), nur in die andere Richtung.
   - **MCP-Scopes je Rolle.** Es gibt zwei Stufen (voll/lesend), das Büro
     kennt fünfzehn Rechte. Ein Schlüssel je Rolle wäre der nächste Schritt.
   - **Rest-Risiko DNS-Rebinding** in `bild_hochladen`: Die URL-Prüfung löst
     den Hostnamen selbst auf; der eigentliche Abruf könnte theoretisch eine
     andere Antwort bekommen. Gegen Prompt-Injection reicht die Prüfung,
     gegen einen Angreifer mit eigener DNS-Zone hilft nur Netztrennung.

8. **Belege, Wareneingänge und Kundenanhänge gehören aus der Mediathek
   heraus.** Aufgekommen aus Dominiks Frage (08/2026), ob die Dateien nicht
   auf getrennte Adressen und ein eigenes Volume gehörten. Beim Nachsehen war
   die Frage dringender als gedacht: Die Mediathek ist öffentlich lesbar — sie
   muss es sein, sie liefert die Bilder der Website aus —, und `Expenses`,
   `GoodsReceipts`, `Inquiries` und `Jobs` legen ihre Anhänge genau dort ab.
   Der Belegscan einer Lieferantenrechnung lag damit unter derselben Art
   Adresse wie ein Produktfoto.

   **Sofort geschlossen ist der Weg, nicht die Ursache** (siehe
   `collections/Media.ts`): Die Liste `/api/media` verlangt jetzt eine
   Anmeldung, und die Bildadresse gibt nur noch Dateien aus ihrem eigenen
   Ordner heraus — vorher kam man mit einem kodierten Schrägstrich
   (`werkstattdateien%2F…`) in den Unterordner mit den Laserdateien. Erratbar
   bleibt ein Beleg, solange er dort liegt.

   **Der Umbau, der noch aussteht**, in dieser Reihenfolge:

   - Eine zweite Upload-Sammlung („Ablage") mit `read: office`, `staticDir`
     **außerhalb** von `media/` — nur so kann die Bildadresse sie baulich
     nicht erreichen. Ausgeliefert über eine geprüfte Route, Vorbild ist
     `/api/office/werkstattdatei/[id]`.
   - Die vier Felder darauf umhängen und die vorhandenen Dateien einmalig
     verschieben (Migration plus `docker-entrypoint.sh`).
   - Die Werkstattdateien gleich mit: `media/werkstattdateien` ist heute nur
     deshalb ein Unterordner der Mediathek, weil es das Volume schon gab.

   **Das braucht eine Änderung am Portainer-Stack** — ein eigenes Volume und
   ein Eintrag in der nächtlichen Sicherung. Ohne beides liegen die Dateien in
   der Container-Schicht und sind beim nächsten Ausrollen weg. Deshalb nicht
   nebenbei gemacht: Es ist Dominiks Entscheidung, wann der Stack angefasst
   wird.

---

## Fallen, die in diesem Durchgang Zeit gekostet haben

**Payload weist `127.0.0.1` als fremde Herkunft ab.** `serverURL` steht auf
`http://localhost:3000`; ein Browser, der die Anwendung unter `127.0.0.1`
aufruft, bekommt bei jedem angemeldeten Aufruf 403 — die Anmeldung klappt,
aber der Abgleich bleibt leer, und das Büro sieht aus, als hätte es keine
Daten. Beim Prüfen mit Playwright also `localhost` verwenden (so macht es auch
`TEST_BASE_URL`).


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
