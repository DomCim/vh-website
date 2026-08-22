import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

/**
 * Wer etwas ändern kann, muss es vorher lesen können.
 *
 * Das ist keine Förmlichkeit. Die Leitplanken verlangen ausdrücklich, vor dem
 * Schreiben zu lesen — Listen werden ersetzt, nicht ergänzt, und wer das
 * überspringt, löscht Inhalte, ohne es zu merken. Fehlt zu einem
 * `*_aendern` das passende `*_lesen`, ist diese Regel nicht befolgbar.
 *
 * Aufgefallen an `aktion_lesen`: Es gab nur die Liste, und die verriet bei
 * einer Aktion „gilt für bestimmte Kategorien" nicht, für welche. Wer sie
 * ändern wollte, musste raten.
 */
const quelle = fs
  .readdirSync(path.join(process.cwd(), 'src/lib/mcp'))
  .filter((d) => d.endsWith('.ts'))
  .map((d) => fs.readFileSync(path.join(process.cwd(), 'src/lib/mcp', d), 'utf8'))
  .join('\n')

const werkzeuge = new Set(
  [...quelle.matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map((m) => m[1]),
)

/*
 * Bilder sind die Ausnahme: `medien_liste` zeigt sie samt Maßen und Alt-Text,
 * ein `bild_lesen` wäre dieselbe Auskunft ein zweites Mal.
 */
const OHNE_EIGENES_LESEN = new Set(['bild'])

test('Zu jedem Ändern gibt es ein Lesen', () => {
  const fehlend: string[] = []
  for (const name of werkzeuge) {
    if (!name.endsWith('_aendern')) continue
    const gruppe = name.slice(0, -'_aendern'.length)
    if (OHNE_EIGENES_LESEN.has(gruppe)) continue
    if (!werkzeuge.has(`${gruppe}_lesen`)) fehlend.push(`${gruppe}_lesen`)
  }
  expect(fehlend, `Diese Lese-Werkzeuge fehlen: ${fehlend.join(', ')}`).toEqual([])
})

/**
 * Was angelegt wird, muss auch wieder wegzuräumen sein. Eine leere Kategorie,
 * die niemand entfernen kann, steht sonst dauerhaft in der Navigation und in
 * der Sitemap — genau so ist es „Outdoor Möbel" und „Leuchten" ergangen.
 */
test('Was sich anlegen lässt, lässt sich auch löschen', () => {
  const fehlend: string[] = []
  for (const name of werkzeuge) {
    if (!name.endsWith('_anlegen')) continue
    const gruppe = name.slice(0, -'_anlegen'.length)
    /*
     * Drei Ausnahmen, jede mit Grund:
     *
     * — Entwürfe für Angebot und Rechnung sind Buchungsvorgänge. Die werden
     *   im Büro storniert, nicht über die Schnittstelle gelöscht.
     * — Eine Wiedervorlage wird abgehakt (wiedervorlage_erledigen), nicht
     *   weggeworfen; sie ist Teil der Geschichte eines Vorgangs.
     * — Ein Geschäftspartner hängt an zehn Stellen, darunter
     *   Ausgangsrechnungen. Ihn zu löschen ist kein Aufräumen, sondern ein
     *   Buchhaltungsvorgang — und dafür gibt es das Büro.
     */
    if (
      gruppe.endsWith('_entwurf') ||
      gruppe === 'wiedervorlage' ||
      gruppe === 'kontakt' ||
      gruppe === 'partner'
    )
      continue
    if (!werkzeuge.has(`${gruppe}_loeschen`)) fehlend.push(`${gruppe}_loeschen`)
  }
  expect(fehlend, `Diese Lösch-Werkzeuge fehlen: ${fehlend.join(', ')}`).toEqual([])
})

test('Die heute ergänzten Werkzeuge sind da', () => {
  const neu = [
    'aktion_lesen',
    'kategorie_lesen',
    'kategorie_loeschen',
    'wiedervorlage_erledigen',
    'partner_lesen',
    'kundenstimme_lesen',
  ]
  for (const name of neu) {
    expect(werkzeuge.has(name), `${name} fehlt`).toBe(true)
  }
})

/**
 * Die Sterne kamen später zur Kundenstimme dazu und fehlten in der
 * Schnittstelle — weder lesbar noch setzbar. Sie entscheiden mit darüber, ob
 * im Google-Ergebnis eine Sternebewertung erscheint.
 */
test('Die Sterne einer Kundenstimme sind lesbar und setzbar', () => {
  const modul = fs.readFileSync(path.join(process.cwd(), 'src/lib/mcp/kundenstimmen.ts'), 'utf8')
  expect(modul).toContain('sterne: t.rating')
  expect((modul.match(/rating: sterne/g) ?? []).length).toBe(2)
})
