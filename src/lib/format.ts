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

/** Anfang und Ende eines Monats (1–12) als ISO-Zeitpunkte */
export function monatsZeitraum(jahr: number, monat: number) {
  return {
    von: new Date(Date.UTC(jahr, monat - 1, 1)).toISOString(),
    bis: new Date(Date.UTC(jahr, monat, 1)).toISOString(),
  }
}

/**
 * „vor 12 Minuten" — wie alt etwas ist, in einem Satzteil.
 *
 * Ein Zeitpunkt beantwortet die Frage nicht, die man an eine Meldung hat: Man
 * will nicht wissen, dass sie von 7:55 Uhr ist, sondern dass sie von vorhin
 * ist. Der Abgleichpunkt sagt das seit jeher so; die Meldungen unter der
 * Glocke sagen es mit denselben Worten.
 */
export function seit(zeitpunkt: string | number | Date | null | undefined): string {
  if (zeitpunkt == null || zeitpunkt === '') return ''
  const zeit = zeitpunkt instanceof Date ? zeitpunkt.getTime() : new Date(zeitpunkt).getTime()
  if (!Number.isFinite(zeit)) return ''

  const sekunden = Math.round((Date.now() - zeit) / 1000)
  if (sekunden < 90) return 'gerade eben'
  const minuten = Math.round(sekunden / 60)
  if (minuten < 60) return `vor ${minuten} Minuten`
  const stunden = Math.round(minuten / 60)
  if (stunden < 24) return `vor ${stunden} Stunden`
  return `vor ${Math.round(stunden / 24)} Tagen`
}
