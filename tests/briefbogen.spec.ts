import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { briefbogen } from '../src/lib/mail'

/**
 * Der Rahmen um jede Mail — Breite, Abstand, Logo.
 *
 * Zwei Fehler, die Vincent und Dominik am Handy gesehen haben, sichert diese
 * Datei ab:
 *
 * 1. **Der Text klebte am linken Rand.** Der Brief stand in einem einzelnen
 *    `div` mit `max-width`, ohne Innenabstand und ohne Zentrierung — am Handy
 *    fing das erste Zeichen an der Glaskante an, am Rechner stand die halbe
 *    Seite leer daneben.
 * 2. **Das Logo reichte von Kante zu Kante.** Die Datei ist 2062 Pixel breit,
 *    angegeben war nur die Höhe. Programme, die den Stil ignorieren, nehmen
 *    die Originalbreite.
 *
 * Gemessen wird im Browser und nicht am HTML: Ob ein Abstand ankommt,
 * entscheidet die Darstellung, nicht die Zeichenkette.
 */

const FIRMA = {
  legalName: 'Next-Concept SAS',
  shareCapital: '1 000 €',
  siret: '98755015900014',
  vatId: 'FR53987550159',
  rcsNumber: '987550159',
  rcsCity: 'Strasbourg',
  address: ['24, avenue Clemenceau', '67630 Lauterbourg', 'Frankreich'].join(
    String.fromCharCode(10),
  ),
}

const INHALT = `<p>Guten Tag Dominik Dill,</p>
<p>anbei die Stornorechnung <strong>RE-2026-0003</strong>. Sie hebt die Rechnung
RE-2026-0001 vom 19.8.2026 auf; daraus ist nichts mehr zu zahlen.</p>`

/** Das Logo als echte Datei — `cid:` kennt der Browser nicht. */
function mitLogo(html: string): string {
  const logo = readFileSync('public/logo-mail.png').toString('base64')
  return html.replace('cid:vh-logo', `data:image/png;base64,${logo}`)
}

test.describe('Der Briefbogen der Mails', () => {
  test('am Handy: Logo im Rahmen, Text mit Abstand', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.setContent(mitLogo(briefbogen(INHALT, FIRMA)))

    const logo = await page.locator('img').first().boundingBox()
    expect(logo!.width, 'das Logo bleibt im Brief statt über die Kante zu reichen').toBeLessThan(340)
    expect(logo!.width, 'und ist nicht bis zur Unsichtbarkeit geschrumpft').toBeGreaterThan(100)
    // 2062 × 192 der Datei ergibt ein Verhältnis von etwa 10,7 : 1
    expect(logo!.width / logo!.height, 'unverzerrt').toBeGreaterThan(8)

    const text = await page.locator('p').first().boundingBox()
    expect(text!.x, 'der Text klebt nicht an der Glaskante').toBeGreaterThan(20)
  })

  test('am Rechner: der Brief steht mittig, nicht links angeschlagen', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 900 })
    await page.setContent(mitLogo(briefbogen(INHALT, FIRMA)))

    const text = await page.locator('p').first().boundingBox()
    // Links angeschlagen wäre x rund 30; mittig sind es bei 1000 px über 200
    expect(text!.x, 'zentriert statt am linken Rand').toBeGreaterThan(120)

    // Und der Brief wird nicht breiter als seine 600 Punkte plus Innenabstand
    const karte = await page.locator('table table').first().boundingBox()
    expect(karte!.width, 'die Zeilen bleiben lesbar kurz').toBeLessThanOrEqual(620)
  })

  test('die Pflichtangaben stehen drunter, auch bei eigenem Text', async ({ page }) => {
    await page.setContent(mitLogo(briefbogen(INHALT, FIRMA)))
    // Sie gehören auf jede Geschäftsmail — eine Vorlage darf sie nicht verlieren
    await expect(page.locator('body')).toContainText('98755015900014')
    await expect(page.locator('body')).toContainText('Next-Concept SAS')
  })

  test('ohne Fußzeile bleibt der Rahmen stehen', async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 })
    await page.setContent(mitLogo(briefbogen(INHALT, FIRMA, false)))

    const text = await page.locator('p').first().boundingBox()
    expect(text!.x, 'auch die interne Mail hat ihren Abstand').toBeGreaterThan(20)
    await expect(page.locator('body')).not.toContainText('98755015900014')
  })
})
