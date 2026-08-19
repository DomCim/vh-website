/**
 * Zahlen und Daten, wie sie im Büro gelesen werden.
 *
 * Eigenes Modul, weil beide Seiten es brauchen: der Server beim Erzeugen von
 * PDFs und Mails, der Browser beim Rendern der Büro-Seiten. Ein Import aus
 * lib/office zöge dort Payload und `next/headers` mit ins Bündel.
 */

export const euro = (v: number | null | undefined) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export const datum = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

/** Anfang und Ende eines Jahres als ISO-Zeitpunkte */
export function jahresZeitraum(jahr: number) {
  return {
    von: new Date(Date.UTC(jahr, 0, 1)).toISOString(),
    bis: new Date(Date.UTC(jahr + 1, 0, 1)).toISOString(),
  }
}
