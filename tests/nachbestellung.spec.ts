import { expect, test } from '@playwright/test'

import {
  anfrageText,
  bestellmenge,
  istKnapp,
  nachLieferanten,
  type Lagerposten,
} from '../src/lib/nachbestellung'

/**
 * Was nachbestellt werden muss. Rechnet das falsch, steht die Werkstatt
 * entweder vor einem leeren Regal oder vor einer Palette, die niemand braucht.
 */

const POSTEN: Lagerposten[] = [
  // Knapp, Lieferant bekannt, eigene Bestellmenge (eine ganze Rolle)
  {
    id: 1,
    name: 'Schweißdraht 1,0 mm',
    unit: 'm',
    quantity: 8,
    minQuantity: 20,
    orderQuantity: 100,
    supplierRef: 'SD-10',
    supplier: 7,
  },
  // Knapp, Lieferant bekannt, ohne eigene Bestellmenge
  { id: 2, name: 'Grundierung', unit: 'l', quantity: 1, minQuantity: 5, supplier: 7 },
  // Knapp, aber niemand weiß, wo es herkommt
  { id: 3, name: 'Schleifscheiben', unit: 'Stück', quantity: 2, minQuantity: 10 },
  // Genug da
  { id: 4, name: 'Cortenblech', unit: 'Platte', quantity: 30, minQuantity: 10, supplier: 8 },
  // Ohne Mindestbestand — gar keine Aussage
  { id: 5, name: 'Restposten', unit: 'Stück', quantity: 0 },
]

const LIEFERANTEN = [
  { id: 7, name: 'Metall Meier', email: 'einkauf@meier.example' },
  { id: 8, name: 'Stahl Schmitt', email: 'info@schmitt.example' },
]

test.describe('Wann ein Posten knapp ist', () => {
  test('unter dem Mindestbestand — und nur dann', () => {
    expect(istKnapp(POSTEN[0])).toBe(true)
    expect(istKnapp(POSTEN[3])).toBe(false)
  })

  /*
   * Ohne Mindestbestand gibt es keine Aussage. Null als Mindestbestand zu
   * unterstellen hieße: Jeder leere Posten schreit nach einer Bestellung, auch
   * der Restposten, den niemand mehr braucht.
   */
  test('ohne Mindestbestand keine Aussage', () => {
    expect(istKnapp(POSTEN[4])).toBe(false)
  })
})

test.describe('Wie viel bestellt wird', () => {
  test('die hinterlegte Bestellmenge, wenn es eine gibt', () => {
    expect(bestellmenge(POSTEN[0])).toBe(100)
  })

  /*
   * Sonst auf das Doppelte des Mindestbestands auffüllen. Genau bis zum
   * Mindestbestand aufzufüllen hieße: beim nächsten Verbrauch sofort wieder
   * knapp — und die Bestellung war für die Katz.
   */
  test('sonst bis auf das Doppelte des Mindestbestands', () => {
    expect(bestellmenge(POSTEN[1])).toBe(9) // 5 × 2 − 1
  })

  test('und nie weniger als der Mindestbestand', () => {
    expect(bestellmenge({ id: 9, quantity: 9, minQuantity: 5 })).toBe(5)
  })
})

test.describe('Die Liste je Lieferant', () => {
  test('fasst zusammen, was beim selben Betrieb bestellt wird', () => {
    const bloecke = nachLieferanten(POSTEN, LIEFERANTEN)
    const meier = bloecke.find((b) => b.name === 'Metall Meier')!
    expect(meier.zeilen.map((z) => z.name)).toEqual(['Grundierung', 'Schweißdraht 1,0 mm'])
    expect(meier.email).toBe('einkauf@meier.example')
  })

  test('nimmt nur Knappes auf', () => {
    const bloecke = nachLieferanten(POSTEN, LIEFERANTEN)
    expect(bloecke.some((b) => b.zeilen.some((z) => z.name === 'Cortenblech'))).toBe(false)
  })

  /*
   * Posten ohne Lieferant fallen nicht heraus, sondern ans Ende: Sie sind der
   * Grund, warum man später vor einem leeren Regal steht und nicht weiß, wo
   * das Zeug herkam.
   */
  test('was keinen Lieferanten hat, steht am Ende und geht nicht verloren', () => {
    const bloecke = nachLieferanten(POSTEN, LIEFERANTEN)
    const letzter = bloecke[bloecke.length - 1]
    expect(letzter.lieferant).toBeNull()
    expect(letzter.zeilen.map((z) => z.name)).toEqual(['Schleifscheiben'])
  })

  test('rechnet aus, was fehlt', () => {
    const meier = nachLieferanten(POSTEN, LIEFERANTEN).find((b) => b.name === 'Metall Meier')!
    const draht = meier.zeilen.find((z) => z.name.startsWith('Schweißdraht'))!
    expect(draht.fehlt).toBe(12) // 20 − 8
    expect(draht.menge).toBe(100)
  })
})

test.describe('Der Text der Anfrage', () => {
  test('nennt Menge, Einheit und die Artikelnummer des Lieferanten', () => {
    const meier = nachLieferanten(POSTEN, LIEFERANTEN).find((b) => b.name === 'Metall Meier')!
    const text = anfrageText(meier.zeilen, { name: 'Vincent Hellmann' })
    expect(text).toContain('100 m Schweißdraht 1,0 mm (Art.-Nr. SD-10)')
    expect(text).toContain('9 l Grundierung')
    // Angebot mit Termin, nicht Bestellung: Preis und Verfügbarkeit stehen
    // noch nicht fest
    expect(text).toContain('Angebot mit Liefertermin')
  })
})
