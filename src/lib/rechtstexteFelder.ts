/**
 * Die Rechtstexte, wie das Büro sie sieht — als schlichter Text.
 *
 * **Warum Text und nicht Formatierung.** Im Datenmodell liegen diese Seiten
 * als Payload-Richtext, also als Baum aus Knoten. Nachgesehen, was wirklich
 * darin steht: ausschließlich Absätze. Alle sechs Texte in allen drei
 * Sprachen bestehen aus `root`, `paragraph` und `text` — nichts sonst. Ein
 * Rechtstext ist Fließtext; Fettungen und Aufzählungen macht dort niemand.
 *
 * Damit ist der Weg über schlichten Text verlustfrei, und er hat einen
 * handfesten Vorteil: Ein Textfeld kann jeder bedienen. Ein Richtext-Editor
 * im Büro wäre ein zweiter Editor neben dem im Admin-Panel, mit eigener
 * Umrechnung in beide Richtungen — und jede Umrechnung ist eine Stelle, an der
 * ein Absatz verschwinden kann, den ein Anwalt hineingeschrieben hat.
 *
 * **Die Sicherung dagegen** ist `nurAbsaetze`: Steht in einem Feld doch
 * einmal etwas anderes — weil jemand im Admin-Panel eine Liste angelegt hat —,
 * zeigt das Büro den Text nur an und lässt ihn nicht bearbeiten. Lieber ein
 * Feld, das hier nicht geht, als ein Feld, das hier stillschweigend
 * verarmt.
 */

export type RechtstextFeld = {
  feld: string
  label: string
  /** Wo der Text draußen steht — ohne Sprachkürzel */
  pfad: string
  hinweis?: string
}

export const RECHTSTEXT_FELDER: RechtstextFeld[] = [
  {
    feld: 'impressum',
    label: 'Impressum',
    pfad: '/kontakt/impressum',
    hinweis: 'Firma, Anschrift, Vertretung, Registernummer, Umsatzsteuer-Nummer.',
  },
  {
    feld: 'datenschutz',
    label: 'Datenschutzerklärung',
    pfad: '/kontakt/datenschutzerklaerung',
    hinweis: 'Der Abschnitt zur Besucherzählung entsteht von selbst und muss hier nicht stehen.',
  },
  {
    feld: 'agb',
    label: 'AGB',
    pfad: '/kontakt/agb',
    hinweis: 'Vertragsschluss, Preise, Lieferung, Eigentumsvorbehalt, Gewährleistung.',
  },
  {
    feld: 'widerruf',
    label: 'Widerrufsbelehrung',
    pfad: '/kontakt/widerruf',
    hinweis:
      'Vierzehn Tage, Fristbeginn, Folgen — und der Satz, dass bei einem nach Vorgabe gefertigten Einzelstück kein Widerrufsrecht besteht. Ohne diesen Satz gilt es doch.',
  },
  {
    feld: 'widerrufsformular',
    label: 'Muster-Widerrufsformular',
    pfad: '/kontakt/widerruf',
    hinweis: 'Steht unter der Belehrung auf derselben Seite.',
  },
  {
    feld: 'versandZahlung',
    label: 'Versand & Zahlung',
    pfad: '/kontakt/versand-zahlung',
    hinweis: 'Lieferzeiten, Versandkosten, Zahlungsarten.',
  },
]

type Knoten = {
  type?: string
  text?: string
  children?: unknown[]
}

/** Enthält der Richtext nur das, was sich als Absatztext zurückschreiben lässt? */
export function nurAbsaetze(wert: unknown): boolean {
  const erlaubt = new Set(['root', 'paragraph', 'text', 'linebreak'])
  const pruefe = (knoten: unknown): boolean => {
    if (!knoten || typeof knoten !== 'object') return true
    const n = knoten as Knoten
    if (n.type && !erlaubt.has(n.type)) return false
    if (!Array.isArray(n.children)) return true
    return n.children.every(pruefe)
  }
  const wurzel = (wert as { root?: unknown } | null)?.root
  // Ein leeres Feld ist unbedenklich — dort ist nichts zu verlieren
  return wurzel ? pruefe(wurzel) : true
}

/** Richtext zu Fließtext: ein Absatz je Leerzeile */
export function textAusRichText(wert: unknown): string {
  const sammle = (knoten: unknown): string => {
    if (!knoten || typeof knoten !== 'object') return ''
    const n = knoten as Knoten
    if (n.type === 'linebreak') return '\n'
    if (typeof n.text === 'string') return n.text
    if (!Array.isArray(n.children)) return ''
    const innen = n.children.map(sammle).join('')
    return n.type === 'paragraph' || n.type === 'heading' ? `${innen}\n\n` : innen
  }
  const wurzel = (wert as { root?: unknown } | null)?.root
  return wurzel ? sammle(wurzel).replace(/\n{3,}/g, '\n\n').trim() : ''
}
