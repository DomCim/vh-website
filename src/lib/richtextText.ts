/**
 * Richtext als lesbarer Text — und wieder zurück.
 *
 * **Warum das nötig wurde.** Im Datenmodell liegen Beschreibungen und
 * Rechtstexte als Baum aus Knoten: Absätze, Überschriften, Listen. Ein
 * Textfeld im Büro kann damit nichts anfangen, und über die KI-Schnittstelle
 * müsste man den Baum von Hand bauen. Beide Wege konnten deshalb bisher nur
 * Absätze — wer im Büro einen Rechtstext anfasste, verlor jede Gliederung, und
 * eine per Assistent übersetzte Artikelbeschreibung wurde zur Textwüste, wo
 * die deutsche Zwischenüberschriften hatte.
 *
 * **Die Auszeichnung ist absichtlich winzig.** Vier Zeichenfolgen, mehr nicht:
 *
 *     ## Überschrift          → große Zwischenüberschrift
 *     ### Kleinere            → kleine Zwischenüberschrift
 *     - Punkt                 → Aufzählung (aufeinanderfolgende Zeilen)
 *     **fett**                → fett im Fließtext
 *
 * Alles andere ist Absatz. Kein Kursiv, keine Verweise, keine Tabellen — was
 * hier nicht steht, gehört in die Website-Verwaltung. Der Maßstab ist nicht,
 * was möglich wäre, sondern was jemand am Telefon in ein Textfeld tippt, ohne
 * ein Handbuch zu brauchen.
 *
 * **Der Weg muss in beide Richtungen dasselbe ergeben.** Text → Baum → Text
 * ist verlustfrei, und eine Prüfung hält das fest. Daran hängt mehr als
 * Bequemlichkeit: In der Widerrufsbelehrung steht der Satz, dass bei einem
 * nach Vorgabe gefertigten Einzelstück kein Widerrufsrecht besteht. Ginge der
 * beim Speichern verloren, wäre das kein Schönheitsfehler.
 */

const FETT = 1

/** Ein Knoten im Baum — `type` und `version` hat jeder, alles Weitere je nach Art */
type Knoten = { type: string; version: number; [k: string]: unknown }

const textKnoten = (text: string, fett = false): Knoten => ({
  mode: 'normal',
  text,
  type: 'text',
  style: '',
  detail: 0,
  format: fett ? FETT : 0,
  version: 1,
})

/** `**fett**` in Textknoten auflösen — alles Übrige bleibt gewöhnlicher Text */
function zeileZuKnoten(zeile: string): Knoten[] {
  const raus: Knoten[] = []
  // Bewusst gierig-frei und ohne Zeilenumbruch: **a** und **b** bleiben zwei
  for (const stueck of zeile.split(/(\*\*[^*\n]+\*\*)/g)) {
    if (!stueck) continue
    const fett = stueck.startsWith('**') && stueck.endsWith('**') && stueck.length > 4
    raus.push(textKnoten(fett ? stueck.slice(2, -2) : stueck, fett))
  }
  return raus.length ? raus : [textKnoten('')]
}

const block = (
  type: string,
  kinder: Knoten[],
  mehr: Record<string, unknown> = {},
): Knoten => ({
  type,
  format: '',
  indent: 0,
  version: 1,
  direction: 'ltr',
  ...mehr,
  children: kinder,
})

/**
 * Die Form, die Payload für ein Richtext-Feld erwartet.
 *
 * Ohne diese Angabe passt der Rückgabewert nicht auf das Feld, und TypeScript
 * greift bei `payload.update` zur falschen Überladung — der Fehler taucht dann
 * an einer ganz anderen Stelle auf („Property 'id' does not exist"). Aufgefallen
 * genau so, in lib/mcp/referenzen.ts.
 */
type Richtext = {
  root: {
    type: string
    children: { type: unknown; version: number; [k: string]: unknown }[]
    direction: ('ltr' | 'rtl') | null
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | ''
    indent: number
    version: number
  }
  [k: string]: unknown
}

/** Lesbarer Text → Payload-Richtext */
export function textZuRichText(text: string): Richtext {
  const kinder: Knoten[] = []
  let punkte: string[] = []

  const listeAbschliessen = () => {
    if (!punkte.length) return
    kinder.push(
      block(
        'list',
        punkte.map((p, i) =>
          block('listitem', zeileZuKnoten(p), { value: i + 1 }),
        ),
        { tag: 'ul', listType: 'bullet', start: 1 },
      ),
    )
    punkte = []
  }

  for (const roh of text.replace(/\r\n?/g, '\n').split('\n')) {
    const zeile = roh.trim()

    if (zeile.startsWith('- ')) {
      punkte.push(zeile.slice(2).trim())
      continue
    }
    /*
     * Eine Leerzeile beendet die Aufzählung **nicht**.
     *
     * Wer zwischen zwei Punkten eine Leerzeile lässt, meint trotzdem eine
     * Liste. Vorher entstanden daraus drei Listen mit je einem Punkt — auf dem
     * Bildschirm kaum zu unterscheiden, für einen Vorleser und für Google aber
     * etwas anderes. Beendet wird die Liste erst durch eine Zeile, die etwas
     * anderes sagt.
     */
    if (!zeile) continue
    listeAbschliessen()
    if (zeile.startsWith('### ')) {
      kinder.push(block('heading', zeileZuKnoten(zeile.slice(4).trim()), { tag: 'h3' }))
      continue
    }
    if (zeile.startsWith('## ')) {
      kinder.push(block('heading', zeileZuKnoten(zeile.slice(3).trim()), { tag: 'h2' }))
      continue
    }
    kinder.push(block('paragraph', zeileZuKnoten(zeile), { textFormat: 0 }))
  }
  listeAbschliessen()

  return {
    root: {
      type: 'root',
      format: '' as const,
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: kinder.length ? kinder : [block('paragraph', [textKnoten('')], { textFormat: 0 })],
    },
  }
}

/** Payload-Richtext → lesbarer Text mit derselben Auszeichnung */
export function richTextZuText(wert: unknown): string {
  const inhalt = (knoten: unknown): string => {
    if (!knoten || typeof knoten !== 'object') return ''
    const n = knoten as { type?: string; text?: string; format?: number; children?: unknown[] }
    if (n.type === 'text') {
      const t = n.text ?? ''
      // Fett nur um sichtbaren Text — sonst entstünde „** **"
      return typeof n.format === 'number' && n.format & FETT && t.trim() ? `**${t}**` : t
    }
    if (n.type === 'linebreak') return '\n'
    return (n.children ?? []).map(inhalt).join('')
  }

  const bloecke: string[] = []
  const geh = (knoten: unknown) => {
    if (!knoten || typeof knoten !== 'object') return
    const n = knoten as { type?: string; tag?: string; children?: unknown[] }
    switch (n.type) {
      case 'heading':
        bloecke.push(`${n.tag === 'h3' ? '###' : '##'} ${inhalt(n)}`)
        return
      case 'list':
        bloecke.push((n.children ?? []).map((p) => `- ${inhalt(p)}`).join('\n'))
        return
      case 'paragraph': {
        const t = inhalt(n)
        if (t.trim()) bloecke.push(t)
        return
      }
      default:
        (n.children ?? []).forEach(geh)
    }
  }

  const wurzel = (wert as { root?: unknown } | null)?.root
  if (!wurzel) return ''
  geh(wurzel)
  return bloecke.join('\n\n').trim()
}

/**
 * Lässt sich der Baum mit dieser Auszeichnung überhaupt abbilden?
 *
 * Die Notbremse für alles, was hier nicht vorkommt: Verweise, Bilder,
 * Tabellen, Zitate. So etwas entsteht nur in der Website-Verwaltung, und ein
 * Textfeld würde es beim Speichern lautlos wegwerfen. Dann zeigt das Büro den
 * Text lieber an, statt ihn zur Bearbeitung anzubieten.
 */
export function darstellbar(wert: unknown): boolean {
  const erlaubt = new Set([
    'root',
    'paragraph',
    'heading',
    'list',
    'listitem',
    'text',
    'linebreak',
  ])
  const pruefe = (knoten: unknown): boolean => {
    if (!knoten || typeof knoten !== 'object') return true
    const n = knoten as { type?: string; children?: unknown[] }
    if (n.type && !erlaubt.has(n.type)) return false
    return (n.children ?? []).every(pruefe)
  }
  const wurzel = (wert as { root?: unknown } | null)?.root
  // Ein leeres Feld ist unbedenklich — dort ist nichts zu verlieren
  return wurzel ? pruefe(wurzel) : true
}
