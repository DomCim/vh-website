import { type Stufen } from './anzahlung'

/**
 * Was eine offene Rechnung für den Auftrag bedeutet.
 *
 * Der Zusammenhang, um den es geht: Wird nicht gezahlt, wird nicht gearbeitet
 * — und damit verschiebt sich die Lieferung. Das ist keine Strafe, sondern
 * Arithmetik: Die Werkstatt fängt nicht an, also fehlen die Tage hinten.
 *
 * Zwei Dinge macht dieses Modul bewusst **nicht**:
 *
 * Es speichert keinen Zustand am Auftrag. „Wartet auf Zahlung" wäre ein
 * Status, den jemand pflegen müsste und der irgendwann falsch dasteht, weil
 * die Zahlung kam und niemand ihn zurückgesetzt hat. Er ergibt sich aus den
 * Rechnungen, und daraus wird er auch abgeleitet.
 *
 * Und es verschiebt keinen Termin von selbst. Ein zugesagtes Datum, das sich
 * still ändert, ist schlimmer als eines, das sich sichtbar ändert: Der Kunde
 * hat den alten Termin im Kalender, und erfahren muss er es von einem
 * Menschen, nicht von einer Datenbank.
 */

export type StufenRechnung = {
  stufe?: string | null
  status?: string | null
  /** Gesetzt, wenn dies die Gegenrechnung eines Stornos ist. */
  stornoVon?: unknown
  /** Fällig am — ISO-Zeichenkette oder Datum */
  dueDate?: string | Date | null
  netto?: number | null
  nummer?: string | null
}

export type Zahlungsstand = {
  /** Steht die Fertigung, weil Geld fehlt? */
  wartet: boolean
  /** Um wie viele Tage ist die älteste offene Stufe überfällig? */
  tageUeberfaellig: number
  /** Welche Stufe hängt — für die Anzeige */
  offeneStufe: string | null
  /** Ist es die Anzahlung? Dann wird erinnert, nicht gemahnt. */
  nurErinnern: boolean
  /** Ist die Frist erreicht, ab der über den Werkstattplatz zu entscheiden ist? */
  platzFrage: boolean
}

const TAG = 24 * 60 * 60 * 1000

/*
 * Was eine Rechnung für Umsatz und offene Posten bedeutet — an einer Stelle.
 *
 * Der Anlass war ein Storno, das den Umsatz doppelt drückte: Das Original
 * fiel mit „storniert" aus der Summe, die negative Gegenrechnung blieb mit
 * „gestellt" drin. Richtig ist: Beide Belege zählen — Original und
 * Gegenrechnung heben sich auf, und der Steuerberater sieht beide Zeilen.
 * Und keiner von beiden ist ein offener Posten: Aus einem Storno ist nichts
 * zu zahlen.
 */

/** Zählt diese Rechnung zum Umsatz? Storno-Paare heben sich darin auf. */
export const zaehltZumUmsatz = (r: { status?: string | null }) =>
  ['gestellt', 'bezahlt', 'storniert'].includes(r.status ?? '')

/** Wartet aus dieser Rechnung noch Geld? Gegenrechnungen eines Stornos nie. */
export const istOffenerPosten = (r: { status?: string | null; stornoVon?: unknown }) =>
  r.status === 'gestellt' && !r.stornoVon

/** Ganze Tage zwischen einem Datum und heute; negativ heißt: noch nicht fällig. */
export function tageSeit(datum: string | Date | null | undefined, jetzt = new Date()): number {
  if (!datum) return 0
  const dann = new Date(datum).getTime()
  if (!Number.isFinite(dann)) return 0
  return Math.floor((jetzt.getTime() - dann) / TAG)
}

/**
 * Der Zahlungsstand eines Auftrags.
 *
 * Gewartet wird auf die **älteste** offene Stufe. Sind Anzahlung und
 * Zwischenrechnung beide offen, hängt es an der Anzahlung — und dort wird
 * erinnert statt gemahnt, weil noch nichts geleistet ist.
 */
export function zahlungsstand(
  rechnungen: StufenRechnung[],
  platzFreigebenNachTagen = 21,
  jetzt = new Date(),
): Zahlungsstand {
  const offen = rechnungen
    .filter((r) => istOffenerPosten(r) && r.dueDate)
    .map((r) => ({ ...r, ueberfaellig: tageSeit(r.dueDate, jetzt) }))
    .filter((r) => r.ueberfaellig > 0)
    .sort((a, b) => b.ueberfaellig - a.ueberfaellig)

  const aelteste = offen[0]
  if (!aelteste) {
    return {
      wartet: false,
      tageUeberfaellig: 0,
      offeneStufe: null,
      nurErinnern: false,
      platzFrage: false,
    }
  }

  const istAnzahlung = aelteste.stufe === 'anzahlung'
  return {
    wartet: true,
    tageUeberfaellig: aelteste.ueberfaellig,
    offeneStufe: aelteste.stufe ?? null,
    nurErinnern: istAnzahlung,
    platzFrage: istAnzahlung && aelteste.ueberfaellig >= platzFreigebenNachTagen,
  }
}

/**
 * Um wie viel sich die Fertigstellung verschiebt.
 *
 * Ein Tag ohne Geld ist ein Tag ohne Arbeit — mehr steckt nicht dahinter. Die
 * Zahl ist ein Vorschlag für den Menschen, der den Termin verschiebt, keine
 * Automatik.
 *
 * Bewusst ohne Feinheiten: Wochenenden und Feiertage werden nicht
 * herausgerechnet. Eine Verschiebung um „ungefähr so viele Tage, wie das Geld
 * ausgeblieben ist" ist ehrlich; eine auf den Werktag genau gerechnete
 * Verschiebung wäre eine Genauigkeit, die es nicht gibt — der Auftrag steht ja
 * auch nicht allein in der Werkstatt.
 */
export function terminVerschiebung(stand: Zahlungsstand): number {
  return stand.wartet ? stand.tageUeberfaellig : 0
}

/**
 * Wie viel ist von einem Auftrag schon eingegangen?
 *
 * Für die Übersicht im Büro: Was steht, was fehlt. Bezahlt zählt, gestellt
 * nicht — eine Rechnung im Briefkasten ist kein Geld auf dem Konto.
 */
export function eingegangen(rechnungen: StufenRechnung[]): number {
  return rechnungen
    .filter((r) => r.status === 'bezahlt')
    .reduce((summe, r) => summe + (Number(r.netto) || 0), 0)
}

/** Was noch aussteht, gemessen an den geplanten Stufen. */
export function offenerBetrag(stufen: Stufen, rechnungen: StufenRechnung[]): number {
  const gesamt = stufen.anzahlung + stufen.zwischen + stufen.schluss
  return Math.round((gesamt - eingegangen(rechnungen)) * 100) / 100
}
