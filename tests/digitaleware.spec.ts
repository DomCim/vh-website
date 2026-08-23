import { expect, test } from '@playwright/test'

import {
  darfHerunterladen,
  downloadBis,
  downloadGueltig,
  downloadLink,
  downloadSignatur,
} from '../src/lib/digitaleware'

/**
 * Digitale Ware — die zwei Stellen, an denen ein Fehler teuer wäre.
 *
 * Eine Datei lässt sich nicht zurückholen. Wer sie zu früh bekommt, hat sie;
 * wer sie über einen fremden Link bekommt, hat sie auch. Beides prüfen wir
 * hier, denn beim Klicken fällt keines von beidem auf: Ein zu großzügiger
 * Link funktioniert ja.
 */

test.beforeEach(() => {
  process.env.PAYLOAD_SECRET = 'nur-fuer-die-pruefung'
})

test('geliefert wird erst ab bezahlt', () => {
  expect(darfHerunterladen('paid')).toBe(true)
  expect(darfHerunterladen('inProduction')).toBe(true)
  expect(darfHerunterladen('shipped')).toBe(true)

  // Offen heißt: noch kein Geld. Storniert heißt: Geld zurück.
  expect(darfHerunterladen('pending')).toBe(false)
  expect(darfHerunterladen('cancelled')).toBe(false)
  expect(darfHerunterladen(null)).toBe(false)
  expect(darfHerunterladen(undefined)).toBe(false)
})

test('der Link gilt für genau diese Bestellung und genau diese Datei', () => {
  const bis = downloadBis(365, 1_800_000_000_000)
  const sig = downloadSignatur(11, 22, bis)

  expect(downloadGueltig(11, 22, bis, sig, 1_800_000_000_000)).toBe(true)

  // Die Nummer hochzählen bringt nichts — weder bei der Bestellung …
  expect(downloadGueltig(12, 22, bis, sig, 1_800_000_000_000)).toBe(false)
  // … noch bei der Datei. Sonst käme man mit einem gekauften Bauplan an alle.
  expect(downloadGueltig(11, 23, bis, sig, 1_800_000_000_000)).toBe(false)
  // Und die Frist lässt sich nicht selbst verlängern.
  expect(downloadGueltig(11, 22, bis + 1000, sig, 1_800_000_000_000)).toBe(false)
})

test('ein abgelaufener Link ist tot', () => {
  const bis = downloadBis(365, 1_800_000_000_000)
  const sig = downloadSignatur(11, 22, bis)
  // Ein Jahr und eine Sekunde später
  expect(downloadGueltig(11, 22, bis, sig, bis + 1000)).toBe(false)
})

test('unvollständige Angaben gelten nie', () => {
  const bis = downloadBis()
  expect(downloadGueltig('', 22, bis, downloadSignatur('', 22, bis))).toBe(false)
  expect(downloadGueltig(11, '', bis, downloadSignatur(11, '', bis))).toBe(false)
  expect(downloadGueltig(11, 22, bis, '')).toBe(false)
  // Eine Unterschrift anderer Länge darf nicht in den Vergleich laufen
  expect(downloadGueltig(11, 22, bis, 'zu-kurz')).toBe(false)
})

test('die Frist sind 365 Tage', () => {
  const ab = 1_800_000_000_000
  expect(downloadBis(365, ab) - ab).toBe(365 * 24 * 60 * 60 * 1000)
})

test('der Link ist vollständig und ohne doppelten Schrägstrich', () => {
  const bis = downloadBis(365, 1_800_000_000_000)
  const link = downloadLink(11, 22, bis, 'https://vincent-hellmann.com/')
  expect(link).toContain('https://vincent-hellmann.com/api/download?')
  expect(link).toContain('bestellung=11')
  expect(link).toContain('datei=22')
  expect(link).toContain(`bis=${bis}`)
  expect(link).not.toContain('.com//')
})
