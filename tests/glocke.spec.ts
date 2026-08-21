import { expect, test } from '@playwright/test'

/**
 * Die Glocke in der Kopfleiste und die Zähler an der Navigation.
 *
 * Geprüft wird das, was sich an der Oberfläche nicht rechnen lässt: dass die
 * Glocke da ist, dass ihr Blatt aufgeht und wieder zu, und — der eigentliche
 * Grund für diesen Test — dass die Kopfleiste am Handy davon nicht zweizeilig
 * wird. Dort ist es eng: Neben dem Namen der offenen Seite stehen jetzt zwei
 * runde Flächen zu je 44 Pixeln.
 *
 * Was gezählt wird, steht in tests/meldungen.spec.ts — dafür braucht es
 * keinen Server.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/** Höher als das darf die Kopfleiste am Handy nicht werden — sonst ist sie zweizeilig. */
const KOPF_HOECHSTENS = 96

async function anmelden(seite: import('@playwright/test').Page) {
  await seite.goto(`${BASIS}/office/login`, { waitUntil: 'networkidle' })
  // Erst wenn die Seite im Browser lebt, nimmt das Formular Eingaben an
  await seite.waitForTimeout(1500)
  await seite.locator('input[autocomplete="username"]').fill(EMAIL)
  await seite.locator('input[autocomplete="current-password"]').fill(PASSWORT as string)
  await seite.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await seite.waitForURL(/\/office$/, { timeout: 30000 })
}

test.describe('Meldungen', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('die Glocke öffnet ihr Blatt und schließt es wieder', async ({ page }) => {
    await anmelden(page)

    const glocke = page.locator('.buero-glocke')
    await expect(glocke).toBeVisible()

    await glocke.click()
    const blatt = page.getByRole('dialog', { name: 'Meldungen' })
    await expect(blatt).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(blatt).toBeHidden()

    // Der Weg zur ganzen Liste führt aus dem Blatt heraus
    await glocke.click()
    await blatt.getByRole('link', { name: 'Alle Meldungen' }).click()
    await expect(page).toHaveURL(/\/office\/meldungen$/)
    await expect(page.getByRole('heading', { name: 'Meldungen', level: 1 })).toBeVisible()
  })

  test('auf der Anmeldeseite gibt es keine Glocke', async ({ page }) => {
    // Ohne Anmeldung gibt es keinen Bestand — eine Glocke verspräche dort eine
    // Liste, die es nicht geben kann.
    await page.goto(`${BASIS}/office/login`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await expect(page.locator('.buero-glocke')).toHaveCount(0)
  })

  test('am Handy bleibt die Kopfleiste einzeilig und der Seitenname sichtbar', async ({
    browser,
  }) => {
    const kontext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    })
    const seite = await kontext.newPage()
    try {
      await anmelden(seite)
      await seite.goto(`${BASIS}/office/rechnungen`, { waitUntil: 'networkidle' })
      await seite.waitForTimeout(1500)

      const kopf = await seite.locator('.buero-kopf').boundingBox()
      expect(kopf?.height ?? 0).toBeLessThan(KOPF_HOECHSTENS)

      // Der Name der Seite steht am Handy oben — er darf von Glocke und Punkt
      // gedrückt, aber nicht verdrängt werden
      const titel = await seite.locator('.buero-kopftitel').boundingBox()
      expect(titel?.width ?? 0).toBeGreaterThan(100)

      await expect(seite.locator('.buero-glocke')).toBeVisible()
    } finally {
      await kontext.close()
    }
  })
})
