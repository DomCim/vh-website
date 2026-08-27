import { expect, test } from '@playwright/test'

import { auftragsPositionen } from '../src/lib/material'

/**
 * Die Farbe reist aus der Bestellung als eigenes Feld in den Auftrag.
 *
 * Der Anlass sind die Laufmarken: Der Beschichter bekommt beim Scannen nur
 * Felder gezeigt, nie den verhandelten Beschreibungstext. Eine Farbe, die nur
 * im Satz „Herz · Mittel · Rubinrot" steckt, sähe er nicht — deshalb steht sie
 * zusätzlich in `farbe`, und der Text bleibt trotzdem vollständig, weil er das
 * Papier trägt.
 *
 * Reine Funktion, kein Server.
 */

test('Farbe steht als eigenes Feld UND im Beschreibungstext', () => {
  const [pos] = auftragsPositionen([
    {
      titleSnapshot: 'Objekt - Coeur',
      variantTitle: 'Mittel (90 cm)',
      color: 'Rubinrot (RAL 3003)',
      quantity: 1,
      unitPrice: 1490,
      product: 6,
    },
  ])
  expect(pos.farbe).toBe('Rubinrot (RAL 3003)')
  expect(pos.description).toBe('Objekt - Coeur · Mittel (90 cm) · Rubinrot (RAL 3003)')
  expect(pos.product).toBe(6)
  expect(pos.price).toBe(1490)
})

test('ohne Farbe bleibt das Feld leer statt einer leeren Zeichenkette', () => {
  const [pos] = auftragsPositionen([
    { titleSnapshot: 'Brasero', quantity: 1, unitPrice: 890 },
  ])
  expect(pos.farbe).toBeUndefined()
  expect(pos.description).toBe('Brasero')
})

test('der Artikelbezug kommt aus Kennung wie aus geladenem Objekt', () => {
  // Payload liefert je nach Ladetiefe die Zahl oder das Objekt — beide Formen
  // kommen hier an, und der Auftrag soll in beiden Fällen aufs Bild zeigen
  const beide = auftragsPositionen([
    { titleSnapshot: 'A', product: 14 },
    { titleSnapshot: 'B', product: { id: 14 } },
    { titleSnapshot: 'C' },
  ])
  expect(beide.map((p) => p.product)).toEqual([14, 14, null])
})
