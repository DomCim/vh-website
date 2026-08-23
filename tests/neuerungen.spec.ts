import { expect, test } from '@playwright/test'

import {
  hoechsteNummer,
  kopfUndRest,
  nachNummer,
  ungesehen,
  zerlegen,
} from '../src/lib/neuerungen'
import { NEUERUNGEN } from '../src/neuerungen'

/**
 * Die Regeln hinter dem Neuerungen-Banner — ohne Server prüfbar.
 *
 * Zwei Dinge sind hier heikel und deshalb einzeln geprüft: Die **Nummern**
 * tragen, was jemand schon gesehen hat — doppelte oder nachträglich
 * verschobene Nummern würden Einträge stillschweigend überspringen. Und die
 * **Auszeichnung**: Genau daran ist die alte Darstellung gescheitert, die
 * Sternchen und Backticks als Zeichen mitten im Satz stehen ließ.
 */

test('die Nummern sind eindeutig und lückenlos', () => {
  const nummern = NEUERUNGEN.map((n) => n.nummer)
  expect(new Set(nummern).size).toBe(nummern.length)
  // Lückenlos von 1 an — sonst hätte jemand eine Nummer vergeben und wieder
  // zurückgezogen, und die Marke am Konto zeigte ins Leere
  expect([...nummern].sort((a, b) => a - b)).toEqual(
    Array.from({ length: nummern.length }, (_, i) => i + 1),
  )
})

test('die Einträge stehen neueste zuerst', () => {
  expect(NEUERUNGEN.map((n) => n.nummer)).toEqual(nachNummer(NEUERUNGEN).map((n) => n.nummer))
})

test('jeder Eintrag hat Titel und mindestens einen Punkt', () => {
  for (const n of NEUERUNGEN) {
    expect(n.titel.trim().length, `Eintrag ${n.nummer}`).toBeGreaterThan(0)
    expect(n.punkte?.length ?? 0, `Eintrag ${n.nummer}`).toBeGreaterThan(0)
  }
})

test('es steht keine Auszeichnung im Text, die die Anzeige nicht kennt', () => {
  const alleTexte = NEUERUNGEN.flatMap((n) =>
    (n.punkte ?? []).flatMap((p) => [p.text, ...(p.unter ?? []).map((u) => u.text)]),
  )
  for (const text of alleTexte) {
    // Paarweise — ein einzelnes Sternchen wäre ein Kursiv, das niemand setzt
    expect((text.match(/\*\*/g) ?? []).length % 2, text.slice(0, 60)).toBe(0)
    expect((text.match(/`/g) ?? []).length % 2, text.slice(0, 60)).toBe(0)
    // Was übrig bleibt, darf kein Sternchen mehr enthalten
    expect(text.replace(/\*\*(.+?)\*\*/g, '$1'), text.slice(0, 60)).not.toContain('*')
    expect(text, text.slice(0, 60)).not.toMatch(/\]\(/)
  }
})

test('ungesehen zählt nur, was über der Marke liegt', () => {
  const liste = [{ nummer: 3 }, { nummer: 2 }, { nummer: 1 }]
  expect(ungesehen(liste, 1).map((n) => n.nummer)).toEqual([3, 2])
  expect(ungesehen(liste, 3)).toEqual([])
  // Ein Konto ohne Marke hat noch nichts gesehen
  expect(ungesehen(liste, null).length).toBe(3)
  expect(hoechsteNummer(liste)).toBe(3)
})

test('zerlegen trennt Fettung und Pfade vom Text', () => {
  expect(zerlegen('Ganz **wichtig** hier')).toEqual([
    { art: 'text', inhalt: 'Ganz ' },
    { art: 'fett', inhalt: 'wichtig' },
    { art: 'text', inhalt: ' hier' },
  ])
  expect(zerlegen('liegt unter `/office` bereit')).toEqual([
    { art: 'text', inhalt: 'liegt unter ' },
    { art: 'pfad', inhalt: '/office' },
    { art: 'text', inhalt: ' bereit' },
  ])
  // Ohne Auszeichnung bleibt der Satz ein Stück
  expect(zerlegen('nichts besonderes')).toEqual([{ art: 'text', inhalt: 'nichts besonderes' }])
})

test('die Fettung am Anfang wird zur Überschrift des Punktes', () => {
  const { kopf, rest } = kopfUndRest('**Der Shop verkauft Dateien.** Ein Artikel lässt sich …')
  expect(kopf).toBe('Der Shop verkauft Dateien.')
  expect(rest).toBe('Ein Artikel lässt sich …')

  // Ohne führende Fettung bleibt alles Text — und eine Fettung mitten im Satz
  // ist keine Überschrift
  expect(kopfUndRest('Ganz **wichtig** hier').kopf).toBeNull()
})
