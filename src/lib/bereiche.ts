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
  meldungen: 'notifications',
  newsletter: 'newsletter-subscribers',
  partner: 'contacts',
  rechnungen: 'outgoing-invoices',
  mappen: 'customer-uploads',
  wareneingaenge: 'goods-receipts',
  werkstattdateien: 'product-files',
  werkstattwochen: 'workshop-weeks',
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

/**
 * Welche Rechte einen Bereich ins Gerät bringen — eines genügt.
 *
 * Der Abgleich lieferte lange jeden Bereich an jeden, der das Büro öffnen
 * durfte: Ein Werkstattkonto ohne `zahlen.sehen` bekam sämtliche Rechnungen,
 * Belege und Kontobewegungen ins Gerät gespielt, nur die Anzeige blendete sie
 * aus. Die Navigation sagt selbst, dass sie kein Schutz ist — also muss der
 * Schutz hier sitzen, an der Schnittstelle.
 *
 * Die Listen sind ODER-Listen und bewusst großzügiger als die Navigation:
 * Ein Bereich wird auch von Seiten gelesen, die unter anderem Recht laufen —
 * die Auftragsseite braucht das Inventar, das Angebot die Partner. Wer hier
 * kürzt, muss vorher nachsehen, welche Seiten `useBestand('…')` rufen, sonst
 * steht eine davon mit leerer Liste da.
 *
 * Bereiche ohne Eintrag stehen jedem offen, der das Büro öffnen darf:
 * Artikel, Medien und Kundenstimmen sind ohnehin Website-Inhalt, Unterlagen
 * braucht, wer das Teil baut, und Meldungen, Wiedervorlagen und
 * Werkstattwochen sind Arbeitsorganisation ohne Zahlen.
 */
export const BEREICH_RECHTE: Partial<Record<Bereich, string[]>> = {
  anfragen: ['anfragen.bearbeiten', 'angebote.schreiben'],
  angebote: ['angebote.schreiben', 'auftraege.bearbeiten'],
  auftraege: ['auftraege.bearbeiten', 'angebote.schreiben', 'zahlen.sehen'],
  belege: ['belege.erfassen', 'zahlen.sehen'],
  bestellungen: ['anfragen.bearbeiten', 'auftraege.bearbeiten'],
  inventar: ['inventar.pflegen', 'auftraege.bearbeiten', 'website.pflegen'],
  inventur: ['inventar.pflegen'],
  kontobewegungen: ['rechnungen.schreiben', 'zahlen.sehen'],
  newsletter: ['newsletter.versenden'],
  partner: [
    'partner.pflegen',
    'anfragen.bearbeiten',
    'angebote.schreiben',
    'auftraege.bearbeiten',
    'rechnungen.schreiben',
    'belege.erfassen',
    'inventar.pflegen',
  ],
  rechnungen: ['rechnungen.schreiben', 'zahlen.sehen'],
  mappen: ['angebote.schreiben', 'auftraege.bearbeiten', 'anfragen.bearbeiten'],
  wareneingaenge: ['inventar.pflegen'],
}

/** Darf ein Konto mit diesen Rechten diesen Bereich ins Gerät bekommen? */
export function bereichErlaubt(bereich: Bereich, rechte: readonly string[]): boolean {
  const noetig = BEREICH_RECHTE[bereich]
  if (!noetig) return true
  return noetig.some((r) => rechte.includes(r))
}

/**
 * Sicherheitsabstand auf den neuen Stand des Abgleichs.
 *
 * Ein Datensatz wird geschrieben, gemeldet — und erst danach festgeschrieben.
 * Fragt das Gerät genau in diesem Fenster, bekommt es die Zeile nicht, wohl
 * aber einen Stand, der jünger ist als ihr `updatedAt`. Danach trifft
 * `updatedAt > stand` nie mehr: Der Datensatz ist für dieses Gerät für immer
 * unsichtbar — genau so verschwand ein fertiger Rechnungsentwurf, während die
 * Meldung dazu längst auf dem Handy lag.
 *
 * Eine Minute zurück kostet ein paar doppelt gelieferte Zeilen. Das Gerät legt
 * sie nach Kennung ab, doppelt ist also folgenlos; verloren ist es nicht.
 */
export const UEBERLAPPUNG_MS = 60_000

/**
 * Der Stand, den das Gerät sich merken soll.
 *
 * Bei einem vollen Paket zählt weiter der letzte gelieferte Datensatz: Der ist
 * festgeschrieben, sein Zeitpunkt ist exakt — und ein Abzug brächte das
 * Nachfassen in eine Schleife, sobald mehr als ein Paket in dasselbe Fenster
 * fällt.
 */
export function neuerStand(
  jetzt: string,
  letzter: string | undefined | null,
  mehr: boolean,
): string {
  if (mehr && letzter) return letzter
  return new Date(new Date(jetzt).getTime() - UEBERLAPPUNG_MS).toISOString()
}
