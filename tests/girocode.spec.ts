import { expect, test } from '@playwright/test'

import { giroInhalt } from '../src/lib/girocode'

/**
 * Der GiroCode ist genormt — und Normen verzeihen nichts.
 *
 * Die Reihenfolge der Zeilen *ist* das Format. Wer eine einfügt, verschiebt
 * alles darunter: Aus dem Betrag wird der Verwendungszweck, aus der IBAN der
 * Empfängername. Die Banking-App liest den Code dann entweder gar nicht oder,
 * schlimmer, falsch — und der Fehler fällt erst auf, wenn Geld irgendwo
 * angekommen ist, wo es nicht hingehört.
 *
 * Deshalb prüft dieser Test die Zeilen einzeln und an ihrer Position.
 */

const ECHT = {
  empfaenger: 'Vincent Hellmann',
  iban: 'DE02 1203 0000 0000 2020 51',
  bic: 'BYLADEM1001',
  betrag: 1990,
  zweck: 'Anzahlung RE-2026-0042',
}

test.describe('GiroCode', () => {
  test('schreibt die Zeilen in der genormten Reihenfolge', () => {
    const zeilen = giroInhalt(ECHT)!.split('\n')

    expect(zeilen[0], 'Kennung').toBe('BCD')
    expect(zeilen[1], 'Fassung 002 — erst die erlaubt UTF-8 und macht die BIC freiwillig').toBe(
      '002',
    )
    expect(zeilen[2], 'Zeichensatz 1 = UTF-8').toBe('1')
    expect(zeilen[3], 'SEPA-Überweisung').toBe('SCT')
    expect(zeilen[4], 'BIC').toBe('BYLADEM1001')
    expect(zeilen[5], 'Empfänger').toBe('Vincent Hellmann')
    expect(zeilen[6], 'IBAN ohne Leerzeichen').toBe('DE02120300000000202051')
    expect(zeilen[7], 'Betrag mit zwei Nachkommastellen').toBe('EUR1990.00')
    expect(zeilen[10], 'Verwendungszweck').toBe('Anzahlung RE-2026-0042')
  })

  test('rundet auf Cent und hängt nie mehr an', () => {
    expect(giroInhalt({ ...ECHT, betrag: 1990.5 })!.split('\n')[7]).toBe('EUR1990.50')
    expect(giroInhalt({ ...ECHT, betrag: 0.07 })!.split('\n')[7]).toBe('EUR0.07')
  })

  /*
   * Lieber kein Code als ein falscher.
   *
   * Ein QR-Code sieht vertrauenswürdig aus — man scannt ihn und bestätigt,
   * ohne die Zahlen zu lesen. Steht Unsinn drin, ist genau das die Gefahr.
   * Deshalb gibt es hier im Zweifel nichts, und auf der Rechnung bleibt es
   * bei IBAN zum Abtippen.
   */
  test('gibt bei Unsinn lieber gar nichts zurück', () => {
    expect(giroInhalt({ ...ECHT, iban: 'keine-iban' }), 'kaputte IBAN').toBeNull()
    expect(giroInhalt({ ...ECHT, iban: '' }), 'IBAN fehlt').toBeNull()
    expect(giroInhalt({ ...ECHT, empfaenger: '  ' }), 'Empfänger fehlt').toBeNull()
    expect(giroInhalt({ ...ECHT, betrag: 0 }), 'Betrag null').toBeNull()
    expect(giroInhalt({ ...ECHT, betrag: -5 }), 'Betrag negativ').toBeNull()
    expect(giroInhalt({ ...ECHT, betrag: Number.NaN }), 'Betrag keine Zahl').toBeNull()
  })

  test('kürzt, was die Norm begrenzt', () => {
    const lang = giroInhalt({
      ...ECHT,
      empfaenger: 'V'.repeat(120),
      zweck: 'Z'.repeat(300),
    })!.split('\n')

    expect(lang[5].length, 'Empfänger höchstens 70 Zeichen').toBe(70)
    expect(lang[10].length, 'Verwendungszweck höchstens 140 Zeichen').toBe(140)
  })

  test('kommt ohne BIC aus', () => {
    const ohne = giroInhalt({ ...ECHT, bic: null })!.split('\n')
    expect(ohne[4], 'BIC-Zeile bleibt leer, verschwindet aber nicht').toBe('')
    expect(ohne[6], 'und alles darunter bleibt an seinem Platz').toBe('DE02120300000000202051')
  })
})

/**
 * Und derselbe Code auf dem Blatt.
 *
 * Geprüft wird nicht das Aussehen, sondern das, was schiefgehen kann: dass der
 * Code überhaupt aufs Papier kommt, wenn eine IBAN da ist — und dass bei einer
 * unbrauchbaren IBAN eben keiner erscheint. Ein QR-Code mit falschen Daten
 * sieht vertrauenswürdig aus und führt zu einer Zahlung, die niemand erwartet.
 */
test.describe('GiroCode auf der Rechnung', () => {
  const blatt = {
    art: 'rechnung' as const,
    nummer: 'RE-2026-0042-3/3',
    datum: '2026-08-19',
    preiseSind: 'netto' as const,
    empfaenger: { name: 'Gemeinde Musterhausen', anschrift: ['Rathausplatz 1'] },
    positionen: [{ bezeichnung: 'Sitzbank', menge: 1, einzelpreis: 1000, steuersatz: 20 }],
  }
  const firma = { legalName: 'Vincent Hellmann EI', vatRate: 20 }
  const bilder = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length

  test('mit IBAN steht ein Bild mehr auf dem Blatt', async () => {
    const { rechnungPdf } = await import('../src/lib/invoice')
    const ohne = await rechnungPdf(blatt, firma)
    const mit = await rechnungPdf(blatt, {
      ...firma,
      iban: 'FR7630006000011234567890189',
      bic: 'AGRIFRPP',
    })
    expect(bilder(mit)).toBeGreaterThan(bilder(ohne))
  })

  test('bei unbrauchbarer IBAN bleibt das Blatt, wie es war', async () => {
    const { rechnungPdf } = await import('../src/lib/invoice')
    const ohne = await rechnungPdf(blatt, firma)
    const kaputt = await rechnungPdf(blatt, { ...firma, iban: 'keine-gueltige-iban' })
    expect(bilder(kaputt)).toBe(bilder(ohne))
  })

  test('auf dem Angebot steht kein Zahlcode — dort ist noch nichts fällig', async () => {
    const { rechnungPdf } = await import('../src/lib/invoice')
    const angebot = await rechnungPdf(
      { ...blatt, art: 'angebot', nummer: 'AN-2026-0042' },
      { ...firma, iban: 'FR7630006000011234567890189' },
    )
    const rechnung = await rechnungPdf(blatt, {
      ...firma,
      iban: 'FR7630006000011234567890189',
    })
    expect(bilder(angebot)).toBeLessThan(bilder(rechnung))
  })
})
