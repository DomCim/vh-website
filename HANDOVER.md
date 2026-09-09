# Übergabe — Stand 09.09.2026, abends

Diese Datei ist für den nächsten Durchgang. Sie sagt, was steht, was als
Nächstes drankommt und wo die Fallen liegen. Der Inhalt vom 19.08. ist
vollständig ausgeliefert und deshalb ersetzt.

---

## Wo alles steht

**`main` = `develop` = `d5b96e1`**, ausgeliefert am 09.09.2026 abends,
`https://vincent-hellmann.com/api/healthz` meldet diese Fassung.

Ausgeliefert wurden die Neuerungen **95 bis 100**:

| Nr. | Was |
|---|---|
| 95 | Belege werden beim Festschreiben eingefroren und unter `media/belege` abgelegt |
| 96 | Bilder stehen in der Sitemap |
| 97 | Artikel mit Farbauswahl lassen sich wieder übersetzen |
| 98 | Alte TYPO3-Adressen leiten auf ihre neuen Seiten |
| 99 | Kollektionsseite `/kollektion`, dazu `itemCondition` und `priceValidUntil` |
| 100 | Adressen je Sprache samt automatischer Umleitung |

Nachgemessen nach dem Ausrollen: `/de/kollektion` 200 · alte TYPO3-Pfade 301 ·
Sitemap 117 Adressen und 93 Bilder · `NewCondition` und `priceValidUntil` im
Produkt-Markup · die Hausregeln vom MCP-Server enthalten den Abschnitt
„## Adressen".

**Fünf zusammengeführte Zweige sind noch nicht gelöscht** (örtlich und am
Server): `claude/bilder-sitemap`, `claude/mcp-farboptionen`,
`claude/alte-adressen`, `claude/kollektion-und-markup`,
`claude/adressen-je-sprache`. Nach der Regel in CLAUDE.md gehören sie weg.

---

## Das Nächste: die Adressen je Sprache setzen

Die Technik steht und ist live. Was fehlt, ist die Redaktionsarbeit — und
**ein Codeschritt davor**.

### Zuerst: die Umleitungsschleife entschärfen

In `next.config.mjs` steht seit dem 09.09. eine Umleitung der alten
TYPO3-Adressen, darunter:

```js
{ source: '/fr/objets', destination: '/fr/objekte', statusCode: 301 }
```

Bekommt die Kategorie „Objets" die französische Adresse `objets`, dreht sich
das im Kreis: Die `next.config` greift zuerst und schickt auf `/fr/objekte`,
die Seite erkennt `objets` als maßgeblich und schickt zurück. **Diese eine
Zeile muss raus, bevor `objets` vergeben wird.** `/fr/lampes` und
`/fr/meubles-d-exterieur` sind unkritisch — diese Wörter wird niemand als
Adresse vergeben.

### Dann: die Werkzeuge

- **`adressen_pruefen`** (`sprache: "fr"` oder `"en"`) — die Arbeitsliste.
  Drei Töpfe: was noch die deutsche Adresse trägt, was schon eine eigene hat,
  und was **noch keine Sprachfassung** hat.
- **`adresse_setzen`** (`bereich`, `slug`, `sprache`, `adresse`) — prüft, ob
  die Adresse in dieser Sprache frei ist, legt die Eingabe zurecht (aus
  „Canapé OS" wird `canape-os`), und die Umleitung von der alten entsteht von
  selbst.
- **`adressen_lesen`** (`bereich`, `slug`) — alle drei Fassungen samt der
  Adressen, unter denen das Stück früher zu finden war.

**Zwei Regeln, beide aus einem Fehlschlag gelernt:**

1. **Erst die Kategorien, dann die Artikel.** Der Pfad besteht aus beiden.
2. **Erst übersetzen, dann die Adresse.** Ein Stück ohne Sprachfassung nimmt
   keine Adresse in dieser Sprache an — Payload verlangt in der Sprachzeile
   den Titel. Das Werkzeug sagt es in Worten; die Fehlermeldung dahinter wäre
   unverständlich („Feld nicht korrekt: Name").

### Die vorbereitete Liste

Alle Kategorien sind in beiden Sprachen übersetzt. Bei den Artikeln fehlt nur
der **Dubbe Stehtisch** (fr und en, Titel/Kurz-/Langbeschreibung).

**Kategorien:**

| heute | Französisch | Englisch |
|---|---|---|
| `objekte` | `objets` ⚠ erst die Umleitung entfernen | `objects` |
| `outdoor` | `exterieur` | bleibt |
| `moebel` | `mobilier` | `furniture` |
| `pflanzen` | `plantes` | `planters` |
| `feuer` | `feu` | `fire` |
| `maschinenbau` | `construction-mecanique` | `mechanical-engineering` |
| `next-concept` | bleibt (Marke) | bleibt |

**Artikel:**

| heute | Französisch | Englisch |
|---|---|---|
| `outdoor-sofa-os` | `canape-outdoor-os` | bleibt |
| `outdoor-sessel-os` | `fauteuil-outdoor-os` | `outdoor-armchair-os` |
| `outdoor-tisch-ot` | `table-outdoor-ot` | `outdoor-table-ot` |
| `outdoor-liege-vague` | `chaise-longue-vague` | `outdoor-lounger-vague` |
| `outdoor-pflanzen-kubus` | `bac-a-plantes-acier` | `steel-planter` |
| `feuer-brasero` | `brasero-acier-corten` | `brasero-corten-steel` |
| `feuer-flammkuchenofen` | `four-a-flammekueche` | `tarte-flambee-oven` |
| `objekt-coeur` | `coeur-illumine` | `illuminated-heart` |
| `objekt-flamingo` | `flamant-rose` | `flamingo-sculpture` |
| `objekt-stier` | `sculpture-taureau` | `bull-sculpture` |
| `objekt-logo` | `objet-logo` | `logo-object` |
| `next-concept-rennradwandhalterung` | `support-mural-velo` | `bike-wall-mount` |
| `next-concept-kantenfasmaschine` | `chanfreineuse` | `edge-chamfering-machine` |
| `dubbe-stehtisch` | erst übersetzen | erst übersetzen |

Die Adressen leiten sich aus den vorhandenen Übersetzungen ab, nicht aus einer
Erfindung. `brasero-acier-corten` ist bewusst so gewählt: **„brasero corten"
ist in Frankreich ein aufsteigender Suchbegriff** (siehe Marktanalyse).

**Danach zu prüfen:** Sitemap und hreflang nennen je Sprache die neue Adresse,
die alte leitet mit 308 dorthin, und die Sprachwahl oben rechts springt auf
die richtige Seite statt nur das Kürzel zu tauschen.

---

## Zwei Widersprüche in den Daten

Beim Vergleich der Sprachfassungen aufgefallen, **noch nicht behoben** — weil
nur der Betrieb weiß, welche Angabe stimmt:

- **Coeur:** Deutsch „Klein (40 cm) / Mittel (90 cm)", Französisch und
  Englisch „60 cm / 100 cm" — gleicher Preis, andere Größe.
- **Pflanzkübel Kubus:** Deutsch „100 × 100 cm", Französisch und Englisch
  „100 × 40 cm" für 1.249 €.

---

## Was sonst offen ist

**Redaktion (kein Code):**

- **Es gibt null Kundenstimmen.** Die ganze Maschinerie steht — Bitte-Mail
  vierzehn Tage nach dem Versand, Formular, Freigabe im Admin,
  `aggregateRating` am Artikel. Sie hatte nur nie etwas zu tun: kein einziger
  Shop-Versand bisher, und das Projektgeschäft wird gar nicht gefragt. Vier
  Referenzkunden stehen auf der Website. **Das ist der stärkste einzelne
  Hebel auf die Klickrate im Suchergebnis.**
- **Über-uns trägt Platzhaltertext** („(Platzhalter-Text: Ergänzen Sie hier
  Ihre persönliche Geschichte.)") — sichtbar auf der Seite *und* in der
  Beschreibung, die Google zeigt.
- **Die Beschreibung der deutschen Startseite beginnt mit „Origami,"** —
  in `/admin` unter Einstellungen → SEO, deutsche Fassung.
- **Das Google-Unternehmensprofil** steht als „Designagentur" statt
  Metallwerkstatt, mit der alten französischen Telefonnummer, einem Foto und
  null Rezensionen.
- **Facebook ist ein privates Profil**, keine Unternehmensseite — damit kein
  Katalog und keine Anzeigen.
- Acht Artikel ohne Fertigungszeit, zwei ohne Kurzbeschreibung.
- Alternativtexte gibt es auf Deutsch (alle 37); Französisch und Englisch
  fallen darauf zurück und könnten nachgetragen werden.
- Der Entwurf „Testbeitrag – bitte nicht veröffentlichen" liegt in den News.

**Code, vorbereitet aber nicht gebaut:**

- **Bitte um Kundenstimme auch für Aufträge**, nicht nur für Shop-Bestellungen
  — dazu eine Büro-Seite `/office/kundenstimmen` mit Freigabe an derselben
  Stelle (heute nur im Admin) und einer Einladung mit eigenem Schlüssel für
  Projektkunden. Entworfen, nicht gebaut.
- **Adressen für Beiträge und Referenzen.** Das Feld gibt es bewusst nur an
  Artikeln und Kategorien — dort ist die Auflösung verdrahtet.
- **Teil 2 der Adressen: die festen Seiten** (`/fr/projets` statt
  `/fr/projekte`). Braucht eine Übersetzungstabelle und eine Schicht, die
  intern auf die deutsche Route abbildet, plus alle internen Links aus
  derselben Tabelle.
- **Pinterest-Katalog**: braucht Bilder ab 1000 × 1500 px — die
  Größenstaffelung hat kein Hochformat. Zusätzliche Bildgröße plus zweiter
  Feed neben dem Google-Feed.
- **Eintragehilfe für das Google-Unternehmensprofil** — Entwurf liegt im
  Wissensstamm unter `Systeme/Google-Unternehmensprofil-Produkte-vs-Merchant-Center.md`.
- **Die README beschreibt den Netz-Eingang falsch**: Sie kennt einen Proxy
  Host mit allen sechs Domainnamen und einem handgeschriebenen
  Umleitungsblock. In Wirklichkeit gibt es einen Proxy Host für den Apex und
  einen Redirection Host für die fünf anderen — sauberer, aber eben anders.

---

## Der Prüflauf

`pnpm typecheck && pnpm lint && pnpm exec playwright test` — alle drei liefen
vor der Auslieferung, dazu beide Wanderungen gegen eine leere Datenbank und
ein Produktionsbau.

**648 bestanden, 5 rot.** Die fünf sind **nicht** von dieser Arbeit und waren
vorher schon rot:

| Prüfung | Warum |
|---|---|
| `fusszeile-kredit` | fällt genauso gegen den laufenden develop-Container — vorher schon kaputt |
| `neuerungen` | Eintrag 91 enthält `` `*kursiv*` `` in Backticks; die Prüfung rechnet nicht mit Sternchen in Code-Abschnitten |
| `mcp-werkzeuge` | `material_loeschen` fehlt in der Werkzeugliste |
| `smoke` (MCP) | ohne hinterlegten MCP-Schlüssel 503 statt 401 |
| `warteschlange` | Warteschlange des Büros ohne Netz |

**Der Prüflauf hat drei echte Regressionen gefunden**, alle behoben: öffentlich
erreichbare interne Artikel, ein kaputter Papierkorb (ein abgefangener
Datenbankfehler mitten in der Transaktion — das Wegwerfen fiel zurück) und ein
404 auf `/de/kollektion/<artikel>`, dem Rückfallpfad des Merchant-Feeds.

---

## Wo die Begründungen stehen

- **Wissensstamm** (`wissen_suchen`): `Fallen/Belege-beim-Abruf-neu-erzeugen`,
  `Fallen/Mehrere-SQL-Befehle-mit-Platzhaltern-in-einer-Wanderung`,
  `Fallen/Neue-Sprachfassung-scheitert-an-Pflichtfeldern-in-Unterlisten`,
  `Systeme/Google-Unternehmensprofil-Produkte-vs-Merchant-Center`.
- **Im Code**: `src/lib/adressen.ts` erklärt ausführlich, warum die Adresse
  **neben** dem Slug steht und nicht in ihm — der naheliegende Weg hätte die
  vorhandenen Adressen vernichtet.
- **Marktanalyse** vom 09.09.2026 als eigenständige HTML-Datei — Wettbewerb
  mit Preisvergleich, Nachfrage, Kanäle, Außenwahrnehmung. Liegt bei Dominik.
