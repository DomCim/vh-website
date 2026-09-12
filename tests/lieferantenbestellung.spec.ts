import { expect, test } from '@playwright/test'

import {
  bestellmenge,
  istKnapp,
  nachLieferanten,
  offeneMenge,
  type Lagerposten,
  type Lieferantenbestellung,
} from '../src/lib/nachbestellung'

/**
 * Nachbestellen, nachdem es zu Ende gedacht wurde.
 *
 * Dominik ist am 11.09.2026 aufgefallen, dass der Weg mittendrin aufhört.
 * Vier Lücken kamen dabei heraus; drei davon prüft diese Datei (die vierte —
 * „es gibt keinen Beleg" — ist die Sammlung selbst und braucht keine Prüfung,
 * sie ist entweder da oder nicht):
 *
 *  1. Die bestellte Menge war weg — sie stand nur im Mailtext.
 *  2. Eine Anfrage galt sofort als Bestellung.
 *  3. Eine Teillieferung hob den Riegel gegen die Doppelbestellung aus.
 *
 * Geprüft wird die Rechnung und nicht die Seite: Sie ist der Ort, an dem die
 * Regel steht, und sie läuft ohne Server und ohne Datenbank.
 */

const draht: Lagerposten = {
  id: 7,
  name: 'Draht 3 mm',
  unit: 'm',
  quantity: 4,
  minQuantity: 20,
  orderQuantity: 50,
  supplier: 3,
}

const bestellung = (
  stand: string,
  geliefert = 0,
  menge = 50,
): Lieferantenbestellung => ({
  id: 1,
  orderNumber: 'LB-2026-0001',
  status: stand,
  supplier: 3,
  lines: [{ item: 7, quantity: menge, deliveredQuantity: geliefert }],
})

test.describe('Was noch aussteht', () => {
  test('ohne Bestellung steht nichts aus', () => {
    expect(offeneMenge([], 7)).toBe(0)
  })

  test('eine Anfrage zählt schon als unterwegs — sie ist ja raus', () => {
    expect(offeneMenge([bestellung('angefragt')], 7)).toBe(50)
  })

  test('was geliefert wurde, steht nicht mehr aus', () => {
    expect(offeneMenge([bestellung('teilgeliefert', 20)], 7)).toBe(30)
  })

  test('eine abgeschlossene Bestellung zählt nicht mehr', () => {
    expect(offeneMenge([bestellung('geliefert', 50)], 7)).toBe(0)
  })

  /*
   * Der Fall, der den Anlass gab: Storniert heißt, es kommt nichts. Der
   * Posten muss sofort wieder zum Bestellen dastehen, sonst wartet man auf
   * eine Lieferung, die niemand mehr schickt.
   */
  test('eine stornierte Bestellung zählt nicht mehr', () => {
    expect(offeneMenge([bestellung('storniert')], 7)).toBe(0)
  })
})

test.describe('Was zum Bestellen dasteht', () => {
  test('knapp und nichts unterwegs: steht da', () => {
    expect(istKnapp(draht)).toBe(true)
    const bloecke = nachLieferanten([draht], [{ id: 3, name: 'Stahl Meier' }], [])
    expect(bloecke).toHaveLength(1)
    expect(bloecke[0].zeilen[0].menge).toBe(bestellmenge(draht))
  })

  test('vollständig bestellt: steht nicht mehr da', () => {
    const bloecke = nachLieferanten(
      [draht],
      [{ id: 3, name: 'Stahl Meier' }],
      [bestellung('bestellt')],
    )
    expect(bloecke).toHaveLength(0)
  })

  /**
   * **Die eigentliche Reparatur.**
   *
   * Vorher löschte jeder Zugang das Datum `reorderedAt` am Posten — auch eine
   * halbe Lieferung. Der Posten lag danach weiter unter dem Mindestbestand,
   * stand am nächsten Tag wieder in der Liste und wäre ein zweites Mal
   * bestellt worden. Jetzt zählt die Menge: 20 von 50 sind da, 30 sind
   * unterwegs, und weil 30 nicht für die volle Bestellmenge reicht, darf man
   * nachlegen — aber eben bewusst und nicht aus Versehen.
   */
  test('halb geliefert: der Rest bleibt unterwegs', () => {
    expect(offeneMenge([bestellung('teilgeliefert', 20)], 7)).toBe(30)
    const bloecke = nachLieferanten(
      [draht],
      [{ id: 3, name: 'Stahl Meier' }],
      [bestellung('teilgeliefert', 45)],
    )
    // 5 von 50 stehen noch aus — zu wenig, um den Posten zu versorgen
    expect(bloecke).toHaveLength(1)
  })

  test('storniert: steht sofort wieder da', () => {
    const bloecke = nachLieferanten(
      [draht],
      [{ id: 3, name: 'Stahl Meier' }],
      [bestellung('storniert')],
    )
    expect(bloecke).toHaveLength(1)
  })

  /*
   * Woanders bestellt — im Netz, im Laden, am Telefon. Dann gibt es keinen
   * Geschäftspartner, nur einen Namen als Text. Der Posten muss trotzdem als
   * versorgt gelten, sonst steht er morgen wieder da.
   */
  test('ohne Geschäftspartner bestellt zählt genauso', () => {
    const woanders: Lieferantenbestellung = {
      id: 2,
      status: 'bestellt',
      supplier: null,
      supplierName: 'im Netz bestellt',
      lines: [{ item: 7, quantity: 50, deliveredQuantity: 0 }],
    }
    expect(offeneMenge([woanders], 7)).toBe(50)
    expect(nachLieferanten([draht], [], [woanders])).toHaveLength(0)
  })
})
