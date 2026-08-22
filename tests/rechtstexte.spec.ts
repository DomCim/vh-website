import { expect, test } from '@playwright/test'

import {
  nurAbsaetze,
  RECHTSTEXT_FELDER,
  textAusRichText,
  textZuRichText,
} from '../src/lib/rechtstexteFelder'

/**
 * Der Weg Text → Richtext → Text muss verlustfrei sein.
 *
 * Daran hängt, ob das Büro die Rechtstexte anfassen darf. Ginge beim
 * Speichern ein Absatz verloren, wäre das im Impressum eine Kleinigkeit und
 * in der Widerrufsbelehrung ein Rechtsmangel — dort steht der Satz, dass bei
 * einem nach Vorgabe gefertigten Einzelstück kein Widerrufsrecht besteht.
 */
test('Text übersteht den Weg durch den Richtext unverändert', () => {
  const text = [
    'Widerrufsrecht',
    'Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.',
    'Kein Widerrufsrecht besteht bei Waren, die nach Kundenspezifikation angefertigt werden — in dieser Werkstatt also bei jeder Maßanfertigung.',
  ].join('\n\n')

  expect(textAusRichText(textZuRichText(text))).toBe(text)
})

test('Ein leeres Feld bleibt leer und gilt als bearbeitbar', () => {
  expect(textAusRichText(null)).toBe('')
  expect(textAusRichText(undefined)).toBe('')
  expect(nurAbsaetze(null)).toBe(true)
})

/**
 * Die Notbremse gilt jetzt nur noch für das, was sich wirklich nicht abbilden
 * lässt.
 *
 * Überschriften und Aufzählungen sperrten die Bearbeitung anfangs mit —
 * damals konnte das Büro nur Absätze. Seit es `## `, `### `, `- ` und
 * `**fett**` versteht, wäre das Sperren falsch herum: Es hielte genau die
 * Gestaltung fern, für die es gebaut wurde.
 *
 * Ein Verweis, ein Bild oder eine Tabelle bleiben dagegen draußen. So etwas
 * entsteht nur in der Website-Verwaltung, und ein Textfeld würde es beim
 * Speichern lautlos wegwerfen.
 */
test('Überschriften und Aufzählungen lassen sich bearbeiten', () => {
  expect(nurAbsaetze(textZuRichText('Ganz normaler Absatz.'))).toBe(true)
  expect(nurAbsaetze(textZuRichText('## Überschrift\n\n- Punkt\n- noch einer'))).toBe(true)
})

test('Ein Verweis sperrt die Bearbeitung', () => {
  const mitVerweis = {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'link', children: [{ type: 'text', text: 'zur Werkstatt' }] },
          ],
        },
      ],
    },
  }
  expect(nurAbsaetze(mitVerweis)).toBe(false)
})

test('Jedes Feld nennt eine Seite, auf der es erscheint', () => {
  expect(RECHTSTEXT_FELDER.length).toBe(6)
  for (const f of RECHTSTEXT_FELDER) {
    expect(f.pfad.startsWith('/kontakt/'), `${f.feld} zeigt auf ${f.pfad}`).toBe(true)
    expect(f.label.length).toBeGreaterThan(2)
  }
})
