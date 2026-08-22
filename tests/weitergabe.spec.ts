import { expect, test } from '@playwright/test'

import {
  WEITERGABE_TAGE,
  weitergabeBis,
  weitergabeGueltig,
  weitergabeLink,
  weitergabeSignatur,
} from '../src/lib/weitergabe'

/**
 * Der Abhol-Link zum Zulieferer — ohne Server, ohne Datenbank.
 *
 * Hier hängt alles an der Signatur: Sie ist die einzige Prüfung zwischen
 * einer Adresszeile aus dem Netz und einer Fertigungszeichnung des Hauses.
 * Ein Fehler darin fällt nicht auf, er wirkt — deshalb sind die Fälle
 * durchgespielt, in denen jemand am Link dreht.
 */

test.describe('Signatur', () => {
  test('gilt für genau diese Datei und genau diese Frist', () => {
    const bis = weitergabeBis()
    const sig = weitergabeSignatur(42, bis)

    expect(weitergabeGueltig(42, bis, sig)).toBe(true)

    // Nachbarnummer: Die Kennungen liegen dicht beieinander und wären in
    // einer Minute durchprobiert, wenn die Signatur sie nicht festnagelte
    expect(weitergabeGueltig(43, bis, sig)).toBe(false)
    // Frist verlängern: Der Link soll nicht durch Umtippen weiterleben
    expect(weitergabeGueltig(42, bis + 86_400_000, sig)).toBe(false)
    expect(weitergabeGueltig(42, bis, `${sig}x`)).toBe(false)
    expect(weitergabeGueltig(42, bis, '')).toBe(false)
  })

  test('läuft ab — und ohne Frist gilt gar nichts', () => {
    const abgelaufen = Date.now() - 1000
    expect(weitergabeGueltig(7, abgelaufen, weitergabeSignatur(7, abgelaufen))).toBe(false)

    // Kein `bis`, kein Zugang: `Number('')` ist 0 und damit keine ganze Zahl
    expect(weitergabeGueltig(7, Number.NaN, 'egal')).toBe(false)
    expect(weitergabeGueltig('', weitergabeBis(), 'egal')).toBe(false)
  })

  test('das Passwort fehlt nicht — es gibt keins', () => {
    const bis = weitergabeBis()
    const url = weitergabeLink(9, bis)

    expect(url).toContain('/api/weitergabe?')
    expect(url).toContain('datei=9')
    expect(url).toContain(`bis=${bis}`)
    expect(url).toContain(`sig=${encodeURIComponent(weitergabeSignatur(9, bis))}`)
  })
})

test('die Frist ist die vereinbarte', () => {
  const ab = Date.UTC(2026, 0, 1)
  expect(weitergabeBis(WEITERGABE_TAGE, ab)).toBe(ab + WEITERGABE_TAGE * 86_400_000)
})
