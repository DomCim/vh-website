import { expect, test } from '@playwright/test'

/**
 * Die eigentliche Probe: Büro ohne Netz.
 *
 * Geprüft wird der Fall, für den der ganze Umbau gemacht ist — jemand steht in
 * der Werkstatt, das Netz ist weg, und die App soll trotzdem aufgehen und die
 * Zahlen von vorhin zeigen. Dazu gehört auch, dass sie *sagt*, dass es die von
 * vorhin sind.
 *
 * Der letzte Teil ist der feinste: Eine Detailseite, die vorher nie geöffnet
 * wurde, muss sich ebenfalls öffnen lassen. Das geht, weil der Service Worker
 * Kennungen in der Adresse ersetzt — alle Belege teilen sich eine Hülle, und
 * ihren Inhalt holt sich die Seite aus dem Bestand im Gerät.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

test.describe('Büro ohne Netz', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('öffnet sich, zeigt den letzten Stand und sagt das auch', async ({
    page,
    context,
    request,
  }) => {
    // Ein Partner, der nachher offline dastehen muss
    await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })
    const name = `Offline-Partner ${Date.now()}`
    expect(
      (
        await request.post(`${BASIS}/api/contacts`, {
          headers: WIE_IM_BROWSER,
          data: { name, type: 'lieferant' },
        })
      ).status(),
    ).toBe(201)

    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    // Einmal die Partnerliste öffnen — damit liegt ihre Hülle im Zwischenspeicher
    await page.goto('/office/partner')
    await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 })

    const worker = await page.evaluate(() =>
      navigator.serviceWorker.getRegistration('/office').then((r) => Boolean(r?.active)),
    )
    expect(worker, 'Service Worker steht bereit').toBe(true)

    // ── Netz weg ──
    await context.setOffline(true)

    await page.goto('/office/partner', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1')).toContainText('Geschäftspartner', { timeout: 20_000 })
    await expect(page.getByText(name), 'die Daten von vorhin stehen da').toBeVisible({
      timeout: 20_000,
    })
    await expect(page.locator('.buero-abgleich'), 'und es steht dran, dass sie alt sind')
      .toContainText('Ohne Netz', { timeout: 20_000 })

    // Eine Detailseite, die vorher nie geöffnet wurde
    const kennung = await page.evaluate(
      (gesucht) =>
        new Promise<number | null>((fertig) => {
          const anfrage = indexedDB.open('vh-buero')
          anfrage.onsuccess = () => {
            const alle = anfrage.result
              .transaction('partner', 'readonly')
              .objectStore('partner')
              .getAll()
            alle.onsuccess = () =>
              fertig(
                alle.result.find((p: { name: string; id: number }) => p.name === gesucht)?.id ??
                  null,
              )
            alle.onerror = () => fertig(null)
          }
          anfrage.onerror = () => fertig(null)
        }),
      name,
    )
    expect(kennung).toBeTruthy()

    await page.goto(`/office/partner/${kennung}`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('h1'), 'nie geöffnete Detailseite geht trotzdem auf').toContainText(
      name,
      { timeout: 20_000 },
    )
  })
})
