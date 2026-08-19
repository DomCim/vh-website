import { expect, test } from '@playwright/test'

/**
 * Prüft, dass die Verwaltung ihre Felder tatsächlich anzeigt.
 *
 * Anlass ist ein Fehler, der genau so gebaut war, dass ihn niemand bemerkt:
 * Felder in einer Zeile (`type: 'row'`) innerhalb einer Gruppe wurden im
 * Admin still weggelassen — Typprüfung, Lint und Build waren zufrieden, die
 * Einstellungen für Sicherung und Takt aber schlicht unsichtbar. Deshalb wird
 * hier im echten Browser nachgesehen.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT

test.describe('Verwaltung', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')
  // Nacheinander: Beide Prüfungen arbeiten an denselben Einstellungen, und
  // parallel würden sie sich gegenseitig die Werte umschreiben.
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/login')
    await page.fill('#field-email', EMAIL)
    await page.fill('#field-password', PASSWORT!)
    // Der Passkey-Knopf steht daneben — hier ist das Anmeldeformular gemeint
    await page.locator('form.login__form button[type="submit"], form button[type="submit"]').first().click()
    await page.waitForTimeout(4000)
  })

  test('Integrationen zeigen alle Einstellungen', async ({ page }) => {
    await page.goto('/admin/globals/integrations')
    await page.waitForTimeout(5000)

    for (const id of [
      'field-wartung__aktiv',
      'field-wartung__intervalMinuten',
      'field-wartung__postfachMinuten',
      'field-wartung__mailprotokollMonate',
      'field-sicherung__protokoll',
      'field-sicherung__smbServer',
      'field-sicherung__smbFreigabe',
      'field-sicherung__smbBenutzer',
      'field-sicherung__uhrzeit',
      'field-sicherung__behaltenLokal',
      'field-sicherung__behaltenNas',
    ]) {
      await expect(page.locator(`#${id}`), id).toBeVisible()
    }

    // Die WebDAV-Felder gehören sich versteckt, solange Samba gewählt ist
    await expect(page.locator('#field-sicherung__webdavUrl')).toHaveCount(0)
  })

  test('Geheimnisse sind verdeckt, aufdeckbar und speicherbar', async ({ page }) => {
    await page.goto('/admin/globals/integrations')
    await page.waitForTimeout(5000)

    const feld = page.locator('.field-type.text', { hasText: 'Client Secret' }).first()
    const eingabe = feld.locator('input').first()
    await expect(eingabe).toHaveAttribute('type', 'password')

    const wert = `pruef-geheimnis-${Date.now()}`
    await eingabe.fill(wert)
    await eingabe.blur()

    // Kopieren geht auch im verdeckten Zustand
    await expect(feld.locator('.copy-to-clipboard')).toBeVisible()

    await feld.getByRole('button', { name: 'Anzeigen' }).click()
    await expect(eingabe).toHaveAttribute('type', 'text')
    await expect(eingabe).toHaveValue(wert)
    await feld.getByRole('button', { name: 'Verbergen' }).click()
    await expect(eingabe).toHaveAttribute('type', 'password')

    // Und was eingetippt wurde, muss auch ankommen
    await page.locator('button.btn--style-primary').filter({ hasText: /Save|Speichern/ }).first().click()
    await page.waitForTimeout(3000)
    const gespeichert = await page.evaluate(async () => {
      const antwort = await fetch('/api/globals/integrations?depth=0', { credentials: 'include' })
      return (await antwort.json())?.paypal?.clientSecret
    })
    expect(gespeichert).toBe(wert)
  })
})
