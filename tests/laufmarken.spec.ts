import { expect, test } from '@playwright/test'

import { draussenUeberfaellig } from '../src/lib/arbeitsplan'
import {
  eigenerSchrittIndex,
  markenSitzung,
  markenSitzungLesen,
  sichtFuerDienstleister,
} from '../src/lib/laufmarken'

/**
 * Was der Dienstleister beim Scannen sieht — und vor allem: was nie.
 *
 * Die Sicht wird Feld für Feld aufgebaut, nicht gefiltert. Dieser Test hält
 * das am fertigen JSON fest: Ein Auftrag voller Preise, Notizen und
 * Kundendaten geht hinein, und keiner der verbotenen Werte darf im Ergebnis
 * auftauchen. Fällt der Test um, gibt die Scan-API Betriebsgeheimnisse an
 * den Beschichter heraus.
 *
 * Reine Funktionen, kein Server.
 */

/** Ein Auftrag, wie er schlimmer nicht befüllt sein könnte. */
const AUFTRAG = {
  id: 42,
  jobNumber: 'AU-2026-0099',
  title: 'Sonderanfertigung Familie Wertvoll',
  customerName: 'Familie Wertvoll',
  kundeEmail: 'wertvoll@example.test',
  notes: 'Kunde zahlt bar, Rabatt mündlich zugesagt',
  dueDate: '2026-09-15T00:00:00.000Z',
  plannedMinutes: 900,
  timeEntries: [{ day: '2026-08-20', minutes: 240, note: 'Zuschnitt' }],
  zahlplan: { anzahlungProzent: 30, zwischenProzent: 20 },
  positions: [
    {
      description: 'Tor 300 × 180, Rubinrot',
      quantity: 1,
      price: 4890,
      farbe: 'Rubinrot (RAL 3003)',
      product: 14,
    },
  ],
  material: [{ item: 3, quantity: 12 }],
  arbeitsplan: [
    { was: 'Zuschnitt', art: 'eigen' as const, minuten: 120, stand: 'erledigt' as const },
    {
      was: 'Verzinken',
      art: 'fremd' as const,
      dienstleister: 7,
      kosten: 260,
      vorlaufTage: 5,
      stand: 'laeuft' as const,
      notiz: 'Meier drückt beim Preis ein Auge zu',
    },
    {
      was: 'Beschichten',
      art: 'fremd' as const,
      dienstleister: 9,
      kosten: 340,
      vorlaufTage: 7,
      stand: 'offen' as const,
    },
  ],
}

test.describe('Die Sicht des Dienstleisters', () => {
  test('zeigt genau seinen Schritt, Termin, Positionen und Farbe', () => {
    const sicht = sichtFuerDienstleister(AUFTRAG, 7)
    expect(sicht).not.toBeNull()
    expect(sicht!.schritt.was).toBe('Verzinken')
    expect(sicht!.wunschtermin).toBe('2026-09-15')
    expect(sicht!.positionen).toHaveLength(1)
    expect(sicht!.positionen[0].beschreibung).toBe('Tor 300 × 180, Rubinrot')
    expect(sicht!.positionen[0].farbe).toBe('Rubinrot (RAL 3003)')
    expect(sicht!.positionen[0].menge).toBe(1)
    expect(sicht!.positionen[0].artikel).toBe(14)
  })

  test('gibt keinen einzigen verbotenen Wert heraus', () => {
    const sicht = sichtFuerDienstleister(AUFTRAG, 7)
    const json = JSON.stringify(sicht)
    /*
     * Wörtlich am JSON, nicht an einzelnen Feldern: Auch ein Feld, das
     * jemand später „nur durchreicht", fliegt hier auf.
     */
    for (const verboten of [
      '4890', // Preis der Position
      '260', // Kosten des eigenen Schritts
      '340', // Kosten des fremden Schritts
      '"30"', // Zahlplan
      'Wertvoll', // Kundenname (steckt auch im Titel)
      'wertvoll@example.test',
      'Rabatt', // Notizen
      'Auge zu', // Schritt-Notiz — „rein intern" ist die Zusage
      'AU-2026-0099', // Auftragsnummer
      'Beschichten', // fremder Schritt
      '"9"', // fremder Dienstleister
      'Zuschnitt', // eigene Arbeit geht ihn nichts an
      '900', // geplante Minuten
      'timeEntries',
      'material',
    ]) {
      expect(json, `„${verboten}" darf nicht in der Antwort stehen`).not.toContain(verboten)
    }
  })

  test('ein Betrieb ohne Schritt an diesem Auftrag sieht nichts', () => {
    expect(sichtFuerDienstleister(AUFTRAG, 999)).toBeNull()
  })

  test('bei zwei eigenen Schritten gilt der erste unerledigte', () => {
    const zweimal = {
      ...AUFTRAG,
      arbeitsplan: [
        { was: 'Vorverzinken', art: 'fremd' as const, dienstleister: 7, stand: 'erledigt' as const },
        { was: 'Endverzinken', art: 'fremd' as const, dienstleister: 7, stand: 'offen' as const },
      ],
    }
    expect(sichtFuerDienstleister(zweimal, 7)!.schritt.was).toBe('Endverzinken')
    expect(eigenerSchrittIndex(zweimal, 7)).toBe(1)
  })

  test('Sicht und Schreiben meinen denselben Schritt', () => {
    // Sonst bestätigt der Betrieb, was er nicht sieht
    const index = eigenerSchrittIndex(AUFTRAG, 7)
    expect(AUFTRAG.arbeitsplan[index].was).toBe(sichtFuerDienstleister(AUFTRAG, 7)!.schritt.was)
  })

  test('der geladene Dienstleister (Objekt statt Kennung) zählt genauso', () => {
    const geladen = {
      ...AUFTRAG,
      arbeitsplan: [{ was: 'Verzinken', art: 'fremd' as const, dienstleister: { id: 7 } }],
    }
    expect(sichtFuerDienstleister(geladen, 7)).not.toBeNull()
  })
})

test.describe('Die Sitzung des Betriebs', () => {
  test('trägt die Kennung hin und zurück', () => {
    const sitzung = markenSitzung(7)
    expect(markenSitzungLesen(sitzung.wert)).toBe(7)
  })

  test('eine verfälschte Signatur gilt nicht', () => {
    const sitzung = markenSitzung(7)
    const [nutzlast] = sitzung.wert.split('.')
    expect(markenSitzungLesen(`${nutzlast}.deadbeef`)).toBeNull()
  })

  test('eine umgeschriebene Nutzlast gilt nicht', () => {
    // Wer aus der 7 eine 9 macht, ist nicht plötzlich der Beschichter
    const sitzung = markenSitzung(7)
    const [, signatur] = sitzung.wert.split('.')
    const falsch = Buffer.from(`9|${Date.now() + 86400_000}`).toString('base64url')
    expect(markenSitzungLesen(`${falsch}.${signatur}`)).toBeNull()
  })

  test('ohne Cookie gibt es keine Sitzung', () => {
    expect(markenSitzungLesen(undefined)).toBeNull()
    expect(markenSitzungLesen('')).toBeNull()
    expect(markenSitzungLesen('kaputt')).toBeNull()
  })
})

test.describe('Überfällig beim Dienstleister', () => {
  const schritt = {
    art: 'fremd' as const,
    rausAm: '2026-08-01T08:00:00.000Z',
    vorlaufTage: 5,
  }

  test('nach Ablauf der Vorlauftage ist es überfällig', () => {
    expect(draussenUeberfaellig(schritt, new Date('2026-08-10'))).toBe(true)
  })

  test('innerhalb der Vorlauftage nicht', () => {
    expect(draussenUeberfaellig(schritt, new Date('2026-08-04'))).toBe(false)
  })

  test('zurück heißt zurück — egal wie spät', () => {
    expect(
      draussenUeberfaellig({ ...schritt, zurueckAm: '2026-08-12' }, new Date('2026-08-20')),
    ).toBe(false)
  })

  test('ohne Zusage keine Überfälligkeit', () => {
    // Eine Meldung ohne Maßstab wäre nur Lärm
    expect(
      draussenUeberfaellig({ ...schritt, vorlaufTage: null }, new Date('2027-01-01')),
    ).toBe(false)
  })

  test('was nie raus war, kann nicht überfällig sein', () => {
    expect(
      draussenUeberfaellig({ art: 'fremd', vorlaufTage: 5 }, new Date('2027-01-01')),
    ).toBe(false)
  })
})
