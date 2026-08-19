import { expect, test } from '@playwright/test'

/**
 * Einstellungen im Büro.
 *
 * Bisher führte jeder Weg zu den Zugangsdaten über das Admin-Panel. Jetzt
 * stehen sie im Büro — gerendert aus derselben Feldbeschreibung, die Payload
 * verwendet. Das ist der Punkt, den dieser Test absichert: Kommt dort ein Feld
 * dazu, muss es hier von selbst auftauchen, und ein geänderter Wert muss
 * ankommen.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

test.describe('Einstellungen im Büro', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')
  test.describe.configure({ mode: 'serial' })

  test('zeigt die Felder aus Payload und speichert Änderungen', async ({ page }) => {
    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto('/office/einstellungen?teil=integrationen')
    await expect(page.locator('h2')).toContainText('Integrationen', { timeout: 30_000 })

    // Die Gruppen aus Payload müssen alle da sein
    for (const gruppe of ['E-Mail-Versand', 'Postfächer', 'Takt', 'Sicherung', 'Stripe']) {
      await expect(page.locator('legend', { hasText: gruppe }).first()).toBeVisible({
        timeout: 15_000,
      })
    }

    // Schlüssel sind verdeckt, lassen sich aber aufdecken
    const verdeckt = await page.locator('input[type="password"]').count()
    expect(verdeckt, 'Zugangsdaten sind verdeckt').toBeGreaterThan(0)
    await page.getByRole('button', { name: 'zeigen' }).first().click()
    expect(await page.locator('input[type="password"]').count()).toBe(verdeckt - 1)

    // Einen Wert ändern und speichern
    const marke = `Prüfstand ${Date.now()}`
    const feld = page.locator('label.buero-feld', { hasText: 'Absender-Name' }).locator('input')
    await feld.fill(marke)
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.locator('.buero-hinweis')).toContainText('Gespeichert', { timeout: 20_000 })

    // Und wirklich angekommen: frisch laden
    await page.reload()
    await expect(
      page.locator('label.buero-feld', { hasText: 'Absender-Name' }).locator('input'),
    ).toHaveValue(marke, { timeout: 30_000 })
  })

  /**
   * Am Telefon war die Seite eine Sackgasse.
   *
   * Die Reiter liehen sich die Klasse der Hauptnavigation, und die wird unter
   * 720 px ausgeblendet — dort übernimmt die Leiste am unteren Rand ihre
   * Aufgabe. Für Reiter *innerhalb* einer Seite tut sie das nicht: Sichtbar
   * blieb nur der erste Abschnitt, und an Benutzer, Betrieb und Integrationen
   * kam man am Handy überhaupt nicht mehr heran. Am Rechner sah alles richtig
   * aus, und genau deshalb steht hier eine Fenstergröße drin.
   */
  test('die Abschnitte sind auch am Telefon erreichbar', async ({ browser }) => {
    const telefon = await browser.newContext({ viewport: { width: 390, height: 844 } })
    const seite = await telefon.newPage()

    await seite.goto('/office/login')
    await seite.waitForLoadState('networkidle')
    await seite.fill('input[type="email"]', EMAIL)
    await seite.fill('input[type="password"]', PASSWORT!)
    await seite.locator('form button[type="submit"]').first().click()
    await seite.waitForURL(/\/office$/, { timeout: 30_000 })

    await seite.goto('/office/einstellungen')
    for (const teil of ['Dieses Gerät', 'Mein Konto', 'Benutzer', 'Betrieb', 'Integrationen']) {
      await expect(seite.getByRole('link', { name: teil }), teil).toBeVisible({ timeout: 20_000 })
    }

    // Und sie führen auch irgendwohin
    await seite.getByRole('link', { name: 'Benutzer' }).click()
    await expect(seite.locator('h2')).toContainText('Benutzer', { timeout: 20_000 })

    await telefon.close()
  })

  test('ohne Anmeldung verschlossen', async ({ playwright }) => {
    const frisch = await playwright.request.newContext()
    const antwort = await frisch.get(`${BASIS}/api/office/einstellungen?bereich=integrationen`, {
      headers: WIE_IM_BROWSER,
    })
    expect(antwort.status()).toBe(403)
    await frisch.dispose()
  })
})
