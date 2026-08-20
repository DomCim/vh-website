import { expect, test } from '@playwright/test'

import { gesendet, nurGesendete } from '../src/lib/teilaenderung'

/**
 * Beim Ändern schreibt die Schnittstelle nur, wonach gefragt wurde.
 *
 * Der Fehler, der dahintersteckt: Aus `{ id, status: 'bezahlt' }` wurde über
 * `items: (b.items ?? [])` ein leeres Positionsfeld — und die Rechnung stand
 * ohne Positionen da. Umgekehrt hätte `{ id, items }` den Status einer
 * gestellten Rechnung auf „Entwurf" zurückgesetzt.
 */

test.describe('Was bei einer Änderung geschrieben wird', () => {
  test('nur die Felder, die im Körper standen', () => {
    const koerper = { id: 7, status: 'bezahlt' }
    const daten = { status: 'bezahlt', items: [], note: undefined }

    expect(nurGesendete(koerper, daten)).toEqual({ status: 'bezahlt' })
  })

  test('was nicht geschickt wurde, bleibt unberührt — auch leere Listen', () => {
    const daten = { items: [], positions: [] }
    expect(nurGesendete({ id: 1 }, daten)).toEqual({})
  })

  test('eine mitgeschickte leere Liste ist eine Ansage und wird geschrieben', () => {
    // Wer alle Positionen löscht, schickt `items: []` — das ist etwas
    // anderes als „items gar nicht erwähnt"
    expect(nurGesendete({ items: [] }, { items: [] })).toEqual({ items: [] })
  })

  test('null und leerer Text leeren ein Feld absichtlich', () => {
    expect(nurGesendete({ note: '' }, { note: undefined })).toEqual({ note: undefined })
    expect(nurGesendete({ dueDate: null }, { dueDate: null })).toEqual({ dueDate: null })
  })

  test('abgeleitete Felder hängen an ihrer Quelle', () => {
    // Das Zahldatum entsteht aus dem Status — kommt der, kommt es mit
    const daten = { paidDate: '2026-08-20', status: 'bezahlt' }
    expect(
      nurGesendete({ status: 'bezahlt' }, daten, { paidDate: ['paidDate', 'status'] }),
    ).toEqual(daten)
    expect(nurGesendete({ note: 'x' }, daten, { paidDate: ['paidDate', 'status'] })).toEqual({})
  })

  test('`undefined` zählt als nicht geschickt', () => {
    expect(gesendet({ a: undefined }, 'a')).toBe(false)
    expect(gesendet({ a: null }, 'a')).toBe(true)
    expect(gesendet({}, 'a')).toBe(false)
  })
})
