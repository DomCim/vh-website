import { expect, test } from '@playwright/test'

import { LEITPLANKEN } from '../src/lib/mcp/leitplanken'
import { textZuRichText } from '../src/lib/richtextText'

/**
 * An einem Abend ging beim Übersetzen fast alles daneben, was danebengehen
 * konnte — und `uebersetzungen_pruefen` meldete jedes Mal „alles übersetzt".
 * Gefunden wurde es von Hand.
 *
 * Diese Prüfungen halten fest, dass die Lehren daraus im Werkzeug stehen und
 * nicht nur in einem Protokoll, das niemand liest.
 */
const regeln = LEITPLANKEN.join('\n')

test('Die Leitplanken erklären das Übersetzen', () => {
  expect(regeln).toContain('## Übersetzen')
  // Die Auszeichnung — ohne sie wird jede Übersetzung zur Textwüste
  expect(regeln).toContain('## Überschrift')
  expect(regeln).toContain('**fett**')
  // Gefüllt ist nicht übersetzt
  expect(regeln).toContain('Gefüllt ist nicht übersetzt')
  // Die Falle mit den Varianten
  expect(regeln).toContain('Kennung jeder Variante')
})

test('Die Wortliste steht in den Leitplanken', () => {
  for (const wort of ['NEXT CONCEPT', 'Cimatron', 'Corten', 'flammekueche']) {
    expect(regeln, `${wort} fehlt in der Wortliste`).toContain(wort)
  }
})

/**
 * Die Prüflogik selbst: Gliederung und Länge müssen sich vergleichen lassen.
 * Beides steckt in `uebersetzungen_pruefen`; hier wird die Grundlage geprüft,
 * auf der es aufsetzt.
 */
test('Ein Stummel ist an der Länge erkennbar', () => {
  const lang = textZuRichText(
    ['## Überschrift', 'Ein langer Absatz, wie er im deutschen Original steht.', 'Und noch einer, damit es Substanz hat.'].join('\n\n'),
  )
  const stummel = textZuRichText('Ein Satz.')

  const zeichen = (v: unknown) =>
    JSON.stringify(v).replace(/[^\p{L}\p{N} ]/gu, '').length
  expect(zeichen(stummel)).toBeLessThan(zeichen(lang) * 0.4)
})

test('Eine geglättete Übersetzung hat eine andere Gliederung als das Original', () => {
  const gliederung = (wert: unknown) =>
    ((wert as { root: { children: { type: string; tag?: string }[] } }).root.children ?? [])
      .map((k) => (k.type === 'heading' ? (k.tag === 'h3' ? 'H3' : 'H2') : k.type === 'list' ? 'L' : 'P'))
      .join(' ')

  const original = textZuRichText('## Titel\n\nAbsatz.\n\n- a\n- b')
  const geglaettet = textZuRichText('Titel\n\nAbsatz.\n\na b')

  expect(gliederung(original)).toBe('H2 P L')
  expect(gliederung(geglaettet)).toBe('P P P')
  expect(gliederung(original)).not.toBe(gliederung(geglaettet))
})
