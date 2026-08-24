import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

/**
 * Die Farben in den Listen — überall dasselbe oder gar nicht.
 *
 * Gemeldet von Dominik (08/2026) mit drei Bildschirmfotos: „Warum wird das mit
 * den Listen nicht konsequent durchgezogen?" Und er hatte recht — auf den
 * Bildern standen drei verschiedene Muster nebeneinander. Die Aufträge trugen
 * ihren farbigen Balken, die Artikel zeigten rechts eine bronzene Marke und
 * links nichts, und die Auslastung zeigte Marken in drei Farben ohne jeden
 * Balken.
 *
 * Eine Farbe, die in einer Liste etwas bedeutet und in der nächsten fehlt, ist
 * schlechter als gar keine: Man gewöhnt sich an, hinzusehen, und wird dann
 * nicht gewarnt.
 *
 * **Die Regel.** Wo eine Zeile eine Zustandsmarke trägt (`warn`, `offen`,
 * `gut`), trägt die Liste auch den Balken. Umgekehrt gilt: Was kein Zustand
 * ist — eine Rolle, eine Richtung, eine Herkunft —, bekommt eine neutrale
 * Marke ohne Farbe.
 *
 * **Nicht Zeile für Zeile gleich.** Der Balken markiert, was auf jemanden
 * wartet; die Marke darf zusätzlich etwas Erledigtes benennen. Ein bezahlter
 * Beleg, ein gebuchter Wareneingang, eine freie Woche bleiben deshalb
 * bewusst farblos — grün auf neun von zehn Zeilen sagt nichts mehr. Geprüft
 * wird darum je Datei und nicht je Zeile.
 */

const ORTE = ['src/app/(office)', 'src/components/office']

/** Alle Bausteine, die eine Liste zeichnen */
function listenDateien(): string[] {
  const raus: string[] = []
  const gehe = (ordner: string) => {
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const voll = path.join(ordner, e.name)
      if (e.isDirectory()) gehe(voll)
      else if (e.name.endsWith('.tsx') && fs.readFileSync(voll, 'utf8').includes('buero-zeile')) {
        raus.push(voll)
      }
    }
  }
  for (const o of ORTE) gehe(path.join(process.cwd(), o))
  return raus.sort()
}

const ZUSTANDSMARKE = /buero-marker (?:warn|offen|gut)\b|buero-marker \$\{/
const BALKEN = /balkenKlasse|ist-(?:offen|warn|gut|neu)\b|ist-\$\{/

test('wo eine Zeile einen Zustand zeigt, trägt sie auch den Balken', () => {
  const fehlend: string[] = []
  for (const d of listenDateien()) {
    const quelle = fs.readFileSync(d, 'utf8')
    if (ZUSTANDSMARKE.test(quelle) && !BALKEN.test(quelle)) {
      fehlend.push(path.relative(process.cwd(), d))
    }
  }
  expect(
    fehlend,
    `Diese Listen zeigen rechts eine Zustandsfarbe und links keinen Balken:\n  ${fehlend.join('\n  ')}`,
  ).toEqual([])
})

test('die Bedeutung der vier Farben steht genau einmal fest', () => {
  /*
   * Sie ist die Grundlage der Regel oben. Wer eine fünfte Farbe dazunimmt
   * oder eine Bedeutung verschiebt, ändert damit jede Liste im Büro auf
   * einmal — das soll man beim Ändern lesen müssen.
   */
  const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/office.css'), 'utf8')
  const erklaerung = css.slice(css.indexOf('Der Statusbalken links'), css.indexOf('.buero-zeile::before'))
  for (const wort of ['rot', 'bronze', 'grün', 'blau']) {
    expect(erklaerung.toLowerCase(), `„${wort}" fehlt in der Bedeutungstabelle`).toContain(wort)
  }
})

test('am Handy darf die Zeile umbrechen und der Titel zweizeilig werden', () => {
  /*
   * Der zweite Teil derselben Meldung: „KW 39 · 2…", „Outdoor - Möbel -
   * Sessel…". Was rechts stand, nahm sich seinen Platz, und der Titel bekam
   * den Rest — bei drei Elementen rechts waren das gut hundert Pixel.
   */
  const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/office.css'), 'utf8')
  const handy = css.slice(css.indexOf('@media (max-width: 640px)'))
  expect(handy).toMatch(/\.buero-zeile \{[^}]*flex-wrap:\s*wrap/)
  // Ohne die Grundbreite bräche jede Zeile um, auch wo alles nebeneinander passt
  expect(handy).toMatch(/\.buero-zeile-haupt \{[^}]*flex:\s*1 1 13rem/)
  expect(handy).toMatch(/\.buero-zeile-titel \{[^}]*line-clamp:\s*2/)
})
