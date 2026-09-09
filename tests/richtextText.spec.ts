import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

import { richTextZuText, textZuRichText } from '../src/lib/richtextText'

/**
 * Der Weg Text → Baum → Text muss dasselbe ergeben.
 *
 * Daran hängt, ob das Büro Rechtstexte und Beschreibungen überhaupt anfassen
 * darf. In der Widerrufsbelehrung steht der Satz, dass bei einem nach Vorgabe
 * gefertigten Einzelstück kein Widerrufsrecht besteht — ginge der beim
 * Speichern verloren, wäre das kein Schönheitsfehler.
 */
const beispiel = [
  '## Widerrufsrecht',
  'Sie haben das Recht, binnen **vierzehn Tagen** ohne Angabe von Gründen zu widerrufen.',
  '### Ausnahme: Einzelanfertigungen',
  'Kein Widerrufsrecht besteht bei Waren, die nach Ihren Vorgaben entstehen.',
  ['- Maße nach Wunsch', '- RAL-Farbton nach Wahl', '- besondere Ausführung'].join('\n'),
  'Fertige Werkstattstücke fallen nicht darunter.',
].join('\n\n')

test('Text übersteht den Weg durch den Richtext unverändert', () => {
  expect(richTextZuText(textZuRichText(beispiel))).toBe(beispiel)
})

test('Überschriften, Listen und Fettes werden zu echten Knoten', () => {
  const baum = textZuRichText(beispiel) as unknown as { root: { children: Record<string, unknown>[] } }
  const arten = baum.root.children.map((k) => `${k.type}${k.tag ? `:${k.tag}` : ''}`)
  expect(arten).toEqual([
    'heading:h2',
    'paragraph',
    'heading:h3',
    'paragraph',
    'list:ul',
    'paragraph',
  ])

  const liste = baum.root.children[4] as { children: unknown[] }
  expect(liste.children.length, 'drei Punkte in einer Liste').toBe(3)

  const absatz = baum.root.children[1] as { children: { text: string; format: number }[] }
  const fett = absatz.children.filter((t) => t.format === 1).map((t) => t.text)
  expect(fett).toEqual(['vierzehn Tagen'])
})

test('Punkte bleiben eine Liste, auch mit Leerzeile dazwischen', () => {
  const eine = textZuRichText('- a\n- b') as unknown as { root: { children: { type: string }[] } }
  expect(eine.root.children.map((k) => k.type)).toEqual(['list'])

  // Wer zwischen zwei Punkten Luft lässt, meint trotzdem eine Liste
  const mitLuft = textZuRichText('- a\n\n- b') as unknown as { root: { children: { type: string }[] } }
  expect(mitLuft.root.children.map((k) => k.type)).toEqual(['list'])

  // Ein Absatz dazwischen trennt sie dagegen
  const zwei = textZuRichText('- a\n\nText\n\n- b') as unknown as { root: { children: { type: string }[] } }
  expect(zwei.root.children.map((k) => k.type)).toEqual(['list', 'paragraph', 'list'])
})

test('Ein leerer Text ergibt einen leeren Absatz, keinen kaputten Baum', () => {
  const leer = textZuRichText('') as unknown as { root: { children: unknown[] } }
  expect(leer.root.children.length).toBe(1)
  expect(richTextZuText(leer)).toBe('')
  expect(richTextZuText(null)).toBe('')
})

/**
 * Der wichtigste Fall für den Bestand: Was heute in der Datenbank steht, sind
 * reine Absätze. Die müssen unverändert durchgehen — sonst schriebe das erste
 * Speichern im Büro eine andere Fassung, als jemand gelesen hat.
 */
test('Reine Absätze bleiben reine Absätze', () => {
  const prosa = 'Erster Absatz.\n\nZweiter Absatz mit einem Bindestrich - mitten im Satz.'
  expect(richTextZuText(textZuRichText(prosa))).toBe(prosa)
})

/**
 * Es darf nur **eine** Umwandlung geben.
 *
 * Es gab einmal eine zweite, in `lib/mcp/helpers.ts`, unter demselben Namen:
 * Sie gab nur den nackten Text heraus, ohne Fettungen und mit
 * aneinandergeklebten Listenpunkten. Was über die Werkzeuge gelesen wurde, sah
 * damit kaputt aus, obwohl es heil war — und wer es daraufhin „richtete" und
 * zurückschrieb, löschte die Auszeichnung dann wirklich. Genau so ist einmal
 * eine Artikelbeschreibung im laufenden Betrieb um ihre Fettungen gekommen.
 *
 * Eine zweite Umwandlung fällt niemandem auf, solange beide denselben Namen
 * tragen. Deshalb hier festgehalten.
 */
test('die MCP-Werkzeuge lesen Richtext mit derselben Umwandlung', () => {
  const ordner = path.join(process.cwd(), 'src/lib/mcp')
  const quelle = fs
    .readdirSync(ordner)
    .filter((d) => d.endsWith('.ts'))
    .map((d) => fs.readFileSync(path.join(ordner, d), 'utf8'))
    .join('\n')

  expect(quelle, 'keine zweite Umwandlung neben lib/richtextText.ts').not.toMatch(
    /function richTextZuText/,
  )
  expect(
    fs.readFileSync(path.join(ordner, 'helpers.ts'), 'utf8'),
    'helpers.ts holt die Umwandlung aus lib/richtextText.ts',
  ).toMatch(/import \{ richTextZuText \} from '\.\.\/richtextText'/)
})
