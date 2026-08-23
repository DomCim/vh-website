import { expect, test } from '@playwright/test'

import { zaehlskriptMitWache } from '../src/lib/statistik'

/**
 * Unter Fernsteuerung wird nicht gezählt.
 *
 * Der Anlass steht bei `zaehlskriptMitWache`: Zwei Drittel der Besucher in
 * der Statistik waren unsere eigenen Prüfläufe. Genau die laufen hier — diese
 * Prüfung fährt also selbst den Fall, den sie prüft, und braucht dafür kein
 * Nachstellen: Playwright setzt `navigator.webdriver`, wie jeder
 * ferngesteuerte Browser.
 *
 * Geprüft werden beide Richtungen. Nur „zählt nicht" wäre die halbe Wahrheit
 * — eine Wache, die immer zuschlägt, hätte die Statistik ganz abgeschaltet,
 * und gemerkt hätte man es erst an einer Seite, auf der nie wieder etwas
 * ankommt.
 */

/** Steht für Plausibles Skript — es soll unter Fernsteuerung gar nicht laufen. */
const SKRIPT = 'window.__gezaehlt = true'

test('ein ferngesteuerter Browser zählt nicht — führt aber auch nichts ins Leere', async ({
  page,
}) => {
  await page.goto('about:blank')
  await page.addScriptTag({ content: zaehlskriptMitWache(SKRIPT) })

  expect(await page.evaluate(() => (window as { __gezaehlt?: boolean }).__gezaehlt)).toBeUndefined()
  // Die Attrappe muss da sein: Ein eigenes Ereignis darf nicht daran
  // scheitern, dass gerade nicht gezählt wird
  expect(await page.evaluate(() => typeof (window as { plausible?: unknown }).plausible)).toBe(
    'function',
  )
  await expect(
    page.evaluate(() =>
      (window as unknown as { plausible: (n: string) => void }).plausible('probe'),
    ),
  ).resolves.toBeUndefined()
})

test('ein gewöhnlicher Browser zählt weiter', async ({ page }) => {
  // `webdriver` zurückdrehen, bevor irgendetwas läuft — so sieht die Seite
  // aus wie bei einem Menschen
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
  })
  await page.goto('about:blank')
  await page.addScriptTag({ content: zaehlskriptMitWache(SKRIPT) })

  expect(await page.evaluate(() => (window as { __gezaehlt?: boolean }).__gezaehlt)).toBe(true)
})

test('die Wache lässt das Skript unverändert stehen', () => {
  // Plausibles Skript wird nur umschlossen, nicht angefasst — an ihm etwas zu
  // ändern hieße, es bei jedem Update dort wieder zu ändern
  expect(zaehlskriptMitWache(SKRIPT)).toContain(SKRIPT)
  expect(zaehlskriptMitWache(SKRIPT)).toContain('navigator.webdriver')
})
