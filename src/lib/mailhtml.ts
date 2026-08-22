import { FilterXSS } from 'xss'

import { cortenStrich } from './corten'

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
  // Kleingedrucktes aus dem Schreibfeld — als Vielfaches, siehe `Schreibfeld.tsx`
  'font-size',
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
    // Das Kennzeichen der Spielart überlebt die Säuberung; den Stil dazu setzt
    // `stricheSetzen`, nicht der Schreibende
    hr: ['data-strich'],
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
 * Die Abstände, die ein Absatz in der Mail bekommt.
 *
 * **Warum das überhaupt sein muss.** Quill setzt seine Absätze im Schreibfeld
 * auf `margin: 0` — vier Zeilen untereinander stehen dort untereinander.
 * Beim Empfänger gilt das Stylesheet des Mailprogramms, und dessen
 * Voreinstellung für `<p>` ist rund eine Leerzeile oben und unten. Aus vier
 * Zeilen wird damit eine Seite mit Lücken, und niemand versteht, warum — im
 * Schreibfeld sah es ja richtig aus.
 *
 * Deshalb steht der Abstand an jedem einzelnen Absatz. Ein `<style>`-Block im
 * Kopf wäre die schönere Lösung und wird von einem guten Teil der
 * Mailprogramme weggeworfen; was zählt, ist, was ankommt.
 *
 * Gesetzt wird **vorn** im Stilattribut: Was der Schreibende gewählt hat —
 * Ausrichtung, Farbe — steht dahinter und behält damit das letzte Wort.
 */
const ABSTAENDE: Record<string, string> = {
  // Wie im Schreibfeld: kein Abstand. Eine Leerzeile entsteht durch eine
  // leere Zeile, nicht durch den Absatz selbst — was man tippt, kommt an.
  p: 'margin:0;',
  h1: 'margin:16px 0 4px;',
  h2: 'margin:14px 0 4px;',
  h3: 'margin:12px 0 4px;',
  // Die Einrückung der Liste gehört uns, sonst rückt jedes Programm anders ein
  ul: 'margin:4px 0;padding-left:22px;',
  ol: 'margin:4px 0;padding-left:22px;',
  blockquote: 'margin:8px 0;padding-left:12px;border-left:3px solid #ddd;',
}

/**
 * Der Corten-Strich, wie er beim Empfänger steht.
 *
 * Vier Spielarten, gesetzt vom Schreibfeld als `data-strich` (siehe
 * `Schreibfeld.tsx`). Hier bekommen sie ihre Maße — und zwar **als
 * Inline-Stil**, denn eine Mail bringt kein Stylesheet mit. Die zweite
 * Fassung derselben Maße steht in `office.css` für das Schreibfeld; wer hier
 * etwas ändert, ändert sie dort mit, sonst sieht der Schreibende etwas
 * anderes als der Empfänger.
 *
 * Was der Text mitbringt, wird dabei **überschrieben**: Ein `<hr>` aus einer
 * fremden Mail, die jemand zitiert hat, sieht danach aus wie unserer statt wie
 * ein grauer Balken quer über das Blatt.
 */
const STRICH_STILE: Record<string, string> = {
  fein: 'border:0;height:1px;width:60px;border-radius:9999px;background-color:#a5622d;margin:16px 0 10px;',
  mittel:
    'border:0;height:2px;width:84px;border-radius:9999px;background-color:#a5622d;margin:16px 0 10px;',
  kraeftig:
    'border:0;height:3px;width:140px;border-radius:9999px;background-color:#a5622d;margin:18px 0 10px;',
  // Quer über die Breite: kein Ausrufezeichen, sondern eine Kante — deshalb
  // hauchdünn und im hellen Corten-Ton statt in vollem Bronze
  quer: 'border:0;height:1px;width:100%;background-color:#e3d5ca;margin:18px 0 12px;',
}

/**
 * Jede Überschrift bekommt ihren Corten-Strich — von selbst.
 *
 * Die Website trägt ihn unter jeder Überschrift, das Angebot und die Rechnung
 * tragen ihn, und die Mails des Shops tragen ihn (`ueberschrift()` in
 * `mail.ts`). Nur wer im Büro eine Mail schrieb, hätte ihn von Hand setzen
 * müssen — unter jede Überschrift, in der richtigen Länge, jedes Mal.
 *
 * Das ist keine Arbeit, die ein Mensch machen sollte: Die Länge folgt der
 * Größe der Überschrift, und diese Regel steht ohnehin schon im Haus. Der
 * Strich von Hand bleibt trotzdem — für die Trennung vor der Signatur oder
 * zwischen zwei Abschnitten, wo es keine Überschrift gibt.
 */
function ueberschriftenStriche(html: string): string {
  return html.replace(
    /<\/(h1|h2|h3)>/gi,
    (_ganz, name: string) => `</${name}>${cortenStrich(name.toLowerCase() === 'h1')}`,
  )
}

function stricheSetzen(html: string): string {
  return html.replace(/<hr([^>]*)>/gi, (_ganz, rest: string) => {
    const art = /data-strich\s*=\s*"([^"]*)"/i.exec(rest ?? '')?.[1] ?? 'mittel'
    const stil = STRICH_STILE[art] ?? STRICH_STILE.mittel
    return `<hr style="${stil}" />`
  })
}

/**
 * Eine leere Zeile bleibt eine leere Zeile.
 *
 * Quill schreibt sie als `<p></p>` — ein Absatz ohne Inhalt. Solange die
 * Mailprogramme jedem Absatz ihren eigenen Abstand gaben, fiel das nicht auf.
 * Mit `margin:0` fällt ein leerer Absatz auf null Höhe zusammen, und die
 * Leerzeile zwischen letzter Zeile und Grußformel wäre weg — man tippt sie,
 * und beim Empfänger fehlt sie.
 *
 * Ein `<br>` darin gibt ihm wieder eine Zeilenhöhe. Das ist dieselbe Fassung,
 * die Quill im Editor selbst benutzt.
 */
function leereAbsaetzeFuellen(html: string): string {
  return html.replace(/<p([^>]*)>\s*<\/p>/gi, '<p$1><br></p>')
}

function abstaendeSetzen(html: string): string {
  return html.replace(
    /<(p|h1|h2|h3|ul|ol|blockquote)(\s[^>]*)?>/gi,
    (ganz, name: string, rest: string | undefined) => {
      const abstand = ABSTAENDE[name.toLowerCase()]
      if (!abstand) return ganz
      const anhang = rest ?? ''
      const vorhanden = /\sstyle\s*=\s*"([^"]*)"/i.exec(anhang)
      if (!vorhanden) return `<${name}${anhang} style="${abstand}">`
      return `<${name}${anhang.replace(vorhanden[0], ` style="${abstand}${vorhanden[1]}"`)}>`
    },
  )
}

/**
 * Fremdes HTML auf das reduzieren, was in eine Mail darf — und so setzen, wie
 * es beim Empfänger stehen soll.
 *
 * Zum Schluss werden **geschützte Leerzeichen wieder zu gewöhnlichen**. Quill
 * schreibt jedes einzelne Leerzeichen als `&nbsp;` — im Editor richtig, in
 * einer Mail fatal: An einem geschützten Leerzeichen bricht keine Zeile um.
 * Ein Absatz aus vierzig Wörtern wird damit zu einer einzigen Zeile, die am
 * Telefon seitwärts aus dem Bild läuft. Man sieht es beim Schreiben nicht und
 * erst beim Empfänger.
 *
 * Die Abstände stehen hier und nicht bei den Aufrufern, damit kein Weg nach
 * draußen sie vergessen kann: Postfach, Versandfenster und Newsletter gehen
 * alle durch diese eine Tür.
 */
export function mailHtmlSaeubern(html: string): string {
  const sauber = filter.process(String(html ?? '')).replace(/&nbsp;/g, ' ')
  return ueberschriftenStriche(stricheSetzen(abstaendeSetzen(leereAbsaetzeFuellen(sauber))))
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
