import { expect, test } from '@playwright/test'

import {
  type Arbeitsschritt,
  mindestDauerTage,
  naechsterSchritt,
  planStand,
} from '../src/lib/arbeitsplan'

/**
 * Der Ablauf eines Stücks.
 *
 * Geprüft wird das, was die Werkstatt daraus abliest — und was ohne Test
 * still falsch wäre: welcher Schritt gerade dran ist, und wie lange das Ganze
 * mindestens dauert. Die zweite Zahl ist die gefährlichere: Sie geht in eine
 * Terminzusage, und wer sie zu klein rechnet, sagt einen Tag zu, den es nicht
 * gibt.
 */

const schritt = (s: Partial<Arbeitsschritt>): Arbeitsschritt => ({
  was: 'Schritt',
  art: 'eigen',
  stand: 'offen',
  ...s,
})

test('der nächste Schritt ist der erste offene', () => {
  const plan = [
    schritt({ was: 'Zuschnitt', stand: 'erledigt' }),
    schritt({ was: 'Schweißen', stand: 'offen' }),
    schritt({ was: 'Verzinken', stand: 'offen' }),
  ]
  expect(naechsterSchritt(plan)?.schritt.was).toBe('Schweißen')
})

test('was läuft, schlägt was offen ist', () => {
  /*
   * Der übersprungene Schritt ist der Alltagsfall: Das Blech liegt schon beim
   * Verzinker, während der Zuschnitt des zweiten Teils noch aussteht. Auf die
   * Frage „was passiert damit gerade?" ist „Verzinken" die richtige Antwort —
   * nicht der offene Schritt davor, an dem niemand arbeitet.
   */
  const plan = [
    schritt({ was: 'Zuschnitt', stand: 'offen' }),
    schritt({ was: 'Verzinken', stand: 'laeuft' }),
  ]
  expect(naechsterSchritt(plan)?.schritt.was).toBe('Verzinken')
})

test('ist alles erledigt, ist nichts mehr dran', () => {
  const plan = [schritt({ stand: 'erledigt' }), schritt({ stand: 'erledigt' })]
  expect(naechsterSchritt(plan)).toBeNull()
  expect(planStand(plan)).toEqual({ erledigt: 2, gesamt: 2, fertig: true })
})

test('ein leerer Ablauf gilt nicht als fertig', () => {
  // Sonst stünde an jedem Auftrag ohne Ablauf „alle Schritte erledigt"
  expect(planStand([]).fertig).toBe(false)
  expect(planStand(null).fertig).toBe(false)
  expect(naechsterSchritt(undefined)).toBeNull()
})

test('Wartezeit beim Dienstleister zählt zum Termin', () => {
  /*
   * Der Kern der Sache. Zwanzig Stunden eigene Arbeit sind bei acht Stunden
   * am Tag drei Tage. Fünf Tage Verzinken und drei Tage Beschichten kommen
   * obendrauf, weil ein Stück nicht gleichzeitig in der Werkstatt und außer
   * Haus liegen kann. Wer nur die Arbeitszeit rechnet, sagt drei Tage zu und
   * braucht elf.
   */
  const plan = [
    schritt({ was: 'Schweißen', art: 'eigen', minuten: 20 * 60 }),
    schritt({ was: 'Verzinken', art: 'fremd', vorlaufTage: 5 }),
    schritt({ was: 'Beschichten', art: 'fremd', vorlaufTage: 3 }),
  ]
  expect(mindestDauerTage(plan)).toBe(11)
})

test('reine Eigenarbeit wird aufgerundet, nicht abgeschnitten', () => {
  // Neun Stunden sind zwei Tage, nicht einer — ein angefangener Tag ist ein Tag
  expect(mindestDauerTage([schritt({ minuten: 9 * 60 })])).toBe(2)
  expect(mindestDauerTage([schritt({ minuten: 8 * 60 })])).toBe(1)
})

test('eine Fremdleistung ohne Vorlauf verlängert nichts', () => {
  // „Abholen beim Nachbarn" ist eine Fremdleistung ohne Wartezeit
  const plan = [schritt({ art: 'fremd' }), schritt({ art: 'eigen', minuten: 60 })]
  expect(mindestDauerTage(plan)).toBe(1)
})

test('Minuten einer Fremdleistung zählen nicht als eigene Arbeit', () => {
  /*
   * Eine Fremdleistung, an der versehentlich Minuten stehen, darf die eigene
   * Auslastung nicht erhöhen — die Zeit verbringt jemand anders.
   */
  const plan = [schritt({ art: 'fremd', minuten: 40 * 60, vorlaufTage: 2 })]
  expect(mindestDauerTage(plan)).toBe(2)
})
