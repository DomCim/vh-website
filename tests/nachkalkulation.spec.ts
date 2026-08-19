import { expect, test } from '@playwright/test'

import {
  artikelName,
  bilanz,
  nachkalkulation,
  type KalkAuftrag,
} from '../src/lib/nachkalkulation'

/**
 * Aus dieser Auswertung entstehen Preise. Rechnet sie falsch, wird ein Stück
 * jahrelang zu billig verkauft — und das fällt erst auf, wenn das Jahr vorbei
 * ist.
 */

const LAGER = [
  { id: 1, name: 'Cortenblech 3mm', unitValue: 45 },
  { id: 2, name: 'Grundierung', unitValue: 12 },
]

const AUFTRAG: KalkAuftrag = {
  id: 1,
  jobNumber: 'AU-2026-0001',
  title: 'Pflanzkübel für Stadt Naila',
  status: 'geliefert',
  dueDate: '2026-05-20',
  plannedMinutes: 600,
  timeEntries: [{ minutes: 480 }, { minutes: 300 }],
  material: [
    { item: 1, quantity: 4 },
    { item: 2, quantity: 1 },
  ],
  positions: [{ description: 'Pflanzkübel Corten · 80 × 40 cm', quantity: 1, price: 1490 }],
}

test.describe('Die Bilanz eines Auftrags', () => {
  test('Zeit, Material und was übrig bleibt', () => {
    const b = bilanz(AUFTRAG, 65, LAGER)
    expect(b.zeitGeplant).toBe(10)
    expect(b.zeitIst).toBe(13)
    expect(b.zeitAbweichung).toBe(3)
    expect(b.lohnkosten).toBe(845) // 13 h × 65 €
    expect(b.materialkosten).toBe(192) // 4 × 45 + 1 × 12
    expect(b.einsatz).toBe(1037)
    expect(b.deckung).toBe(453)
    expect(b.marge).toBe(30)
  })

  /*
   * Ein Auftrag ohne Preis ist kein Fehler — Nacharbeit auf Kulanz etwa. Er
   * darf nur keine Marge von minus unendlich erzeugen und damit jede Summe
   * darüber unbrauchbar machen.
   */
  test('ohne Wert gibt es keine Marge, aber sehr wohl Kosten', () => {
    const b = bilanz({ ...AUFTRAG, positions: [] }, 65, LAGER)
    expect(b.wert).toBe(0)
    expect(b.marge).toBeNull()
    expect(b.deckung).toBe(-1037)
  })

  test('fehlende Angaben zählen als null statt als NaN', () => {
    const b = bilanz({ id: 9, status: 'fertig' }, 65, LAGER)
    expect(b.zeitIst).toBe(0)
    expect(b.materialkosten).toBe(0)
    expect(b.einsatz).toBe(0)
  })
})

test.describe('Der Artikelname aus der Position', () => {
  test('die Variante gehört zum selben Artikel', () => {
    expect(artikelName('Pflanzkübel Corten · 80 × 40 cm · anthrazit')).toBe('Pflanzkübel Corten')
    expect(artikelName('Regal')).toBe('Regal')
    expect(artikelName(null)).toBe('')
  })
})

test.describe('Die Auswertung über alle Aufträge', () => {
  const AUFTRAEGE: KalkAuftrag[] = [
    AUFTRAG,
    {
      ...AUFTRAG,
      id: 2,
      jobNumber: 'AU-2026-0002',
      dueDate: '2026-06-10',
      plannedMinutes: 600,
      timeEntries: [{ minutes: 900 }],
    },
    // Läuft noch — gehört nicht in eine Nachkalkulation
    { ...AUFTRAG, id: 3, jobNumber: 'AU-2026-0003', status: 'inFertigung' },
    // Anderes Jahr
    { ...AUFTRAG, id: 4, jobNumber: 'AU-2025-0009', dueDate: '2025-11-02' },
  ]

  test('nimmt nur abgeschlossene Aufträge des gewählten Jahres', () => {
    const a = nachkalkulation(AUFTRAEGE, { stundensatz: 65, lager: LAGER, jahr: 2026 })
    expect(a.summe.anzahl).toBe(2)
    expect(a.auftraege.map((b) => b.nummer)).toEqual(['AU-2026-0002', 'AU-2026-0001'])
  })

  /*
   * Das ist der Satz, um den es geht: Derselbe Artikel, zweimal deutlich über
   * der Schätzung. Einmal ist Pech, zweimal ist die Kalkulation.
   */
  test('fasst nach Artikel zusammen und zeigt die Abweichung', () => {
    const a = nachkalkulation(AUFTRAEGE, { stundensatz: 65, lager: LAGER, jahr: 2026 })
    expect(a.artikel).toHaveLength(1)
    expect(a.artikel[0].name).toBe('Pflanzkübel Corten')
    expect(a.artikel[0].auftraege).toBe(2)
    expect(a.artikel[0].zeitGeplant).toBe(20)
    expect(a.artikel[0].zeitIst).toBe(28) // 13 + 15
    expect(a.artikel[0].zeitAbweichung).toBe(8)
  })

  /*
   * Ein Auftrag ohne erfasste Zeit sähe wie ein besonders schneller aus und
   * schönte jede Auswertung. Er zählt beim Zeitvergleich nicht mit — und wird
   * gezählt, damit die Seite sagen kann, wie viel fehlt.
   */
  test('Aufträge ohne Zeit oder ohne Schätzung werden ausgewiesen', () => {
    const a = nachkalkulation(
      [
        AUFTRAG,
        { ...AUFTRAG, id: 5, jobNumber: 'X-1', timeEntries: [] },
        { ...AUFTRAG, id: 6, jobNumber: 'X-2', plannedMinutes: null },
      ],
      { stundensatz: 65, lager: LAGER, jahr: 2026 },
    )
    expect(a.summe.ohneZeit).toBe(1)
    expect(a.summe.ohneSchaetzung).toBe(1)
    // Nur der eine vollständige Auftrag geht in den Zeitvergleich ein
    expect(a.summe.zeitGeplant).toBe(10)
    expect(a.summe.zeitIst).toBe(13)
  })

  test('verteilt die Zeit eines Auftrags nach dem Wert seiner Positionen', () => {
    const gemischt: KalkAuftrag = {
      ...AUFTRAG,
      id: 7,
      positions: [
        { description: 'Tor', quantity: 1, price: 3000 },
        { description: 'Briefkasten', quantity: 1, price: 1000 },
      ],
      plannedMinutes: 1200,
      timeEntries: [{ minutes: 1200 }],
    }
    const a = nachkalkulation([gemischt], { stundensatz: 65, lager: LAGER, jahr: 2026 })
    const tor = a.artikel.find((z) => z.name === 'Tor')!
    const kasten = a.artikel.find((z) => z.name === 'Briefkasten')!
    expect(tor.zeitIst).toBe(15)
    expect(kasten.zeitIst).toBe(5)
  })
})
