import { expect, test } from '@playwright/test'

import {
  dauerText,
  istZeitraum,
  spanne,
  tagesstempel,
  ZEITRAEUME,
  zugangAus,
} from '../src/lib/statistik'

/**
 * Die Rechenteile der Besucherzählung.
 *
 * Geprüft wird ohne laufendes Plausible: Was hier schiefgehen kann, sind
 * Zeiträume und Zugangsdaten — und beides fällt im Betrieb nicht auf. Ein um
 * einen Tag verschobener Zeitraum sieht aus wie eine ruhige Woche, und ein
 * halb eingetragener Zugang wie „noch keine Besucher".
 */

test.describe('Zugang', () => {
  test('vollständige Angaben ergeben einen Zugang', () => {
    expect(zugangAus('http://plausible:8000', 'vincent-hellmann.com', 'geheim')).toEqual({
      adresse: 'http://plausible:8000',
      seite: 'vincent-hellmann.com',
      schluessel: 'geheim',
    })
  })

  /*
   * Ein Schrägstrich am Ende ist der klassische Tippfehler beim Eintragen.
   * Ungefiltert entstünde daraus `http://plausible:8000//api/v2/query` — was
   * je nach Server ein 404 gibt, also aussieht wie „keine Daten".
   */
  test('ein Schrägstrich am Ende schadet nicht', () => {
    expect(zugangAus('http://plausible:8000/', 'seite', 'k')?.adresse).toBe(
      'http://plausible:8000',
    )
    expect(zugangAus('http://plausible:8000///', 'seite', 'k')?.adresse).toBe(
      'http://plausible:8000',
    )
  })

  test('fehlt eine Angabe, gibt es keinen Zugang', () => {
    expect(zugangAus(undefined, 'seite', 'k')).toBeUndefined()
    expect(zugangAus('http://p:8000', undefined, 'k')).toBeUndefined()
    expect(zugangAus('http://p:8000', 'seite', undefined)).toBeUndefined()
    expect(zugangAus('  ', ' ', ' ')).toBeUndefined()
  })
})

test.describe('Zeiträume', () => {
  test('nur bekannte Zeiträume zählen', () => {
    expect(istZeitraum('30t')).toBe(true)
    expect(istZeitraum('7t')).toBe(true)
    // Aus der Adresszeile kann alles kommen — auch das
    expect(istZeitraum('30d')).toBe(false)
    expect(istZeitraum('')).toBe(false)
    expect(istZeitraum(undefined)).toBe(false)
    expect(istZeitraum('constructor')).toBe(false)
  })

  /*
   * Beide Tage zählen mit. „7 Tage" heißt heute und die sechs davor — nicht
   * heute und die sieben davor, sonst stünden acht Balken im Verlauf.
   */
  test('sieben Tage sind sieben Tage, heute eingeschlossen', () => {
    const [von, bis] = spanne('7t', new Date('2026-08-20T12:00:00Z'))
    expect(bis).toBe('2026-08-20')
    expect(von).toBe('2026-08-14')
  })

  test('dreißig Tage reichen über den Monatswechsel', () => {
    const [von, bis] = spanne('30t', new Date('2026-03-05T12:00:00Z'))
    expect(bis).toBe('2026-03-05')
    expect(von).toBe('2026-02-04')
  })

  test('jeder Zeitraum hat eine Beschriftung und eine Länge', () => {
    for (const [schluessel, eintrag] of Object.entries(ZEITRAEUME)) {
      expect(eintrag.label.length).toBeGreaterThan(0)
      expect(eintrag.tage).toBeGreaterThan(0)
      expect(istZeitraum(schluessel)).toBe(true)
    }
  })

  /*
   * Der Container läuft nach UTC, die Werkstatt nach Pariser Zeit. Um 23:30
   * Uhr in Paris ist es in London noch derselbe Tag, in UTC aber schon —
   * beziehungsweise noch nicht — der nächste. Ohne Zeitzone hörte der Verlauf
   * einen Tag zu früh auf, und der letzte Balken fehlte immer.
   */
  test('der Tag richtet sich nach der Werkstatt, nicht nach dem Server', () => {
    // 22:30 UTC ist in Paris (Sommerzeit, UTC+2) bereits der nächste Tag
    const abends = new Date('2026-08-20T22:30:00Z')
    expect(tagesstempel(abends, 'Europe/Paris')).toBe('2026-08-21')
    expect(tagesstempel(abends, 'UTC')).toBe('2026-08-20')
  })

  test('der Tagesstempel ist immer JJJJ-MM-TT', () => {
    expect(tagesstempel(new Date('2026-01-05T12:00:00Z'), 'Europe/Paris')).toBe('2026-01-05')
    expect(tagesstempel(new Date('2026-12-31T12:00:00Z'), 'Europe/Paris')).toBe('2026-12-31')
  })
})

test.describe('Verweildauer', () => {
  test('unter einer Minute in Sekunden', () => {
    expect(dauerText(0)).toBe('0 Sek.')
    expect(dauerText(45)).toBe('45 Sek.')
    expect(dauerText(59.4)).toBe('59 Sek.')
  })

  test('darüber in Minuten und Sekunden', () => {
    expect(dauerText(60)).toBe('1:00 Min.')
    expect(dauerText(754)).toBe('12:34 Min.')
    // Die Sekunden bleiben zweistellig, sonst steht da „3:5 Min."
    expect(dauerText(185)).toBe('3:05 Min.')
  })
})
