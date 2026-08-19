import { expect, test } from '@playwright/test'

/**
 * Die untere Leiste am Handy.
 *
 * Drei Dinge, die im Alltag an der Werkbank zählen und die man am Rechner
 * nicht bemerkt:
 *
 * 1. Jeder der vier Arbeitsbereiche öffnet **sein** Blatt — nicht eine Wand
 *    aus allen achtzehn Punkten.
 * 2. Die Leiste bleibt über dem Blatt stehen, damit ein zweiter Tipp direkt
 *    in den nächsten Bereich wechselt.
 * 3. Geht die Bildschirmtastatur auf, verschwindet die Leiste — sonst klebt
 *    sie über dem Feld, in das gerade getippt wird.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT

test.describe('Untere Leiste im Büro', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test.beforeEach(async ({ page }) => {
    await page.goto('/office/login')
    await page.fill('input[autocomplete="username"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })
  })

  test('jeder Bereich öffnet sein eigenes Blatt', async ({ page }) => {
    const leiste = page.locator('.buero-tableiste')
    await expect(leiste).toBeVisible()

    await leiste.locator('.buero-tab', { hasText: 'Werkstatt' }).click()
    const blatt = page.locator('.buero-blatt')
    await expect(blatt.getByRole('link', { name: 'Wareneingang' })).toBeVisible()
    // Was zu einem anderen Bereich gehört, steht auch nicht darin
    await expect(blatt.getByRole('link', { name: 'Rechnungen' })).toHaveCount(0)

    // Die Leiste bleibt bedienbar: ein Tipp wechselt direkt hinüber
    await leiste.locator('.buero-tab', { hasText: 'Geld' }).click()
    await expect(blatt.getByRole('link', { name: 'Rechnungen' })).toBeVisible()
    await expect(blatt.getByRole('link', { name: 'Wareneingang' })).toHaveCount(0)
  })

  test('die Tastatur nimmt die Leiste aus dem Bild', async ({ page }) => {
    await page.goto('/office/wareneingang/neu')
    await expect(page.locator('.buero-tableiste')).toBeVisible()
    // Die Hauptaktion klebt am unteren Rand, solange getippt werden kann
    await expect(page.locator('.buero-fussleiste')).toHaveCSS('position', 'sticky')

    /*
     * Eine echte Bildschirmtastatur lässt sich nicht fernsteuern. Was der
     * Browser dabei meldet, schon: `visualViewport` wird kleiner als das
     * Fenster — und genau daran erkennt `Tastaturwache` die Tastatur.
     */
    await page.evaluate(() => {
      const sicht = window.visualViewport!
      Object.defineProperty(sicht, 'height', {
        value: window.innerHeight - 380,
        configurable: true,
      })
      sicht.dispatchEvent(new Event('resize'))
    })

    await expect(page.locator('.buero-tableiste')).toBeHidden()
    // Und die Fußleiste schwebt nicht über der Tastatur, sondern geht zurück
    // in den Fluss
    await expect(page.locator('.buero-fussleiste')).toHaveCSS('position', 'static')
  })
})
