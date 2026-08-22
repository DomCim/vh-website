import { expect, test } from '@playwright/test'

import { nurAbsaetze, RECHTSTEXT_FELDER, textAusRichText } from '../src/lib/rechtstexteFelder'
import { richText } from '../src/lib/richtext'

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

  expect(textAusRichText(richText(text))).toBe(text)
})

test('Ein leeres Feld bleibt leer und gilt als bearbeitbar', () => {
  expect(textAusRichText(null)).toBe('')
  expect(textAusRichText(undefined)).toBe('')
  expect(nurAbsaetze(null)).toBe(true)
})

/**
 * Die Notbremse: Steht im Datensatz mehr als Absätze, darf das Büro nicht
 * hinein — ein Textfeld würde die Aufzählung beim Speichern wegwerfen.
 */
test('Aufzählungen und Überschriften sperren die Bearbeitung', () => {
  expect(nurAbsaetze(richText('Ganz normaler Absatz.'))).toBe(true)

  const mitListe = {
    root: {
      type: 'root',
      children: [
        {
          type: 'list',
          children: [{ type: 'listitem', children: [{ type: 'text', text: 'Punkt' }] }],
        },
      ],
    },
  }
  expect(nurAbsaetze(mitListe)).toBe(false)
})

test('Jedes Feld nennt eine Seite, auf der es erscheint', () => {
  expect(RECHTSTEXT_FELDER.length).toBe(6)
  for (const f of RECHTSTEXT_FELDER) {
    expect(f.pfad.startsWith('/kontakt/'), `${f.feld} zeigt auf ${f.pfad}`).toBe(true)
    expect(f.label.length).toBeGreaterThan(2)
  }
})
