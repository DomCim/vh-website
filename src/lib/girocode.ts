/**
 * GiroCode — der QR-Code, der die Überweisung ausfüllt.
 *
 * Eine Rechnung mit IBAN heißt für die Kundschaft: Zahlen abtippen, und jede
 * falsche Ziffer wird zu einer Rückfrage bei dir. Derselbe Betrag als QR-Code
 * heißt: Kamera drauf, Banking-App schlägt die fertige Überweisung vor,
 * bestätigen. Das ist der Unterschied, der Vorkasse von einer Zumutung zu
 * einer normalen Zahlart macht — und er kostet keine Gebühr.
 *
 * Das Format ist genormt (EPC069-12, „European Payments Council Quick
 * Response Code"). Jede deutsche und österreichische Banking-App liest es;
 * französische inzwischen meist auch. Es ist keine Erfindung von uns, deshalb
 * steht hier auch nichts Kreatives — die Reihenfolge der Zeilen *ist* das
 * Format, und wer eine einfügt, macht den Code unlesbar.
 */

export type GiroDaten = {
  /** Kontoinhaber, wie er bei der Bank steht — max. 70 Zeichen */
  empfaenger: string
  iban: string
  bic?: string | null
  /** In Euro, z.B. 1990.5 */
  betrag: number
  /** Verwendungszweck, max. 140 Zeichen */
  zweck: string
}

/** Nur Ziffern und Buchstaben, so wie die Bank sie kennt. */
const ibanSauber = (wert: string) => wert.replace(/\s+/g, '').toUpperCase()

/**
 * Erzeugt den Inhalt des QR-Codes.
 *
 * Gibt `null` zurück, wenn etwas fehlt oder nicht passt. Das ist Absicht:
 * Ein QR-Code mit falschem Betrag ist schlimmer als keiner — er sieht
 * vertrauenswürdig aus und führt zu einer Zahlung, die niemand erwartet hat.
 */
export function giroInhalt(daten: GiroDaten): string | null {
  const iban = ibanSauber(daten.iban ?? '')
  // Grobe Form: Länderkennung, zwei Prüfziffern, danach Kontoangaben
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return null

  const empfaenger = (daten.empfaenger ?? '').trim().slice(0, 70)
  if (!empfaenger) return null

  // Die Norm kennt keine negativen Beträge und deckelt bei knapp einer
  // Milliarde. Beides sollte nie vorkommen — falls doch, lieber kein Code.
  if (!Number.isFinite(daten.betrag) || daten.betrag <= 0 || daten.betrag > 999999999.99) {
    return null
  }

  const betrag = `EUR${daten.betrag.toFixed(2)}`
  const zweck = (daten.zweck ?? '').trim().slice(0, 140)
  const bic = (daten.bic ?? '').replace(/\s+/g, '').toUpperCase()

  /*
   * Version 002 erlaubt UTF-8 und macht die BIC freiwillig — bei 001 wäre sie
   * Pflicht, und die kennt außerhalb des eigenen Kontoauszugs kaum jemand.
   */
  return [
    'BCD',
    '002',
    '1', // 1 = UTF-8
    'SCT', // SEPA Credit Transfer
    bic,
    empfaenger,
    iban,
    betrag,
    '', // Zweckcode (leer)
    '', // Strukturierte Referenz (leer — wir nutzen den freien Text darunter)
    zweck,
    '', // Anzeigetext für die App
  ].join('\n')
}

/**
 * Der fertige QR-Code als PNG-Datenpuffer, oder `null`.
 *
 * Fehlerkorrektur bewusst auf „M": Der Code steht auf Papier, das gefaltet,
 * kopiert und im Sonnenlicht fotografiert wird. „L" wäre kleiner und läse
 * sich unter diesen Bedingungen schlechter.
 */
export async function giroBild(daten: GiroDaten): Promise<Buffer | null> {
  const inhalt = giroInhalt(daten)
  if (!inhalt) return null

  const { toBuffer } = await import('qrcode')
  return toBuffer(inhalt, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 320,
    type: 'png',
  })
}
