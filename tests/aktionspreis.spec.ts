import { expect, test } from '@playwright/test'

import {
  aktionFuerArtikel,
  mitRabatt,
  preisaktionAnzeigen,
  type Aktionsregel,
} from '../src/lib/aktionspreis'
import { laufendeAktionen } from '../src/lib/promotions'

/**
 * Was am Preis steht, muss an der Kasse abgezogen werden.
 *
 * Der teuerste Fehler wäre nicht ein fehlender Rabatt, sondern ein
 * angeschriebener, den die Kasse nicht kennt: Wer 1.194 € liest und 1.990 €
 * zahlen soll, kommt nicht wieder. Deshalb prüfen diese Tests weniger die
 * Anzeige als die Übereinstimmung mit der Rechnung im Warenkorb.
 */

const regel = (teile: Partial<Aktionsregel>): Aktionsregel => ({
  id: 1,
  title: 'Sommer-Sale',
  discountValue: 40,
  endDate: '2026-10-16T00:00:00.000Z',
  appliesTo: 'all',
  ...teile,
})

test('der Rabatt wird gerundet wie im Warenkorb', () => {
  // Der Fall aus dem Betrieb: Liege Vague, 3.790 €, Sommer-Sale mit 40 %.
  // Die Kasse zieht dafür 1.516,00 € ab.
  expect(mitRabatt(3790, 40)).toBe(2274)

  // Krumme Prozentsätze: erst den Rabatt auf den Cent, dann die Differenz.
  // 33 % von 99,99 € sind 32,9967 € — gerundet 33,00 €.
  expect(mitRabatt(99.99, 33)).toBe(66.99)

  expect(mitRabatt(1000, 0)).toBe(1000)
  expect(mitRabatt(1000, 100)).toBe(0)
})

test('eine Aktion auf alle Artikel gilt auch ohne Kategorie', () => {
  const treffer = aktionFuerArtikel({ id: 7 }, [regel({ appliesTo: 'all' })])
  expect(treffer?.prozent).toBe(40)
})

test('eine Aktion auf Kategorien gilt nur für die genannten', () => {
  const aktionen = [regel({ appliesTo: 'categories', categories: [8] })]

  expect(aktionFuerArtikel({ id: 1, categoryId: 8 }, aktionen)?.prozent).toBe(40)
  expect(aktionFuerArtikel({ id: 2, categoryId: 10 }, aktionen)).toBeNull()
  expect(aktionFuerArtikel({ id: 3 }, aktionen)).toBeNull()
})

/**
 * Die Kategorie am Artikel entscheidet — nicht die Kategorie darüber.
 *
 * Das ist derselbe Maßstab wie im Warenkorb (`applicableAmount` in
 * promotions.ts) und deshalb hier festgehalten: Wer eine Aktion auf „Outdoor"
 * legt und erwartet, dass sie für die Möbel darunter gilt, bekommt weder hier
 * noch an der Kasse einen Rabatt. Wichtig ist, dass beide Seiten sich gleich
 * irren — ein Streichpreis auf der Kachel, den die Kasse nicht kennt, wäre
 * schlimmer als gar keiner.
 */
test('eine Aktion auf die Oberkategorie greift nicht für die Unterkategorie', () => {
  const outdoor = regel({ appliesTo: 'categories', categories: [7] })
  expect(aktionFuerArtikel({ id: 1, categoryId: 8 }, [outdoor])).toBeNull()
})

test('eine Aktion auf einzelne Artikel gilt nur für die genannten', () => {
  const aktionen = [regel({ appliesTo: 'products', products: [{ id: 4 }] })]

  expect(aktionFuerArtikel({ id: 4, categoryId: 8 }, aktionen)?.prozent).toBe(40)
  expect(aktionFuerArtikel({ id: 5, categoryId: 8 }, aktionen)).toBeNull()
})

test('bei mehreren Aktionen gewinnt die größere', () => {
  const treffer = aktionFuerArtikel({ id: 1, categoryId: 8 }, [
    regel({ id: 1, discountValue: 10 }),
    regel({ id: 2, discountValue: 40, title: 'Sommer-Sale' }),
    regel({ id: 3, discountValue: 25 }),
  ])
  expect(treffer?.prozent).toBe(40)
  expect(treffer?.titel).toBe('Sommer-Sale')
})

/**
 * Ein Rabatt mit Gutscheincode darf nicht am Preis stehen: Er gilt erst nach
 * Eingabe im Warenkorb. Stünde er vorab da, wäre er für jeden versprochen,
 * der den Code nicht hat.
 */
test('Aktionen mit Gutscheincode kommen für die Preisanzeige nicht in Frage', async () => {
  const gefunden = [
    { ...regel({ id: 1 }), code: 'SOMMER' },
    { ...regel({ id: 2 }), code: '   ' },
    { ...regel({ id: 3 }), code: null },
    { ...regel({ id: 4, discountValue: 0 }) },
    { ...regel({ id: 5, discountValue: 120 }) },
  ]

  const payload = {
    find: async () => ({ docs: gefunden }),
  } as unknown as Parameters<typeof laufendeAktionen>[0]

  const uebrig = await laufendeAktionen(payload, 'de')

  // Bleiben dürfen: die ohne Code und die mit leerem Code — und beide nur mit
  // einem Prozentsatz, der zwischen 0 und 100 liegt.
  expect(uebrig.map((a) => a.id)).toEqual([2, 3])
})

/**
 * Ein Stück auf Anfrage hat keinen Preis — und damit auch keine Ersparnis.
 * Ein Band „−40 %" darüber verspräche eine Zahl, die niemand nennen kann, und
 * beim Anfragen käme dann der volle Preis.
 *
 * Diese Entscheidung steht bewusst nicht in der Kachel, sondern in der
 * Bibliothek: Kachel und Artikelseite sollen sie nicht getrennt treffen — und
 * so lässt sie sich prüfen, ohne ein Bauteil zu rendern.
 */
test('auf Anfrage bleibt auf Anfrage, auch während einer Aktion', () => {
  const laufend = { id: 1, titel: 'Sommer-Sale', prozent: 40, giltBis: '2026-10-16' }

  expect(preisaktionAnzeigen({ onRequestOnly: true, preis: null }, laufend)).toBe(false)
  expect(preisaktionAnzeigen({ onRequestOnly: true, preis: 1990 }, laufend)).toBe(false)
  expect(preisaktionAnzeigen({ onRequestOnly: false, preis: null }, laufend)).toBe(false)
  expect(preisaktionAnzeigen({ onRequestOnly: false, preis: 1990 }, null)).toBe(false)
  expect(preisaktionAnzeigen({ onRequestOnly: false, preis: 1990 }, laufend)).toBe(true)
})
