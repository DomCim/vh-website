import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { markdownLesen } from '../src/lib/markdownEinfach'

/**
 * Das Papier muss sich auch lesen lassen.
 *
 * Der kleine Markdown-Leser kann genau so viel, wie die
 * Verfahrensdokumentation braucht — nicht mehr. Wächst das Papier um eine
 * Auszeichnung, die er nicht kennt, stünde sie als Zeichen mitten im Satz,
 * und niemand merkte es. Diese Prüfung liest die echte Datei und schlägt an,
 * wenn ein Block als Absatz durchrutscht, der keiner ist.
 */

const papier = fs.readFileSync(
  path.join(process.cwd(), 'VERFAHRENSDOKUMENTATION.md'),
  'utf8',
)

test('die Verfahrensdokumentation zerfällt sauber in Blöcke', () => {
  const stuecke = markdownLesen(papier)
  const arten = new Set(stuecke.map((s) => s.art))

  // Sie hat Überschriften, Fließtext, Aufzählungen, Tabellen und einen Hinweis
  for (const art of ['ueberschrift', 'absatz', 'liste', 'tabelle', 'zitat'] as const) {
    expect(arten.has(art), `${art} fehlt — hat sich das Papier geändert?`).toBe(true)
  }

  /*
   * Der eigentliche Wächter: Kein Absatz darf mit einem Zeichen anfangen, das
   * einen Block einleitet. Täte er es, hätte der Leser ihn nicht erkannt.
   */
  const durchgerutscht = stuecke
    .filter((s) => s.art === 'absatz')
    .filter((s) => /^\s*([#>|]|[-*]\s|\d+\.\s|-{3,})/.test((s as { text: string }).text))
  expect(durchgerutscht, JSON.stringify(durchgerutscht).slice(0, 200)).toEqual([])
})

test('die Tabellen haben in jeder Zeile so viele Zellen wie im Kopf', () => {
  for (const s of markdownLesen(papier)) {
    if (s.art !== 'tabelle') continue
    for (const zeile of s.zeilen) {
      expect(zeile.length, `Kopf: ${s.kopf.join(' | ')}`).toBe(s.kopf.length)
    }
  }
})

test('sie nennt die Dinge, die ein Prüfer sucht', () => {
  for (const wort of [
    'Nummernkreis',
    'Änderungshistorie',
    'Aufbewahrung',
    'Sicherung',
    'Storno',
    'Rechte',
  ]) {
    expect(papier, `„${wort}" kommt nicht vor`).toContain(wort)
  }
})
