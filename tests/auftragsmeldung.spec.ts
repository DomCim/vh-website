import { expect, test } from '@playwright/test'

import {
  kundenzugang,
  type Meldeauftrag,
  meldungPruefen,
} from '../src/lib/auftragsmeldung'

/**
 * Wann die Kundschaft etwas erfährt — und wann bewusst nicht.
 *
 * Das ist die Sorte Regel, die man nur einmal falsch baut und dann monatelang
 * nicht merkt: Eine Mail zu wenig fällt niemandem auf, eine zu viel geht an
 * echte Kundschaft. Deshalb steht die Entscheidung in einer Funktion ohne
 * Nebenwirkungen, und deshalb steht sie hier vollständig geprüft.
 */

const auftrag = (t: Partial<Meldeauftrag> = {}): Meldeauftrag => ({
  id: 1,
  jobNumber: 'AU-2026-0002',
  title: 'Gartentor',
  status: 'inFertigung',
  source: 'manuell',
  customerName: 'Familie Wagner',
  contact: { email: 'wagner@example.test', name: 'Familie Wagner', sprache: 'de' },
  lieferart: 'versand',
  kundeBenachrichtigen: true,
  gemeldet: {},
  ...t,
})

test('ein Statuswechsel meldet', () => {
  const e = meldungPruefen(auftrag(), 'geplant')
  expect(e.senden).toBe(true)
  if (e.senden) {
    expect(e.zustand).toBe('inFertigung')
    expect(e.an).toBe('wagner@example.test')
  }
})

test('Shop-Aufträge melden nichts — sonst kommen zwei Mails', () => {
  /*
   * Die Bestellung verschickt bereits über orderHooks. Beides zusammen hieße:
   * dieselbe Nachricht zweimal, kurz hintereinander, an dieselbe Adresse.
   */
  expect(meldungPruefen(auftrag({ source: 'shop' }), 'geplant').senden).toBe(false)
})

test('ohne Adresse wird nichts verschickt, aber etwas vermerkt', () => {
  /*
   * Stille wäre die schlechteste Antwort: Sie sieht im Büro genauso aus wie
   * „ist informiert". Der Vermerk macht daraus „bitte anrufen".
   */
  const e = meldungPruefen(auftrag({ contact: null, kundeEmail: null }), 'geplant')
  expect(e.senden).toBe(false)
  expect(e.vermerk).toContain('anrufen')
})

test('ohne Geschäftspartner zählt die Adresse am Auftrag', () => {
  const e = meldungPruefen(
    auftrag({ contact: null, kundeEmail: ' hallo@example.test ' }),
    'geplant',
  )
  expect(e.senden).toBe(true)
  if (e.senden) expect(e.an).toBe('hallo@example.test')
})

test('bei Abholung meldet „fertig", aber nicht „geliefert"', () => {
  const abholung = { lieferart: 'abholung' as const }
  expect(meldungPruefen(auftrag({ ...abholung, status: 'fertig' }), 'inFertigung').senden).toBe(true)
  // Da wird nichts geliefert — gesagt hat es schon „fertig"
  expect(meldungPruefen(auftrag({ ...abholung, status: 'geliefert' }), 'fertig').senden).toBe(false)
})

test('Versand ohne Sendungsnummer meldet trotzdem — mit Vermerk', () => {
  // Vincent liefert oft selbst; dann gibt es schlicht nichts zu verfolgen
  const e = meldungPruefen(auftrag({ status: 'geliefert', trackingNumber: null }), 'fertig')
  expect(e.senden).toBe(true)
  expect(e.vermerk).toContain('Ohne Sendungsnummer')
})

test('mit Sendungsnummer gibt es nichts zu vermerken', () => {
  const e = meldungPruefen(auftrag({ status: 'geliefert', trackingNumber: '00340' }), 'fertig')
  expect(e.senden).toBe(true)
  expect(e.vermerk).toBeUndefined()
})

test('was einmal gemeldet ist, wird nicht zweimal gemeldet', () => {
  /*
   * Der eigentliche Grund für das Merkfeld. Wer versehentlich auf „geliefert"
   * stellt, zurücknimmt und später wieder vorstellt, schickte sonst zweimal
   * dieselbe Nachricht — der Blick auf den vorigen Stand allein fängt das nicht.
   */
  const schon = auftrag({ status: 'geliefert', gemeldet: { geliefert: '2026-08-20T10:00:00Z' } })
  expect(meldungPruefen(schon, 'fertig').senden).toBe(false)
})

test('derselbe Status ohne Wechsel meldet nicht', () => {
  expect(meldungPruefen(auftrag({ status: 'fertig' }), 'fertig').senden).toBe(false)
})

test('abgeschaltet heißt abgeschaltet', () => {
  expect(meldungPruefen(auftrag({ kundeBenachrichtigen: false }), 'geplant').senden).toBe(false)
})

test('über „geplant" und „abgebrochen" wird nicht gemeldet', () => {
  // Ein Abbruch ist ein Anruf, keine Mail
  expect(meldungPruefen(auftrag({ status: 'geplant' }), 'inFertigung').senden).toBe(false)
  expect(meldungPruefen(auftrag({ status: 'abgebrochen' }), 'inFertigung').senden).toBe(false)
})

test('die Sprache kommt vom Geschäftspartner', () => {
  expect(kundenzugang(auftrag()).sprache).toBe('de')
  expect(
    kundenzugang(auftrag({ contact: { email: 'a@b.test', name: 'Dupont', sprache: 'fr' } })).sprache,
  ).toBe('fr')
  // Unbekannte oder fehlende Angabe fällt auf Deutsch zurück
  expect(
    kundenzugang(auftrag({ contact: { email: 'a@b.test', name: 'X', sprache: 'kl' } })).sprache,
  ).toBe('de')
  expect(kundenzugang(auftrag({ contact: null, kundeEmail: 'a@b.test' })).sprache).toBe('de')
})

test('der Name kommt vom Partner, sonst vom Auftrag', () => {
  expect(kundenzugang(auftrag()).name).toBe('Familie Wagner')
  expect(kundenzugang(auftrag({ contact: null, customerName: 'Stadt Naila' })).name).toBe(
    'Stadt Naila',
  )
})
