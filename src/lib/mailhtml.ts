import { FilterXSS } from 'xss'

/**
 * Was aus dem Schreibfeld in eine Mail darf.
 *
 * Der Text kommt aus dem Büro, also von jemandem, der angemeldet ist — das ist
 * kein Grund, ihn ungeprüft weiterzureichen. Er geht in eine Mail, und eine
 * Mail landet in fremden Programmen, die HTML unterschiedlich streng auslegen.
 * Ein `<script>` aus einem kopierten Textblock wäre schon dann ein Problem,
 * wenn nur ein einziges davon etwas anfängt.
 *
 * Erlaubt ist deshalb nur, was Quill selbst erzeugt, und davon nur die Hälfte,
 * die in Mails überhaupt ankommt.
 *
 * **Warum Stile und keine Klassen.** Quill schreibt Ausrichtung und Einzug von
 * Haus aus als `class="ql-align-center"` — das setzt ein Stylesheet voraus,
 * das der Mail nicht beiliegt und das kein Mailprogramm nachlädt. Das
 * Schreibfeld ist deshalb auf Inline-Stile umgestellt, und hier stehen genau
 * die Eigenschaften, die dabei entstehen dürfen.
 */

/** Die Eigenschaften, die ein Absatz oder ein Stück Text tragen darf */
const ERLAUBTE_STILE = new Set([
  'color',
  'background-color',
  'text-align',
  'padding-left',
  'font-weight',
  'font-style',
  'text-decoration',
])

/**
 * Nur Farben und Maße — keine Funktionen.
 *
 * `url(...)` in einem Stil lädt von außen nach; `expression(...)` war einmal
 * ausführbarer Code. Beides hat in einer Mail nichts zu suchen, und beides
 * käme durch, wenn man nur die Eigenschaft prüft und nicht ihren Wert.
 */
const HARMLOSER_WERT = /^[#a-z0-9\s.,()%-]+$/i

function stilePruefen(stil: string): string {
  return stil
    .split(';')
    .map((teil) => teil.trim())
    .filter(Boolean)
    .filter((teil) => {
      const [name, ...rest] = teil.split(':')
      const wert = rest.join(':').trim()
      if (!ERLAUBTE_STILE.has(name.trim().toLowerCase())) return false
      if (!HARMLOSER_WERT.test(wert)) return false
      return !/url\s*\(|expression|javascript:/i.test(wert)
    })
    .join('; ')
}

const filter = new FilterXSS({
  whiteList: {
    p: ['style'],
    br: [],
    div: ['style'],
    span: ['style'],
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    sub: [],
    sup: [],
    h1: ['style'],
    h2: ['style'],
    h3: ['style'],
    blockquote: ['style'],
    ol: ['style'],
    ul: ['style'],
    li: ['style'],
    a: ['href', 'title', 'style'],
    code: [],
    pre: [],
    hr: [],
  },
  // Was nicht auf der Liste steht, fliegt samt Inhalt raus — bei <script>
  // wäre es sonst der Inhalt, der übrig bleibt
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
  css: false,
  onTagAttr: (tag, name, wert) => {
    if (name === 'style') {
      const sauber = stilePruefen(wert)
      return sauber ? `style="${sauber}"` : ''
    }
    if (tag === 'a' && name === 'href') {
      /*
       * Nur Ziele, die etwas öffnen — kein `javascript:` und kein `data:`.
       * Ein `data:`-Link kann eine ganze Seite enthalten, die dann aussieht,
       * als käme sie von uns.
       */
      const ziel = wert.trim()
      if (!/^(https?:|mailto:|tel:)/i.test(ziel)) return ''
      return `href="${ziel.replace(/"/g, '&quot;')}"`
    }
    return undefined
  },
})

/**
 * Fremdes HTML auf das reduzieren, was in eine Mail darf.
 *
 * Zum Schluss werden **geschützte Leerzeichen wieder zu gewöhnlichen**. Quill
 * schreibt jedes einzelne Leerzeichen als `&nbsp;` — im Editor richtig, in
 * einer Mail fatal: An einem geschützten Leerzeichen bricht keine Zeile um.
 * Ein Absatz aus vierzig Wörtern wird damit zu einer einzigen Zeile, die am
 * Telefon seitwärts aus dem Bild läuft. Man sieht es beim Schreiben nicht und
 * erst beim Empfänger.
 */
export function mailHtmlSaeubern(html: string): string {
  return filter.process(String(html ?? '')).replace(/&nbsp;/g, ' ')
}

/**
 * Die Nur-Text-Fassung derselben Nachricht.
 *
 * Sie reist immer mit: Manche lesen so, manche Programme zeigen gar nichts
 * anderes, und Spamfilter bewerten eine Mail ohne Textteil schlechter. Was
 * hier entsteht, muss kein schönes Layout sein — es muss lesbar sein und
 * dieselbe Aussage tragen.
 */
export function htmlAlsText(html: string): string {
  return String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    // Ein Link soll seine Adresse nennen: „hier klicken" ist in einer
    // Textfassung wertlos, wenn nicht dabeisteht, wohin
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, ziel, text) => {
      const beschriftung = String(text).replace(/<[^>]+>/g, '').trim()
      return beschriftung && beschriftung !== ziel ? `${beschriftung} (${ziel})` : ziel
    })
    .replace(/<li[^>]*>/gi, '\n· ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|blockquote|li|ul|ol|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Höchstens eine Leerzeile am Stück — Quill hinterlässt gern drei
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Steht in dem HTML überhaupt etwas? Leere Absätze zählen nicht. */
export function htmlHatInhalt(html: string): boolean {
  return htmlAlsText(html).length > 0
}
