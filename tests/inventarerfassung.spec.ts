import { expect, test } from '@playwright/test'

import {
  doppelgaenger,
  gleicheBezeichnung,
  lieferantKennung,
  naechsterPosten,
  UEBERNOMMEN,
} from '../src/lib/inventarerfassung'

/**
 * Die schnelle Erfassung — Regeln, die still kaputtgehen.
 *
 * Keiner dieser Fehler würde im Formular auffallen: Ein Posten, der mit
 * stehengebliebener Bezeichnung durch die Doppelgänger-Prüfung rutscht, sieht
 * richtig aus, bis er zum zweiten Mal im Lager steht. Ein Lieferant, dessen
 * Kennung zu `NaN` wird, steht bis zum nächsten Laden weiter mit Namen da.
 * Deshalb wird hier geprüft und nicht geklickt.
 */

const posten = {
  name: 'Sechskantschraube M8 × 40',
  type: 'material',
  quantity: 250,
  unit: 'Stück',
  minQuantity: 50,
  orderQuantity: 500,
  supplierRef: 'A-4711',
  unitValue: 0.12,
  location: 'Regal C, Fach 3',
  supplier: 7,
  purchaseDate: '2026-03-01',
  purchaseValue: 30,
  notes: 'für die Braseros',
}

test('der nächste Posten erbt nur, was sich in einer Kiste nicht ändert', () => {
  const weiter = naechsterPosten(posten)

  expect(weiter).toEqual({
    name: 'Sechskantschraube M8 × 40',
    type: 'material',
    unit: 'Stück',
    location: 'Regal C, Fach 3',
    supplier: 7,
    minQuantity: 50,
    orderQuantity: 500,
    quantity: 0,
  })
})

test('was je Posten gehört, ist beim nächsten weg', () => {
  const weiter = naechsterPosten(posten) as Record<string, unknown>

  // Bliebe die Menge stehen, hätte das Lager Bestand, den niemand gezählt hat.
  expect(weiter.quantity).toBe(0)

  for (const feld of ['supplierRef', 'unitValue', 'purchaseDate', 'purchaseValue', 'notes']) {
    expect(weiter[feld], `${feld} darf nicht mitwandern`).toBeUndefined()
  }
})

/**
 * Aufgezählt statt geleert: Ein Feld, das nächsten Monat dazukommt, ist damit
 * von selbst leer. Diese Prüfung fällt um, wenn jemand die Richtung dreht.
 */
test('ein unbekanntes Feld wandert nicht mit', () => {
  const weiter = naechsterPosten({ ...posten, seriennummer: 'XY-9' }) as Record<string, unknown>
  expect(weiter.seriennummer).toBeUndefined()
})

test('eine Kennung, die es beim Server noch nicht gibt, bleibt erhalten', () => {
  // Ohne Netz vergibt die Warteschlange „neu:…" und schreibt es später um.
  // `Number()` machte daraus NaN — und der Lieferant wäre beim Abschicken weg.
  expect(lieferantKennung('neu:a1b2c3d4')).toBe('neu:a1b2c3d4')
  expect(lieferantKennung('7')).toBe(7)
  expect(lieferantKennung('')).toBe('')
})

test('die übernommenen Felder sind genau die sieben', () => {
  // Steht hier eines mehr, ist beim Erfassen etwas mitgewandert, das je Posten
  // gehört — die Prüfung soll dazu zwingen, das bewusst zu entscheiden.
  expect([...UEBERNOMMEN]).toEqual([
    'name',
    'type',
    'unit',
    'location',
    'supplier',
    'minQuantity',
    'orderQuantity',
  ])
})

/**
 * Die Bezeichnung bleibt nach „& nächster" stehen — das geht nur, weil diese
 * Prüfung den zweiten Posten gleichen Namens abfängt. Fällt sie um, ist der
 * Doppelgänger wieder da, und zwar ohne dass jemand etwas merkt.
 */
test('die stehengebliebene Bezeichnung findet ihren eigenen Posten wieder', () => {
  const lager = [
    { id: 1, name: 'Sechskantschraube M8 × 40' },
    { id: 'neu:abc123', name: 'Sechskantschraube M8 × 50' },
  ]
  const weiter = naechsterPosten(posten)

  // Genau der Fall nach dem Knopfdruck: Bezeichnung unverändert, Posten da.
  expect(doppelgaenger(weiter.name, lager)?.id).toBe(1)
  // Auch, was in dieser Runde ohne Netz angelegt wurde und noch wartet.
  expect(doppelgaenger('Sechskantschraube M8 × 50', lager)?.id).toBe('neu:abc123')
  // Eine geänderte Größe ist ein neuer Posten.
  expect(doppelgaenger('Sechskantschraube M8 × 60', lager)).toBeUndefined()
})

test('Groß/Klein und Leerzeichen machen keinen neuen Posten', () => {
  expect(gleicheBezeichnung('schraube  m8 ', 'Schraube M8')).toBe(true)
  // Zwei leere Bezeichnungen sind kein Doppelgänger — leer wird ohnehin abgewiesen.
  expect(gleicheBezeichnung('', '')).toBe(false)
  expect(gleicheBezeichnung('  ', undefined)).toBe(false)
  // Absichtlich nicht klüger: „x" und „×" dürfen zwei Posten sein.
  expect(gleicheBezeichnung('M8 x 40', 'M8 × 40')).toBe(false)
})

test('beim Bearbeiten zählt der eigene Posten nicht als Doppelgänger', () => {
  const lager = [
    { id: 1, name: 'Hammer' },
    { id: 2, name: 'Zange' },
  ]
  expect(doppelgaenger('Hammer', lager, 1)).toBeUndefined()
  expect(doppelgaenger('Hammer', lager, '1')).toBeUndefined()
  // Umbenennen auf einen Namen, den ein anderer trägt, bleibt gesperrt.
  expect(doppelgaenger('Zange', lager, 1)?.id).toBe(2)
})
