import { expect, test } from '@playwright/test'

import { neuesteZuerst, zuerstWenn } from '../src/lib/buero/sortierung'

/**
 * Die Reihenfolge der Rechnungsliste.
 *
 * Aufgefallen ist das Dominik auf dem Handy: 0008, 0009, 0010, dann 0007,
 * 0006, 0005. Innerhalb eines Tages einmal aufsteigend, einmal absteigend —
 * weil `issueDate` nur den Tag kennt und bei Gleichstand die Reihenfolge aus
 * dem Gerät stehen blieb.
 *
 * Geprüft wird hier der Vergleicher und nicht die Seite: Er ist der Ort, an
 * dem die Regel steht, und er lässt sich ohne Server und ohne Datenbank
 * festnageln.
 */

type Rechnung = { invoiceNumber?: string | null; createdAt?: string | null }

const nachNummer = neuesteZuerst<Rechnung>(
  (r) => zuerstWenn(!r.invoiceNumber),
  (r) => r.invoiceNumber ?? '',
  (r) => r.createdAt ?? '',
)

test.describe('Rechnungen sortieren', () => {
  test('die jüngste Nummer steht oben, auch über zehn hinaus', () => {
    const liste: Rechnung[] = [
      { invoiceNumber: 'RE-2026-0008' },
      { invoiceNumber: 'RE-2026-0010' },
      { invoiceNumber: 'RE-2026-0009' },
      { invoiceNumber: 'RE-2026-0007' },
    ]
    expect([...liste].sort(nachNummer).map((r) => r.invoiceNumber)).toEqual([
      'RE-2026-0010',
      'RE-2026-0009',
      'RE-2026-0008',
      'RE-2026-0007',
    ])
  })

  /*
   * Ein reiner Textvergleich sortierte „RE-2026-0010" unter „RE-2026-0009",
   * weil „1" kleiner ist als „9". Bei vierstelligen Nummern mit führenden
   * Nullen fällt das erst beim Jahreswechsel auf — dann aber bei jeder
   * Rechnung. `numeric: true` nimmt die Ziffernfolge als Zahl.
   */
  test('ein Jahreswechsel dreht nichts um', () => {
    const liste: Rechnung[] = [
      { invoiceNumber: 'RE-2025-0120' },
      { invoiceNumber: 'RE-2026-0002' },
      { invoiceNumber: 'RE-2025-0119' },
    ]
    expect([...liste].sort(nachNummer).map((r) => r.invoiceNumber)).toEqual([
      'RE-2026-0002',
      'RE-2025-0120',
      'RE-2025-0119',
    ])
  })

  test('Entwürfe stehen oben, untereinander die jüngsten zuerst', () => {
    const liste: Rechnung[] = [
      { invoiceNumber: 'RE-2026-0010' },
      { createdAt: '2026-09-11T08:00:00.000Z' },
      { invoiceNumber: 'RE-2026-0009' },
      { createdAt: '2026-09-11T19:00:00.000Z' },
    ]
    const sortiert = [...liste].sort(nachNummer)
    expect(sortiert[0].createdAt).toBe('2026-09-11T19:00:00.000Z')
    expect(sortiert[1].createdAt).toBe('2026-09-11T08:00:00.000Z')
    expect(sortiert[2].invoiceNumber).toBe('RE-2026-0010')
    expect(sortiert[3].invoiceNumber).toBe('RE-2026-0009')
  })

  /*
   * Der eigentliche Fehler in einer Zeile: Gleicher Tag, kein zweiter
   * Schlüssel — dann bleibt stehen, was der Abgleich gerade geliefert hat.
   */
  test('ein Tagesdatum allein ordnet innerhalb des Tages nichts', () => {
    type Beleg = { invoiceDate: string; createdAt: string }
    const liste: Beleg[] = [
      { invoiceDate: '2026-09-11', createdAt: '2026-09-11T09:00:00.000Z' },
      { invoiceDate: '2026-09-11', createdAt: '2026-09-11T17:00:00.000Z' },
      { invoiceDate: '2026-09-10', createdAt: '2026-09-10T08:00:00.000Z' },
    ]

    const nurTag = neuesteZuerst<Beleg>((b) => b.invoiceDate)
    expect(
      [...liste].sort(nurTag)[0].createdAt,
      'ohne zweiten Schlüssel entscheidet die Eingangsreihenfolge',
    ).toBe('2026-09-11T09:00:00.000Z')

    const mitZeit = neuesteZuerst<Beleg>(
      (b) => b.invoiceDate,
      (b) => b.createdAt,
    )
    expect([...liste].sort(mitZeit).map((b) => b.createdAt)).toEqual([
      '2026-09-11T17:00:00.000Z',
      '2026-09-11T09:00:00.000Z',
      '2026-09-10T08:00:00.000Z',
    ])
  })
})
