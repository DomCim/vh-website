import { expect, test } from '@playwright/test'

import {
  belieferteLaender,
  EURO_LAENDER,
  landName,
  LAENDER,
  STANDARD_ZONEN,
  versandJeStueck,
  zoneFuer,
  type Zone,
} from '../src/lib/versand'

/**
 * Versandzonen — wohin geliefert wird und was der Weg dorthin kostet.
 *
 * Der Anlass: Der Versand war ein fester Betrag je Stück, ohne Blick auf die
 * Anschrift. Eine Speditionssendung in die Schweiz kostet ein Vielfaches
 * einer Lieferung innerhalb Frankreichs — bezahlt wurde überall dasselbe.
 * Gleichzeitig versprachen die strukturierten Daten Lieferung in die Schweiz,
 * der Produktfeed nannte sie nicht, und das Länderfeld in der Kasse war
 * freier Text.
 *
 * Geprüft wird deshalb vor allem, was **nicht** passieren darf: ein stiller
 * Inlandssatz für ein Land außerhalb der Zonen, und eine leere Einstellung,
 * die den Shop teurer macht oder anhält.
 */

const ZONEN: Zone[] = [
  { name: 'Frankreich und Nachbarn', laender: ['FR', 'DE', 'AT'], aufschlag: 0 },
  { name: 'Schweiz', laender: ['CH'], aufschlag: 80, hinweis: 'zzgl. Zoll' },
]

test('das Land bestimmt die Zone — und die den Aufschlag', () => {
  expect(versandJeStueck(150, zoneFuer(ZONEN, 'FR'))).toBe(150)
  expect(versandJeStueck(150, zoneFuer(ZONEN, 'CH'))).toBe(230)
})

test('ein Land außerhalb der Zonen hat keine — und bekommt keinen stillen Inlandssatz', () => {
  /*
   * Der eigentliche Punkt. `zoneFuer` gibt `null` zurück, und die Kasse
   * bricht daraufhin ab (siehe `priceCart`). Eine Null als „kein Aufschlag"
   * durchzulassen hieße, nach Neuseeland zum Satz für Straßburg zu liefern.
   */
  expect(zoneFuer(ZONEN, 'NZ')).toBeNull()
  expect(zoneFuer(ZONEN, '')).toBeNull()
  expect(zoneFuer(ZONEN, undefined)).toBeNull()
})

test('die Schreibweise des Landes ist gleichgültig', () => {
  expect(zoneFuer(ZONEN, 'ch')?.name).toBe('Schweiz')
  expect(zoneFuer(ZONEN, ' fr ')?.name).toBe('Frankreich und Nachbarn')
})

test('steht ein Land in zwei Zonen, gilt die obere', () => {
  const doppelt: Zone[] = [
    { name: 'oben', laender: ['DE'], aufschlag: 10 },
    { name: 'unten', laender: ['DE'], aufschlag: 99 },
  ]
  expect(zoneFuer(doppelt, 'DE')?.name).toBe('oben')
  // Und in der Länderliste steht es trotzdem nur einmal
  expect(belieferteLaender(doppelt)).toEqual(['DE'])
})

test('ohne Zone gilt der Betrag des Artikels', () => {
  // Der Fall vor der Anschrift: In der Kasse steht noch kein Land, und im
  // Produktfeed hat ohnehin jedes Land seine eigene Zeile.
  expect(versandJeStueck(150, null)).toBe(150)
  expect(versandJeStueck(null, null)).toBe(0)
})

test('der Standard entspricht dem Zustand vor den Zonen', () => {
  expect(belieferteLaender(STANDARD_ZONEN)).toEqual(['FR', 'DE', 'AT'])
  expect(versandJeStueck(150, zoneFuer(STANDARD_ZONEN, 'DE'))).toBe(150)
  // Die Schweiz war nie berechnet — sie ohne Aufschlag mitzunehmen hieße,
  // das Versprechen aus den strukturierten Daten zum Verlustgeschäft zu machen.
  expect(zoneFuer(STANDARD_ZONEN, 'CH')).toBeNull()
})

test('der Produktfeed lässt aus, was nicht in Euro bezahlt wird', () => {
  // Er rechnet ausschließlich in Euro; für die Schweiz bräuchte das Merchant
  // Center Franken. Geliefert wird trotzdem dorthin.
  expect(EURO_LAENDER.has('FR')).toBe(true)
  expect(EURO_LAENDER.has('CH')).toBe(false)
})

test('jedes wählbare Land hat einen Namen in allen drei Sprachen', () => {
  for (const l of LAENDER) {
    expect(landName(l.code, 'de')).toBeTruthy()
    expect(landName(l.code, 'fr')).toBeTruthy()
    expect(landName(l.code, 'en')).toBeTruthy()
  }
  // Ein unbekanntes Kürzel bleibt stehen, statt zu verschwinden
  expect(landName('XX')).toBe('XX')
})
