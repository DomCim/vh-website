import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

/**
 * Das Schreibfeld darf nicht in einem `<label>` stehen.
 *
 * Der Fall, der dahintersteckt: Im Postfach lag es in einem — und am Telefon
 * ging danach keine Auswahlliste mehr auf, weder Größe noch Überschrift noch
 * Strich. Ein Tipp irgendwo in ein Label reicht der Browser an dessen
 * Formularfeld weiter; Quills Leiste bringt für jede Liste ein verstecktes
 * `select` mit, und dort landete der Tipp. Am Rechner fiel es nicht auf, weil
 * Quill schon beim Drücken der Maustaste aufklappt.
 *
 * Deshalb diese Prüfung: Sie liest den Quelltext, nicht den Bildschirm — ein
 * Fehler, der nur mit Finger auf einem echten Gerät auftritt, wäre sonst erst
 * beim Kunden zu sehen.
 */

function tsxDateien(ordner: string): string[] {
  return fs.readdirSync(ordner, { withFileTypes: true }).flatMap((eintrag) => {
    const voll = path.join(ordner, eintrag.name)
    if (eintrag.isDirectory()) return tsxDateien(voll)
    return eintrag.isFile() && voll.endsWith('.tsx') ? [voll] : []
  })
}

test('kein Schreibfeld innerhalb eines <label>', () => {
  // Ein `<label>`, das bis zu seinem Ende ein `<Schreibfeld` enthält
  const verdacht = /<label[^>]*>(?:(?!<\/label>)[\s\S])*?<Schreibfeld/

  const treffer = tsxDateien(path.join(process.cwd(), 'src'))
    .filter((datei) => fs.readFileSync(datei, 'utf8').includes('<Schreibfeld'))
    .filter((datei) => verdacht.test(fs.readFileSync(datei, 'utf8')))
    .map((datei) => path.relative(process.cwd(), datei))

  expect(treffer, 'Schreibfeld gehört in ein <div class="buero-feld">, nicht in ein <label>').toEqual(
    [],
  )
})
