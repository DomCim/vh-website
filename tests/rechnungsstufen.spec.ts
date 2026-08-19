import { expect, test } from '@playwright/test'

import { auftragsWert, geplanteStufen, stufenBerechnen } from '../src/lib/anzahlung'
import { stufenNummer } from '../src/lib/nummernkreis'

/**
 * Welche Rechnungen ein Auftrag bekommt — und wie sie heißen.
 *
 * Der Nenner in `RE-2026-0042-1/3` ist eine Zusage: Wer die erste Rechnung in
 * der Hand hält, weiß, dass noch zwei kommen. Steht dort eine falsche Zahl,
 * ist die Zusage falsch, und niemand merkt es, bis die Kundschaft nachfragt.
 */

test.describe('Welche Stufen es gibt', () => {
  test('ohne Anteile gibt es gar keine Stufen', () => {
    expect(geplanteStufen({})).toEqual([])
    expect(geplanteStufen({ anzahlungProzent: 0, zwischenProzent: 0 })).toEqual([])
    expect(geplanteStufen(null)).toEqual([])
  })

  test('nur Anzahlung heißt: zwei Rechnungen', () => {
    expect(geplanteStufen({ anzahlungProzent: 30 })).toEqual(['anzahlung', 'schluss'])
  })

  test('nur Zwischenrechnung heißt ebenfalls zwei', () => {
    expect(geplanteStufen({ zwischenProzent: 40 })).toEqual(['zwischen', 'schluss'])
  })

  test('beides heißt drei — in der Reihenfolge, in der gestellt wird', () => {
    expect(geplanteStufen({ anzahlungProzent: 30, zwischenProzent: 40 })).toEqual([
      'anzahlung',
      'zwischen',
      'schluss',
    ])
  })

  /*
   * Die Schlussrechnung ist der Rest und wird nie eingetragen. Sie darf
   * deshalb auch dann nicht verschwinden, wenn Anzahlung und Zwischenrechnung
   * zusammen schon hundert Prozent ergeben — dann steht dort eben eine Null,
   * und das ist eine Aussage: Es ist alles bezahlt.
   */
  test('die Schlussrechnung bleibt in der Liste, auch wenn nichts übrig ist', () => {
    const plan = { anzahlungProzent: 50, zwischenProzent: 50 }
    expect(geplanteStufen(plan)).toHaveLength(3)
    expect(stufenBerechnen(1000, plan).schluss).toBe(0)
  })
})

test.describe('Auftragswert aus den Positionen', () => {
  test('Menge mal Preis, auf den Cent', () => {
    expect(
      auftragsWert([
        { quantity: 2, price: 1250.5 },
        { quantity: 1, price: 99.99 },
      ]),
    ).toBe(2600.99)
  })

  test('fehlende Angaben zählen als null statt als NaN', () => {
    expect(auftragsWert([{ description: 'ohne Preis', quantity: 3 } as never])).toBe(0)
    expect(auftragsWert(null)).toBe(0)
    expect(auftragsWert([])).toBe(0)
  })

  /*
   * Der Cent-Fall auch hier: 3 × 33,33 sind 99,99 und nicht 99,99000000000001.
   * Aus diesem Wert werden die Stufen gerechnet — ein Fehler in der siebten
   * Stelle steht am Ende als Differenz auf dem Papier.
   */
  test('rechnet sauber, wo Fließkomma es nicht tut', () => {
    expect(auftragsWert([{ quantity: 3, price: 33.33 }])).toBe(99.99)
    expect(auftragsWert([{ quantity: 0.1, price: 0.2 }])).toBe(0.02)
  })
})

test.describe('Die Nummer einer Stufe', () => {
  test('trägt Zähler und Nenner', () => {
    expect(stufenNummer('RE-2026-0042', 1, 3)).toBe('RE-2026-0042-1/3')
    expect(stufenNummer('RE-2026-0042', 3, 3)).toBe('RE-2026-0042-3/3')
  })

  test('zwei Stufen sehen anders aus als drei — und das ist der Punkt', () => {
    expect(stufenNummer('RE-2026-0007', 2, 2)).toBe('RE-2026-0007-2/2')
    expect(stufenNummer('RE-2026-0007', 2, 3)).not.toBe(stufenNummer('RE-2026-0007', 2, 2))
  })
})
