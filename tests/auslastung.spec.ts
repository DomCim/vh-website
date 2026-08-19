import { expect, test } from '@playwright/test'

import {
  auslastung,
  ersteFreieWoche,
  kalenderwoche,
  montag,
  wochenAnteile,
  type AuslastungsAuftrag,
} from '../src/lib/auslastung'

/**
 * Aus dieser Rechnung entsteht eine Terminzusage am Telefon. Wenn sie falsch
 * ist, steht sie trotzdem im Kalender der Kundschaft.
 */

test.describe('Kalenderwoche', () => {
  test('der Montag der Woche', () => {
    // Ein Mittwoch, ein Sonntag und ein Montag — alle drei gehören zum selben Montag
    expect(montag(new Date(2026, 8, 16)).toDateString()).toBe(new Date(2026, 8, 14).toDateString())
    expect(montag(new Date(2026, 8, 20)).toDateString()).toBe(new Date(2026, 8, 14).toDateString())
    expect(montag(new Date(2026, 8, 14)).toDateString()).toBe(new Date(2026, 8, 14).toDateString())
  })

  /*
   * Die Woche gehört dem Jahr, in dem ihr Donnerstag liegt. Deshalb liegt der
   * 31.12.2025 in der KW 1 von 2026. Wer stattdessen durchzählt, baut sich
   * einmal im Jahr eine Woche, die es nicht gibt — und verschiebt damit jede
   * Zusage über den Jahreswechsel.
   */
  test('rechnet nach ISO, nicht nach Gefühl', () => {
    expect(kalenderwoche(new Date(2026, 11, 31))).toEqual({ jahr: 2026, woche: 53 })
    expect(kalenderwoche(new Date(2025, 11, 31))).toEqual({ jahr: 2026, woche: 1 })
    expect(kalenderwoche(new Date(2026, 0, 1))).toEqual({ jahr: 2026, woche: 1 })
    expect(kalenderwoche(new Date(2026, 8, 16))).toEqual({ jahr: 2026, woche: 38 })
  })
})

test.describe('Wie sich ein Auftrag auf die Wochen verteilt', () => {
  const ab = new Date(2026, 8, 14) // Montag der KW 38

  test('ohne Startdatum zählt alles in die Woche des Termins', () => {
    const anteile = wochenAnteile(
      { id: 1, plannedMinutes: 600, dueDate: '2026-10-02', status: 'geplant' },
      ab,
    )
    expect(anteile).toEqual([{ schluessel: '2026-40', stunden: 10 }])
  })

  test('mit Startdatum gleichmäßig über die Wochen dazwischen', () => {
    const anteile = wochenAnteile(
      { id: 1, plannedMinutes: 1800, startDate: '2026-09-14', dueDate: '2026-10-02', status: 'geplant' },
      ab,
    )
    expect(anteile.map((a) => a.schluessel)).toEqual(['2026-38', '2026-39', '2026-40'])
    expect(anteile.every((a) => a.stunden === 10)).toBe(true)
  })

  /*
   * Ein überfälliger Auftrag ist nicht erledigt, sondern im Rückstand. Seine
   * Stunden gehören in die laufende Woche — sonst zeigt die Auslastung eine
   * leere Woche, in der in Wirklichkeit die Arbeit von letztem Monat liegt.
   */
  test('ein überfälliger Termin drückt auf die laufende Woche', () => {
    const anteile = wochenAnteile(
      { id: 1, plannedMinutes: 600, dueDate: '2026-08-01', status: 'inFertigung' },
      ab,
    )
    expect(anteile).toEqual([{ schluessel: '2026-38', stunden: 10 }])
  })

  test('ein Start in der Vergangenheit beginnt bei dieser Woche', () => {
    const anteile = wochenAnteile(
      { id: 1, plannedMinutes: 1200, startDate: '2026-07-01', dueDate: '2026-09-25', status: 'inFertigung' },
      ab,
    )
    expect(anteile.map((a) => a.schluessel)).toEqual(['2026-38', '2026-39'])
  })
})

test.describe('Die Wochenübersicht', () => {
  const ab = new Date(2026, 8, 14)

  const AUFTRAEGE: AuslastungsAuftrag[] = [
    { id: 1, jobNumber: 'A-1', title: 'Kübel', status: 'geplant', dueDate: '2026-09-18', plannedMinutes: 1200 },
    { id: 2, jobNumber: 'A-2', title: 'Regal', status: 'inFertigung', dueDate: '2026-09-18', plannedMinutes: 600 },
    { id: 3, jobNumber: 'A-3', title: 'Tor', status: 'fertig', dueDate: '2026-09-18', plannedMinutes: 3000 },
    { id: 4, jobNumber: 'A-4', title: 'ohne Zeit', status: 'geplant', dueDate: '2026-09-18' },
  ]

  test('zählt nur, was noch zu fertigen ist', () => {
    const wochen = auslastung(AUFTRAEGE, { stundenProWoche: 30, wochen: 4, ab })
    // 20 + 10 Stunden; „fertig" und der Auftrag ohne Zeitangabe zählen nicht
    expect(wochen[0].stunden).toBe(30)
    expect(wochen[0].auftraege.map((a) => a.nummer)).toEqual(['A-1', 'A-2'])
  })

  test('leere Wochen bleiben in der Liste', () => {
    const wochen = auslastung(AUFTRAEGE, { stundenProWoche: 30, wochen: 4, ab })
    expect(wochen).toHaveLength(4)
    expect(wochen[1].stunden).toBe(0)
    expect(wochen[1].frei).toBe(30)
  })

  test('voll heißt Anteil eins, überbucht mehr', () => {
    const wochen = auslastung(AUFTRAEGE, { stundenProWoche: 30, wochen: 2, ab })
    expect(wochen[0].anteil).toBe(1)
    expect(wochen[0].frei).toBe(0)

    const eng = auslastung(AUFTRAEGE, { stundenProWoche: 20, wochen: 2, ab })
    expect(eng[0].anteil).toBeGreaterThan(1)
    expect(eng[0].frei).toBe(0)
  })

  test('die erste Woche mit genug Platz ist die Antwort am Telefon', () => {
    const wochen = auslastung(AUFTRAEGE, { stundenProWoche: 30, wochen: 4, ab })
    expect(ersteFreieWoche(wochen, 25)?.woche).toBe(39)
    // Mehr als eine Woche fasst, gibt es nirgends — dann eben kein Termin
    expect(ersteFreieWoche(wochen, 40)).toBeNull()
  })
})
