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

  /**
   * Die Tastatur — und was dabei mit den beiden Leisten geschieht.
   *
   * Zwei Meldungen aus dem Büro haben hier etwas geändert:
   *
   *  - **#38** Nach dem Zurückkehren aus dem Hintergrund fehlte die
   *    Navigationsleiste. Sie hing allein an einem Höhenunterschied, und beim
   *    Aufwachen meldet iOS für einen Moment die alte, kleine Höhe. Jetzt muss
   *    zusätzlich jemand in einem Feld stehen — eine Tastatur ohne Feld gibt
   *    es nicht.
   *  - **#42** „Ich komme nicht an den Senden-Knopf, solange die Tastatur
   *    offen ist." Die Fußleiste fiel dabei zurück in den Fluss und lag
   *    irgendwo weiter unten in der Seite. Jetzt schwebt sie als Knopf über
   *    der Tastatur.
   */

  /** Was der Browser bei offener Tastatur meldet — fernsteuern lässt sie sich nicht */
  async function tastatur(page: import('@playwright/test').Page, hoehe: number) {
    await page.evaluate((h) => {
      const sicht = window.visualViewport!
      Object.defineProperty(sicht, 'height', {
        value: window.innerHeight - h,
        configurable: true,
      })
      sicht.dispatchEvent(new Event('resize'))
    }, hoehe)
  }

  test('ohne Feld im Fokus bleibt die Leiste stehen — auch bei falscher Höhe', async ({ page }) => {
    await page.goto('/office/wareneingang/neu')
    await expect(page.locator('.buero-tableiste')).toBeVisible()

    /*
     * Genau der Fall aus #38: Die Höhe sieht aus wie eine Tastatur, aber
     * niemand tippt. Vorher verschwand die Leiste hier — und blieb weg, weil
     * danach kein Ereignis mehr kam, das es zurückgenommen hätte.
     */
    await tastatur(page, 380)
    await expect(page.locator('.buero-tableiste')).toBeVisible()
  })

  test('beim Tippen weicht die Leiste, und die Hauptaktion schwebt über der Tastatur', async ({
    page,
  }) => {
    await page.goto('/office/wareneingang/neu')
    // Die Hauptaktion klebt am unteren Rand, solange getippt werden kann
    await expect(page.locator('.buero-fussleiste')).toHaveCSS('position', 'sticky')

    await page.locator('input[type="date"], input:not([type="file"])').first().focus()
    await tastatur(page, 380)

    await expect(page.locator('.buero-tableiste')).toBeHidden()

    /*
     * Der Knopf muss dort landen, wo man ihn erreicht: über der Tastatur und
     * im Bild. Geprüft wird die gemessene Lage und nicht die CSS-Regel —
     * eine Regel kann stimmen und der Knopf trotzdem unterhalb sitzen.
     */
    const leiste = page.locator('.buero-fussleiste')
    await expect(leiste).toHaveCSS('position', 'fixed')
    const kasten = await leiste.boundingBox()
    const sichtbar = await page.evaluate(() => window.innerHeight - 380)
    expect(kasten).not.toBeNull()
    expect(kasten!.y + kasten!.height).toBeLessThanOrEqual(sichtbar)
    expect(kasten!.y).toBeGreaterThan(0)

    // Und er nimmt nur, was er braucht — sonst deckte er das Feld zu
    const breite = await page.evaluate(() => window.innerWidth)
    expect(kasten!.width).toBeLessThan(breite * 0.8)
  })
})
