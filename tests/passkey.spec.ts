import { expect, test } from '@playwright/test'

/**
 * Anmelden mit Face ID, Fingerabdruck oder Geräte-PIN — von Anfang bis Ende.
 *
 * Möglich wird das durch den virtuellen Authentikator, den Chromium
 * mitbringt: Er tut so, als läge ein Finger auf dem Sensor. Damit lässt sich
 * die ganze Kette prüfen, ohne ein Gesicht.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT

test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

test('Passkey anlegen, abmelden, wieder anmelden', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })

  // 1. Mit Passwort anmelden
  await page.goto('/admin/login')
  // Seit der Anmeldung mit Benutzernamen heißt das Feld im Admin anders —
  // je nach Payload-Fassung #field-username oder weiter #field-email.
  await page.locator('#field-username, #field-email').first().fill(EMAIL)
  await page.fill('#field-password', PASSWORT!)
  // Der Passkey-Knopf steht daneben — hier ist das Anmeldeformular gemeint
    await page.locator('form.login__form button[type="submit"], form button[type="submit"]').first().click()
  await page.waitForTimeout(4000)

  // 2. Passkey am eigenen Konto einrichten
  await page.goto('/admin/account')
  await page.waitForTimeout(5000)
  const knopf = page.getByRole('button', { name: 'Dieses Gerät hinzufügen' })
  await expect(knopf).toBeVisible({ timeout: 15000 })
  await knopf.click()
  await expect(page.getByText(/ist eingerichtet/)).toBeVisible({ timeout: 20000 })

  // 3. Abmelden
  await page.goto('/admin/logout')
  await page.waitForTimeout(3000)
  await page.context().clearCookies()

  // 4. Nur mit dem Gerät anmelden — kein Passwort, kein Code
  await page.goto('/office/login')
  await page.waitForTimeout(2000)
  const passkeyKnopf = page.getByRole('button', { name: /Face ID/ })
  await expect(passkeyKnopf).toBeVisible()
  await passkeyKnopf.click()
  await page.waitForURL(/\/office(\/|$)/, { timeout: 20000 })
  await expect(page.locator('h1')).toContainText('Übersicht', { timeout: 15000 })
})
