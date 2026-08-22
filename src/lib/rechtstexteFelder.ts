/**
 * Die Rechtstexte, wie das Büro sie sieht — als lesbarer Text mit einer
 * winzigen Auszeichnung.
 *
 * **Warum nicht als Richtext-Editor.** Ein zweiter Editor neben dem im
 * Admin-Panel wäre eine zweite Stelle, an der ein Absatz verschwinden kann,
 * den ein Anwalt hineingeschrieben hat. Und er wäre am Telefon kaum zu
 * bedienen.
 *
 * **Warum nicht als reiner Fließtext.** So fing es an, und es war zu wenig:
 * Ein Impressum ohne Zwischenüberschriften und eine Widerrufsbelehrung ohne
 * abgesetzte Ausnahme liest niemand gern. Wer sie pflegen soll, will sie auch
 * gliedern können.
 *
 * Der Mittelweg steht in `lib/richtextText.ts`: vier Zeichenfolgen für
 * Überschrift, Unterüberschrift, Aufzählung und Fettes. Der Weg dorthin und
 * zurück ergibt denselben Text; eine Prüfung hält das fest.
 */
import { darstellbar, richTextZuText, textZuRichText } from './richtextText'

export { darstellbar as nurAbsaetze, richTextZuText as textAusRichText, textZuRichText }

/** Kurzhilfe, die im Büro unter den Feldern steht */
export const AUSZEICHNUNG = [
  '## Überschrift',
  '### kleinere Überschrift',
  '- Punkt einer Aufzählung',
  '**fett**',
]

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
