import { expect, test } from '@playwright/test'

import { bestandsPruefung } from '../src/lib/buero/material'
import { bilanz, materialkosten } from '../src/lib/nachkalkulation'

/**
 * Vom Auftraggeber beigestelltes Material.
 *
 * Bei Lohnfertigung schickt der Kunde sein Blech; wir schneiden und kanten.
 * Das Zeug war nie im eigenen Lager. Drei Dinge müssen deshalb stimmen, und
 * jedes davon fälscht sonst eine Zahl, auf die sich jemand verlässt:
 *
 * 1. Es kostet **nichts** — sonst sieht jeder Lohnauftrag nach einem
 *    Verlustgeschäft aus, und ausgerechnet die Aufträge ohne Einkauf wären
 *    auf dem Papier die schlechtesten.
 * 2. Es fehlt **nie** — sonst meldet die Nachbestellung Bedarf, den es nicht
 *    gibt.
 * 3. Der Rest der Rechnung bleibt unberührt: Lohn und Auftragswert ändern
 *    sich davon nicht.
 */

const LAGER = [
  { id: 1, name: 'Blech 3 mm', unitValue: 40 },
  { id: 2, name: 'Corten 2 mm', unitValue: 100 },
]

test('beigestelltes Material kostet nichts', () => {
  const auftrag = {
    id: 1,
    material: [
      { item: 1, quantity: 2 },
      { item: 2, quantity: 3, beigestellt: true },
    ],
  }
  // Nur die eigenen zwei Bleche: 2 × 40 €. Die drei beigestellten zählen null.
  expect(materialkosten(auftrag, LAGER)).toBe(80)

  const ohneKennzeichen = { id: 1, material: [{ item: 2, quantity: 3 }] }
  expect(materialkosten(ohneKennzeichen, LAGER)).toBe(300)
})

test('beigestelltes Material fehlt nie', () => {
  const posten = [
    { id: 1, name: 'Blech 3 mm', unit: 'Tafel', quantity: 0 },
    { id: 2, name: 'Corten 2 mm', unit: 'Tafel', quantity: 0 },
  ]
  const bedarf = bestandsPruefung(
    [
      { item: 1, quantity: 2 },
      { item: 2, quantity: 3, beigestellt: true },
    ],
    posten,
  )
  // Nur das eigene Blech fehlt — das Corten bringt der Auftraggeber mit
  expect(bedarf).toHaveLength(1)
  expect(bedarf[0]!.itemId).toBe(1)
  expect(bedarf[0]!.fehlt).toBe(2)
})

test('an Lohn und Auftragswert ändert das Kennzeichen nichts', () => {
  const auftrag = {
    id: 1,
    plannedMinutes: 60,
    timeEntries: [{ minutes: 120 }],
    positions: [{ description: 'Zuschnitt', quantity: 1, price: 500 }],
    material: [{ item: 2, quantity: 3, beigestellt: true }],
  }
  const b = bilanz(auftrag, 60, LAGER)
  expect(b.wert).toBe(500)
  expect(b.lohnkosten).toBe(120)
  expect(b.materialkosten).toBe(0)
  // Ohne Materialkosten bleibt die volle Deckung stehen
  expect(b.deckung).toBe(380)
})
