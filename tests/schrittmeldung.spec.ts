import { expect, test } from '@playwright/test'

import type { Arbeitsschritt } from '../src/lib/arbeitsplan'
import { faelligeSchritte } from '../src/lib/auftragsmeldung'

/**
 * Zwischenstände aus dem Ablauf.
 *
 * Gemeldet wurde bisher an drei Ständen des Auftrags — in Fertigung, fertig,
 * geliefert. Bei einem Stück, das Wochen unterwegs ist, liegen dazwischen
 * Wochen Stille: Das Teil geht zum Laserer, kommt zurück, geht zur Kanterei.
 * Wer nichts hört, ruft an.
 */

const schritt = (teil: Partial<Arbeitsschritt> = {}): Arbeitsschritt => ({
  was: 'Bestellen - Kanten',
  art: 'fremd',
  stand: 'erledigt',
  kundeMelden: true,
  kundentext: 'Die Kantteile sind fertig.',
  ...teil,
})

test('ein gerade fertig gewordener Schritt meldet', () => {
  const jetzt = [schritt()]
  const vorher = [schritt({ stand: 'laeuft' })]
  expect(faelligeSchritte(jetzt, vorher)).toHaveLength(1)
})

test('ein Schritt, der schon erledigt war, meldet nicht noch einmal', () => {
  // Sonst ginge bei jedem Speichern des Auftrags dieselbe Mail hinaus.
  expect(faelligeSchritte([schritt()], [schritt()])).toHaveLength(0)
})

test('ohne Häkchen bleibt es still', () => {
  const jetzt = [schritt({ kundeMelden: false })]
  const vorher = [schritt({ kundeMelden: false, stand: 'laeuft' })]
  expect(faelligeSchritte(jetzt, vorher)).toHaveLength(0)
})

test('ohne Kundentext bleibt es still', () => {
  /*
   * Lieber Schweigen als eine Mail, die nichts sagt — und der Schrittname
   * taugt ausdrücklich nicht als Ersatz: „Bestellen - Kanten" verriete den
   * Zulieferer, daneben stehen die Einkaufskosten.
   */
  for (const text of [undefined, '', '   ']) {
    const jetzt = [schritt({ kundentext: text })]
    const vorher = [schritt({ kundentext: text, stand: 'laeuft' })]
    expect(faelligeSchritte(jetzt, vorher), `Text: ${JSON.stringify(text)}`).toHaveLength(0)
  }
})

test('was schon gemeldet ist, meldet nicht wieder', () => {
  const jetzt = [schritt({ gemeldetAm: '2026-09-11T08:00:00.000Z' })]
  const vorher = [schritt({ gemeldetAm: '2026-09-11T08:00:00.000Z', stand: 'laeuft' })]
  expect(faelligeSchritte(jetzt, vorher)).toHaveLength(0)
})

test('aus mehreren Schritten kommt nur der neue', () => {
  const jetzt = [
    schritt({ was: 'PC - Konstruktion', kundentext: 'Die Konstruktion steht.' }),
    schritt({ was: 'Bestellen - Lasern', kundentext: 'Die Zuschnitte sind da.' }),
    schritt({ was: 'Logistik - Abholen', stand: 'offen' }),
  ]
  const vorher = [
    schritt({ was: 'PC - Konstruktion', kundentext: 'Die Konstruktion steht.' }),
    schritt({ was: 'Bestellen - Lasern', kundentext: 'Die Zuschnitte sind da.', stand: 'laeuft' }),
    schritt({ was: 'Logistik - Abholen', stand: 'offen' }),
  ]
  const faellig = faelligeSchritte(jetzt, vorher)
  expect(faellig).toHaveLength(1)
  expect(faellig[0].i, 'der zweite, nicht der erste').toBe(1)
})

test('ein frisch angelegter Auftrag meldet nichts Nachträgliches', () => {
  // `vorher` fehlt beim Anlegen. Ein Schritt, der gleich als erledigt
  // angelegt wird, gilt trotzdem als neu — das ist richtig: Wer ihn so
  // anlegt, hat ihn gerade gemacht.
  expect(faelligeSchritte([schritt()], undefined)).toHaveLength(1)
  expect(faelligeSchritte([schritt({ stand: 'offen' })], undefined)).toHaveLength(0)
})
