import { expect, test } from '@playwright/test'

import {
  alsWert,
  nameZu,
  sichtAusWieAdresse,
  vorschlaege,
  zuListe,
} from '../src/components/office/EmpfaengerFeld'

/**
 * Die Vorschläge im „An"-Feld.
 *
 * Adressen tippt man falsch, und es fällt erst auf, wenn die Antwort
 * ausbleibt. Deshalb kommt der Vorschlag aus den Partnern — und deshalb
 * stehen die Regeln hier, wo sie ohne Bildschirm prüfbar sind.
 */

const PARTNER = [
  { id: 1, name: 'Katharina Dill', email: 'katharinadill@outlook.de', role: 'kunde' },
  { id: 2, name: 'Laserbetrieb Ost', email: 'zuschnitt@laser-ost.fr', role: 'lieferant' },
  { id: 3, name: 'Ohne Adresse', email: null, role: 'kunde' },
  { id: 4, name: 'Nadine Gottschalk', email: 'n.gottschalk@rheinstetten.de', role: 'beides' },
]

test('gesucht wird in Name und Adresse', () => {
  expect(vorschlaege(PARTNER, 'katha').map((p) => p.id)).toEqual([1])
  // Auch der Anbieter zählt — „alle bei Outlook" ist eine übliche Suche
  expect(vorschlaege(PARTNER, 'outlook').map((p) => p.id)).toEqual([1])
  expect(vorschlaege(PARTNER, 'laser').map((p) => p.id)).toEqual([2])
  // Groß und klein ist einerlei
  expect(vorschlaege(PARTNER, 'NADINE').map((p) => p.id)).toEqual([4])
})

test('wer keine Adresse hat, wird nicht vorgeschlagen', () => {
  // Ein Vorschlag ohne Adresse wäre ein Klick, der nichts einträgt
  expect(vorschlaege(PARTNER, 'ohne')).toEqual([])
})

test('ein einzelner Buchstabe schlägt nichts vor', () => {
  // Sonst klappt die Liste bei jedem Anfang auf und steht im Weg
  expect(vorschlaege(PARTNER, 'k')).toEqual([])
  expect(vorschlaege(PARTNER, '')).toEqual([])
})

test('wer schon gewählt ist, wird nicht noch einmal vorgeschlagen', () => {
  // Derselbe Empfänger zweimal in einer Mail ist keine Absicht
  expect(vorschlaege(PARTNER, 'katha', ['katharinadill@outlook.de'])).toEqual([])
})

test('nach außen bleibt es eine Kommaliste', () => {
  // So versteht es der Versand — die Plättchen sind nur die Ansicht davon
  expect(zuListe('a@x.fr, b@y.fr')).toEqual(['a@x.fr', 'b@y.fr'])
  expect(zuListe('  ')).toEqual([])
  expect(alsWert(['a@x.fr', 'b@y.fr'])).toBe('a@x.fr, b@y.fr')

  // Was noch im Feld steht, geht mit hinaus: Wer tippt und gleich auf „Senden"
  // drückt, meint die Adresse trotzdem
  expect(alsWert(['a@x.fr'], 'c@z.fr')).toBe('a@x.fr, c@z.fr')
  expect(alsWert(['a@x.fr'], '  ')).toBe('a@x.fr')
})

test('das Plättchen trägt den Namen, wenn wir einen kennen', () => {
  expect(nameZu(PARTNER, 'katharinadill@outlook.de')).toBe('Katharina Dill')
  // Groß und klein ist einerlei — Adressen sind es auch
  expect(nameZu(PARTNER, 'KATHARINADILL@OUTLOOK.DE')).toBe('Katharina Dill')
  // Ohne Partner bleibt die Adresse stehen; etwas anderes wäre erfunden
  expect(nameZu(PARTNER, 'fremd@firma.fr')).toBe('fremd@firma.fr')
})

test('von Hand Getipptes wird nur als Adresse übernommen', () => {
  expect(sichtAusWieAdresse('kunde@firma.fr')).toBe(true)
  expect(sichtAusWieAdresse('Katharina')).toBe(false)
  expect(sichtAusWieAdresse('kunde@firma')).toBe(false)
  expect(sichtAusWieAdresse('a b@firma.fr')).toBe(false)
})
