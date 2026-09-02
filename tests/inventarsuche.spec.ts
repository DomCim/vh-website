import { expect, test } from '@playwright/test'

import { postenTrifft, suchwoerter } from '../src/lib/inventarsuche'

/**
 * Die Suche über dem Inventar. Fällt sie still aus — findet etwa nur noch die
 * Bezeichnung —, merkt das niemand am Klicken, sondern erst, wenn jemand am
 * Lager „Regal C" tippt und die Liste leer bleibt.
 */

const schraube = {
  name: 'Sechskantschraube M8 × 40',
  type: 'material',
  unit: 'Stück',
  location: 'Regal C, Fach 3',
  supplierRef: 'A-4711',
  notes: 'für die Braseros',
  quantity: 20,
  minQuantity: 50,
}

test('jedes Wort muss irgendwo treffen, die Reihenfolge ist egal', () => {
  expect(postenTrifft(schraube, suchwoerter('m8 regal'))).toBe(true)
  expect(postenTrifft(schraube, suchwoerter('Regal C Schraube'))).toBe(true)
  // Ein Wort, das nirgends steht, reicht zum Aussortieren.
  expect(postenTrifft(schraube, suchwoerter('M8 Keller'))).toBe(false)
})

test('gefunden wird auch, was nicht im Namen steht', () => {
  expect(postenTrifft(schraube, suchwoerter('A-4711'))).toBe(true)
  expect(postenTrifft(schraube, suchwoerter('brasero'))).toBe(true)
  expect(postenTrifft(schraube, suchwoerter('würth'), { lieferant: 'Würth' })).toBe(true)
  // Die Art unter ihrem angezeigten Wort, nicht unter dem Schlüssel.
  expect(postenTrifft(schraube, suchwoerter('material'), { art: 'Material' })).toBe(true)
})

test('„knapp" findet, was unter dem Mindestbestand liegt', () => {
  expect(postenTrifft(schraube, suchwoerter('knapp'))).toBe(true)
  expect(postenTrifft({ ...schraube, quantity: 80 }, suchwoerter('knapp'))).toBe(false)
  // Ohne Mindestbestand ist nichts knapp.
  expect(postenTrifft({ ...schraube, minQuantity: null }, suchwoerter('knapp'))).toBe(false)
})

test('eine leere Suche lässt alles durch', () => {
  expect(suchwoerter('   ')).toEqual([])
  expect(postenTrifft(schraube, [])).toBe(true)
  expect(postenTrifft({ name: null }, suchwoerter(''))).toBe(true)
})
