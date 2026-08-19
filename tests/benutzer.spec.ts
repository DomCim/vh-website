import { expect, test } from '@playwright/test'

/**
 * Benutzerverwaltung im Büro.
 *
 * Der Teil, der wirklich schützenswert ist, sind die beiden Sperren: Man kann
 * sich nicht selbst löschen, und der letzte Inhaber bleibt Inhaber. Ohne die
 * wäre man mit einem Klick aus dem eigenen Haus ausgesperrt, und niemand
 * könnte einen wieder hereinlassen.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

test.describe('Benutzerverwaltung', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('legt an, ändert und schützt vor dem Aussperren', async ({ request }) => {
    await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })

    const rufen = (daten: Record<string, unknown>) =>
      request.post(`${BASIS}/api/office/benutzer`, { headers: WIE_IM_BROWSER, data: daten })

    const liste = await request.get(`${BASIS}/api/office/benutzer`, { headers: WIE_IM_BROWSER })
    expect(liste.status()).toBe(200)
    const { ich } = await liste.json()
    expect(ich).toBeTruthy()

    // Anlegen
    const email = `pruef-${Date.now()}@vincent-hellmann.com`
    const angelegt = await rufen({
      aktion: 'anlegen',
      email,
      name: 'Prüfkonto',
      role: 'redaktion',
      passwort: 'pruef-geheim-123',
    })
    expect(angelegt.status()).toBe(200)
    const { id } = await angelegt.json()

    // Rolle ändern
    expect((await rufen({ aktion: 'aendern', id, role: 'inhaber' })).status()).toBe(200)

    // Sich selbst löschen: verboten
    const selbst = await rufen({ aktion: 'loeschen', id: ich })
    expect(selbst.status()).toBe(400)
    expect((await selbst.json()).error).toBe('nicht-sich-selbst')

    // Zu kurzes Passwort: verboten
    const kurz = await rufen({ aktion: 'passwort', id, passwort: 'kurz' })
    expect(kurz.status()).toBe(400)

    // Aufräumen
    expect((await rufen({ aktion: 'loeschen', id })).status()).toBe(200)
  })

  test('ohne Anmeldung verschlossen', async ({ playwright }) => {
    const frisch = await playwright.request.newContext()
    expect(
      (await frisch.get(`${BASIS}/api/office/benutzer`, { headers: WIE_IM_BROWSER })).status(),
    ).toBe(403)
    await frisch.dispose()
  })
})
