import { expect, test } from '@playwright/test'

import { lieferantKennung, naechsterPosten, UEBERNOMMEN } from '../src/lib/inventarerfassung'

/**
 * Die schnelle Erfassung — zwei Regeln, die still kaputtgehen.
 *
 * Beide Fehler würden im Formular nicht auffallen: Ein Posten, der seine
 * Bezeichnung behält, sieht richtig aus, bis er zum zweiten Mal im Lager
 * steht. Ein Lieferant, dessen Kennung zu `NaN` wird, steht bis zum nächsten
 * Laden weiter mit Namen da. Deshalb wird hier geprüft und nicht geklickt.
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
    type: 'material',
    unit: 'Stück',
    location: 'Regal C, Fach 3',
    supplier: 7,
    quantity: 0,
  })
})

test('was den nächsten Posten zum Doppelgänger machen würde, ist weg', () => {
  const weiter = naechsterPosten(posten) as Record<string, unknown>

  // Bliebe die Bezeichnung stehen, entstünde derselbe Posten ein zweites Mal.
  expect(weiter.name).toBeUndefined()
  // Bliebe die Menge stehen, hätte das Lager Bestand, den niemand gezählt hat.
  expect(weiter.quantity).toBe(0)

  for (const feld of ['minQuantity', 'orderQuantity', 'supplierRef', 'unitValue', 'purchaseDate', 'purchaseValue', 'notes']) {
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

test('die übernommenen Felder sind genau die vier', () => {
  // Steht hier eines mehr, ist beim Erfassen etwas mitgewandert, das je Posten
  // gehört — die Prüfung soll dazu zwingen, das bewusst zu entscheiden.
  expect([...UEBERNOMMEN]).toEqual(['type', 'unit', 'location', 'supplier'])
})
