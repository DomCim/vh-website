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
    await page.fill('input[autocomplete="username"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto('/office/einstellungen?teil=integrationen')
    await expect(page.locator('h2')).toContainText('Integrationen', { timeout: 30_000 })

    // Die Gruppen aus Payload müssen alle da sein
    for (const gruppe of ['E-Mail-Versand', 'Postfächer', 'Takt', 'Sicherung', 'PayPal']) {
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
   * Ein neues Postfach anlegen.
   *
   * Der Fehler dahinter war hässlich und leicht zu übersehen: Beim Setzen
   * eines Werts wurde die Liste mit `{ ...liste }` kopiert — und damit aus
   * `[{…}]` ein `{ '0': {…} }`. Beim Anzeigen fragt das Formular
   * `Array.isArray` und fand nichts mehr. Für den Menschen davor sah es aus,
   * als klappte der Eintrag beim ersten Buchstaben wieder zu.
   *
   * Geprüft wird deshalb genau der Ablauf von Hand: hinzufügen, tippen, und
   * der Eintrag muss stehen bleiben — mit dem, was schon getippt war.
   */
  test('ein Postfach anlegen: der Eintrag bleibt beim Tippen stehen', async ({ page }) => {
    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[autocomplete="username"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto('/office/einstellungen?teil=integrationen')
    await expect(page.locator('h2')).toContainText('Integrationen', { timeout: 30_000 })

    const postfaecher = page.locator('fieldset.buero-karte', { has: page.locator('legend', { hasText: 'Postfächer' }) })
    await expect(postfaecher).toBeVisible({ timeout: 15_000 })
    await postfaecher.getByRole('button', { name: 'Hinzufügen' }).click()

    const bezeichnung = postfaecher.locator('label.buero-feld', { hasText: 'Bezeichnung' }).locator('input')
    await expect(bezeichnung).toBeVisible()

    // Buchstabe für Buchstabe — genau hier verschwand der Eintrag
    await bezeichnung.pressSequentially('Info', { delay: 60 })
    await expect(bezeichnung).toHaveValue('Info')
    await expect(postfaecher.getByRole('button', { name: 'Entfernen' })).toHaveCount(1)

    // Und die übrigen Felder des Eintrags stehen auch noch da
    for (const feld of ['E-Mail-Adresse', 'IMAP-Server', 'Benutzername']) {
      await expect(
        postfaecher.locator('label.buero-feld', { hasText: feld }).first(),
      ).toBeVisible()
    }

    /*
     * Unvollständig speichern muss sagen, was fehlt. Vorher stand da nur
     * „Das hat nicht geklappt." — bei fünf Pflichtfeldern ein Ratespiel.
     */
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.locator('.buero-hinweis')).toContainText('nicht geklappt', {
      timeout: 20_000,
    })
    await expect(page.locator('.buero-hinweis')).not.toHaveText('Das hat nicht geklappt.')

    // Wieder weg damit — der Prüfstand soll nichts hinterlassen
    await postfaecher.getByRole('button', { name: 'Entfernen' }).click()
    await expect(postfaecher.getByRole('button', { name: 'Entfernen' })).toHaveCount(0)
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
    await seite.fill('input[autocomplete="username"]', EMAIL)
    await seite.fill('input[type="password"]', PASSWORT!)
    await seite.locator('form button[type="submit"]').first().click()
    await seite.waitForURL(/\/office$/, { timeout: 30_000 })

    await seite.goto('/office/einstellungen')
    for (const teil of ['Dieses Gerät', 'Mein Konto', 'Benutzer', 'Betrieb', 'Integrationen']) {
      await expect(seite.getByRole('link', { name: teil }), teil).toBeVisible({ timeout: 20_000 })
    }

    // Und sie führen auch irgendwohin. Seit die Rollen mit auf dem Blatt
    // stehen, gibt es dort mehrere Überschriften — gemeint ist die erste.
    await seite.getByRole('link', { name: 'Benutzer' }).click()
    await expect(seite.locator('h2').first()).toContainText('Benutzer', { timeout: 20_000 })

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
