import { expect, test } from '@playwright/test'

import { ordnernameGueltig, ordnerPfadNeben } from '../src/lib/ordnerpfad'

/**
 * Wohin ein neuer Postfach-Ordner kommt.
 *
 * Die Regel steht an einer Stelle und wird an zweien gebraucht — im Browser
 * beim Anlegen, auf dem Server beim Nachprüfen. Genau solche Regeln laufen
 * auseinander, wenn niemand hinsieht, und der Schaden ist still: Der Ordner
 * entsteht, nur woanders. Beim nächsten Blick ins Postfach am Rechner ist er
 * dann „weg".
 */

test('neben dem offenen Ordner, nicht darin', () => {
  // Im Posteingang angelegt → oberste Ebene, kein Unterordner des Posteingangs
  expect(ordnerPfadNeben('INBOX', '.', 'Kunden')).toBe('Kunden')
  // In einem Unterordner angelegt → dieselbe Ebene
  expect(ordnerPfadNeben('INBOX.Kunden', '.', 'Rechnungen')).toBe('INBOX.Rechnungen')
  expect(ordnerPfadNeben('INBOX.Kunden.2026', '.', 'Alt')).toBe('INBOX.Kunden.Alt')
})

test('der Trenner kommt vom Anbieter und wird nicht geraten', () => {
  // IONOS trennt mit Punkt, andere mit Schrägstrich — beides muss stimmen
  expect(ordnerPfadNeben('INBOX/Kunden', '/', 'Rechnungen')).toBe('INBOX/Rechnungen')
  expect(ordnerPfadNeben('INBOX.Kunden', '.', 'Rechnungen')).toBe('INBOX.Rechnungen')
  // Ohne Angabe der Schrägstrich — die häufigere Wahl
  expect(ordnerPfadNeben('INBOX/Kunden', '', 'Neu')).toBe('INBOX/Neu')
})

test('Namen mit Trennzeichen werden abgelehnt', () => {
  // Sonst entstünde eine Ebene, wo ein Name gemeint war
  expect(ordnernameGueltig('Kunden/2026')).toBe(false)
  expect(ordnernameGueltig('Kunden.2026')).toBe(false)
  expect(ordnernameGueltig('Kunden\\2026')).toBe(false)
})

test('leer und übermäßig lang gehen auch nicht', () => {
  expect(ordnernameGueltig('')).toBe(false)
  expect(ordnernameGueltig('   ')).toBe(false)
  expect(ordnernameGueltig('x'.repeat(61))).toBe(false)
})

test('gewöhnliche Namen gehen — auch mit Umlaut und Leerzeichen', () => {
  expect(ordnernameGueltig('Kunden')).toBe(true)
  expect(ordnernameGueltig('Angebote 2026')).toBe(true)
  expect(ordnernameGueltig('Zulieferer Österreich')).toBe(true)
  expect(ordnernameGueltig('Rechnungen & Belege')).toBe(true)
})
