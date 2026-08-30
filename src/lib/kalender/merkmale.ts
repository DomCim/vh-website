import type { Locale } from '../i18n'
import { defaultLocale, isLocale } from '../i18n'

/**
 * Was in der Notiz eines Termins steht — gelesen als Merkmale.
 *
 * Der Gedanke dahinter: Vincent trägt einen Termin am iPhone ein, und derselbe
 * Termin soll auf der Website stehen können, ohne dass er sich dafür an einen
 * Rechner setzt. Ein zusätzliches Feld ginge nicht — die Kalender-App kennt
 * nur Titel, Ort, Zeit und Notiz. Die Notiz reicht CalDAV aber unverändert
 * durch, und damit ist sie der Weg.
 *
 *     #öffentlich
 *     #beschreibung: Hier stelle ich meine *Werke* aus —
 *     das **Herz** ist zum ersten Mal zu sehen.
 *     #ort: Parc des Expositions, Nancy
 *     #link: https://…
 *
 * **Warum bis zur nächsten Raute und nicht in Anführungszeichen.** Ein Muster
 * mit `"…"` sieht am Rechner sauber aus und bricht am Telefon: iOS macht aus
 * dem Anführungszeichen je nach Tastatur `„ " " "` oder `'`, und die Notiz
 * geht durch iCalendar noch einmal durch die Entschärfung. Ein Termin stünde
 * dann ohne Beschreibung auf der Website, und niemand sähe warum. Alles bis
 * zur nächsten Zeile, die mit `#` beginnt, überlebt dagegen jede Tastatur —
 * und erlaubt nebenbei mehrzeilige Texte.
 *
 * **Warum großzügig gelesen wird.** Das hier tippt ein Mensch auf einem
 * Telefon, oft unterwegs. Groß- und Kleinschreibung ist egal, Umlaute dürfen
 * umschrieben werden (`#oeffentlich`), der Doppelpunkt darf fehlen, und
 * Leerzeichen ringsum stören nicht. Jede Strenge, die hier eingebaut wird,
 * fällt später als „warum steht der Termin nicht auf der Website?" zurück.
 *
 * **Sprachen hängen am Flag.** `#beschreibung:fr:` ist die französische
 * Fassung; ohne Kürzel gilt Deutsch. Fehlt eine Übersetzung, steht überall
 * der deutsche Text — eine Lücke auf der französischen Seite wäre schlimmer
 * als ein deutscher Satz.
 */

/** Ein Text, der je Sprache vorliegen kann. */
export type Mehrsprachig = Partial<Record<Locale, string>>

export type Merkmale = {
  /** Ob der Termin nach außen gehört. Ohne das passiert nichts. */
  oeffentlich: boolean
  /** Der Termin fällt aus — er bleibt sichtbar, aber als abgesagt. */
  abgesagt: boolean
  titel: Mehrsprachig
  beschreibung: Mehrsprachig
  ort: Mehrsprachig
  link?: string
  /** Der Dateiname eines Bildes aus der Mediathek. */
  bild?: string
  /** Was von der Notiz übrig bleibt — das, was nur intern gilt. */
  rest: string
}

/**
 * Die Schreibweisen, unter denen ein Flag erkannt wird.
 *
 * Je Merkmal mehrere, und zwar mit Absicht: Wer am Telefon keine Umlaute
 * tippen mag, schreibt `#oeffentlich`; wer auf Französisch denkt, vielleicht
 * `#public`. Alles davon meint dasselbe, und keins davon soll scheitern.
 */
const FLAGGEN: Record<string, string[]> = {
  oeffentlich: ['öffentlich', 'oeffentlich', 'offentlich', 'public', 'website'],
  abgesagt: ['absage', 'abgesagt', 'entfällt', 'entfaellt', 'annulé', 'annule', 'cancelled'],
  titel: ['titel', 'title', 'titre'],
  beschreibung: ['beschreibung', 'text', 'description'],
  ort: ['ort', 'adresse', 'lieu', 'location'],
  link: ['link', 'url', 'lien'],
  bild: ['bild', 'foto', 'image', 'photo'],
}

/**
 * Merkmale, die genau eine Zeile lang sind.
 *
 * Ein Titel, eine Adresse, ein Verweis und ein Dateiname gehen nie über
 * mehrere Zeilen — **die Beschreibung als einzige schon.** Ohne diese
 * Unterscheidung verschluckt das letzte Flag alles, was danach noch kommt:
 * Steht unter `#ort Nancy` noch „Aufbau ab 6 Uhr", landet die interne Notiz
 * in der Adresse und verschwindet zugleich aus dem Rest.
 *
 * Genau so beim Prüfen aufgefallen, zweimal — erst bei `#link`, dann bei
 * `#ort`. Die Regel dahinter ist einfach: Mehrzeilig ist nur, was mehrzeilig
 * sein muss.
 */
const EINZEILIG = new Set(['link', 'bild', 'ort', 'titel'])

/** Zu welchem Merkmal gehört dieses Wort? */
function merkmalZu(wort: string): string | null {
  const rein = wort
    .trim()
    .toLowerCase()
    // Ein nachgestellter Doppelpunkt gehört zur Schreibweise, nicht zum Wort
    .replace(/:$/, '')
  for (const [name, schreibweisen] of Object.entries(FLAGGEN)) {
    if (schreibweisen.includes(rein)) return name
  }
  return null
}

/**
 * Die Notiz eines Termins auseinandernehmen.
 *
 * Zeilenweise, weil ein Flag immer eine Zeile beginnt. Was zwischen zwei
 * Flags steht, gehört zum ersten — so entsteht der mehrzeilige Text, ohne
 * dass jemand Anführungszeichen setzen muss.
 */
export function merkmaleLesen(notiz: string | null | undefined): Merkmale {
  const ergebnis: Merkmale = {
    oeffentlich: false,
    abgesagt: false,
    titel: {},
    beschreibung: {},
    ort: {},
    rest: '',
  }
  if (!notiz) return ergebnis

  const restZeilen: string[] = []
  /** Das Merkmal, dessen Text gerade weiterläuft. */
  let offen: { name: string; sprache: Locale } | null = null
  let gesammelt: string[] = []

  /** Den gesammelten Text ablegen. */
  const abschliessen = () => {
    if (!offen) return
    const text = gesammelt.join('\n').trim()
    if (text) {
      if (offen.name === 'link') ergebnis.link = text
      else if (offen.name === 'bild') ergebnis.bild = text
      else if (offen.name === 'titel') ergebnis.titel[offen.sprache] = text
      else if (offen.name === 'beschreibung') ergebnis.beschreibung[offen.sprache] = text
      else if (offen.name === 'ort') ergebnis.ort[offen.sprache] = text
    }
    offen = null
    gesammelt = []
  }

  for (const zeile of notiz.split(/\r?\n/)) {
    const angefangen = /^\s*#(.+)$/.exec(zeile)

    if (!angefangen) {
      // Keine neue Raute — gehört zum laufenden Text oder zum Rest
      if (offen) gesammelt.push(zeile)
      else restZeilen.push(zeile)
      continue
    }

    abschliessen()

    /*
     * Ein Flag hat bis zu drei Teile: Name, Sprache, Text. Getrennt wird am
     * Doppelpunkt — aber nur an den ersten beiden, denn im Text stehen
     * regelmäßig weitere („#link: https://…").
     *
     * **Der Doppelpunkt darf fehlen.** Genau das versprach die Hilfe in der
     * Terminmaske, und genau daran hielt sich der Code zuerst nicht: Bei
     * `#beschreibung Text ohne Doppelpunkt` war der erste Teil die ganze
     * Zeile, und die erkennt niemand als Flagge. Die Folge war die
     * unangenehmste Sorte Fehler — der Termin stand auf der Website (denn
     * `#oeffentlich` allein hat keinen Doppelpunkt und griff), aber ohne
     * Titel, ohne Beschreibung, ohne Ort. Alles Übrige lag still im internen
     * Rest. So gemeldet aus dem Betrieb.
     *
     * Deshalb wird zuerst am Doppelpunkt getrennt und, wenn das kein
     * bekanntes Flag ergibt, am ersten Leerzeichen. Ein Wort ohne beides
     * (`#absage`) bleibt, wie es ist.
     */
    const inhalt = angefangen[1]
    let teile = inhalt.split(':')
    let name = merkmalZu(teile[0])

    if (!name) {
      const leer = inhalt.search(/\s/)
      if (leer > 0) {
        const wort = inhalt.slice(0, leer)
        const rest = inhalt.slice(leer + 1)
        if (merkmalZu(wort)) {
          name = merkmalZu(wort)
          /*
           * Von hier an sieht alles Weitere so aus, als wäre der Doppelpunkt
           * dagewesen. Der Rest bleibt als **ein** Stück stehen, damit
           * `#link https://…` nicht an seinen eigenen Doppelpunkten zerfällt.
           */
          teile = [wort, rest]
        }
      }
    }

    if (!name) {
      // Kein Flag, das wir kennen — eine Raute darf auch einfach Text sein
      restZeilen.push(zeile)
      continue
    }

    if (name === 'oeffentlich') {
      ergebnis.oeffentlich = true
      continue
    }
    if (name === 'abgesagt') {
      ergebnis.abgesagt = true
      continue
    }

    /*
     * Steht an zweiter Stelle ein Sprachkürzel, gilt es; sonst ist der zweite
     * Teil schon der Text. `#beschreibung:fr: …` gegen `#beschreibung: …`.
     */
    const zweiter = (teile[1] ?? '').trim().toLowerCase()
    const hatSprache = isLocale(zweiter)
    const sprache: Locale = hatSprache ? (zweiter as Locale) : defaultLocale
    const text = teile.slice(hatSprache ? 2 : 1).join(':')

    offen = { name, sprache }
    gesammelt = text.trim() ? [text.trim()] : []

    // Einzeiliges endet mit seiner Zeile — alles Weitere gehört nicht dazu
    if (EINZEILIG.has(name)) abschliessen()
  }

  abschliessen()
  ergebnis.rest = restZeilen.join('\n').trim()
  return ergebnis
}

/**
 * Den Text in der gewünschten Sprache — mit Rückfall auf Deutsch.
 *
 * Nie eine Lücke: Eine französische Seite mit einem deutschen Satz ist
 * unschön, eine französische Seite mit einem leeren Feld ist kaputt.
 */
export function inSprache(wert: Mehrsprachig, sprache: Locale): string | undefined {
  return wert[sprache] ?? wert[defaultLocale] ?? Object.values(wert)[0]
}

/**
 * Die schlichte Auszeichnung aus den Notizen in sicheres HTML.
 *
 * Genau zwei Zeichen, dieselben wie im Änderungsprotokoll: `**fett**` und
 * `*kursiv*`. Keine Links, keine Bilder, keine Tabellen — was hier
 * durchgelassen wird, kommt aus einem Textfeld, das über CalDAV von einem
 * Telefon kam, und das ist kein Ort für beliebiges HTML.
 *
 * Deshalb wird **zuerst** alles entschärft und **danach** ausgezeichnet: Ein
 * `<script>` in der Notiz ist dann schon Text, bevor die Sternchen an die
 * Reihe kommen.
 */
export function alsHtml(text: string): string {
  const sicher = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

  return (
    sicher
      // Fett zuerst — sonst frisst die kursive Regel die doppelten Sternchen
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br />')
  )
}
