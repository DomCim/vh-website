/**
 * Die Bereiche des Büros und ihre Sammlungen.
 *
 * Eine Stelle, an der steht, was das Büro führt — davon leben die
 * Live-Meldungen, der Abgleich mit dem Gerät und der örtliche Bestand im
 * Browser. Kommt ein Bereich hinzu, genügt hier eine Zeile.
 *
 * Bewusst ohne Payload-Import: Diese Datei wird auch im Browser geladen.
 */

export const BEREICHE = {
  anfragen: 'inquiries',
  angebote: 'quotes',
  artikel: 'products',
  auftraege: 'jobs',
  belege: 'expenses',
  bestellungen: 'orders',
  inventar: 'inventory-items',
  inventur: 'stocktakes',
  kontobewegungen: 'bank-transactions',
  kundenstimmen: 'testimonials',
  medien: 'media',
  newsletter: 'newsletter-subscribers',
  partner: 'contacts',
  rechnungen: 'outgoing-invoices',
  wiedervorlagen: 'follow-ups',
} as const

/** Ein Bereich, hinter dem eine Sammlung steht. */
export type Bereich = keyof typeof BEREICHE

export const ALLE_BEREICHE = Object.keys(BEREICHE) as Bereich[]

/**
 * Das Postfach ist kein Bereich mit eigener Sammlung — die Nachrichten liegen
 * auf dem Mailserver. Gemeldet wird trotzdem, damit eine offene Postfach-Seite
 * neue Post mitbekommt.
 */
export type LiveBereich = Bereich | 'post'

/**
 * So lange werden Grabsteine über gelöschte Datensätze aufbewahrt. Wer länger
 * offline war, holt seinen Bestand von vorn — nach zwei Monaten ohne Netz ist
 * das ohnehin der schnellere Weg.
 */
export const GRABSTEIN_TAGE = 60

export function istBereich(wert: string): wert is Bereich {
  return Object.prototype.hasOwnProperty.call(BEREICHE, wert)
}
