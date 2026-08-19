import { expect, test } from '@playwright/test'

/**
 * Schreiben ohne Netz.
 *
 * Lesen ohne Netz war der halbe Weg. Das hier ist der, der im Alltag zählt:
 * In der Werkstatt einen Partner anlegen, während das Netz weg ist — die
 * Eingabe muss augenblicklich dastehen, sichtbar als noch nicht abgeschickt,
 * und beim nächsten Netz von selbst beim Server ankommen.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

test.describe('Schreiben ohne Netz', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Eingabe steht sofort, geht später von selbst raus', async ({ page, context, request }) => {
    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    // Beide Seiten einmal öffnen, damit ihre Hüllen im Zwischenspeicher liegen
    await page.goto('/office/partner')
    await page.waitForLoadState('networkidle')
    await page.goto('/office/partner/neu')
    await page.waitForLoadState('networkidle')

    /*
     * Erst wenn der Service Worker steht, darf das Netz weg.
     *
     * Ohne ihn bedient niemand die Seite, und die Probe scheitert mit
     * `ERR_INTERNET_DISCONNECTED` an einer Stelle, die mit der Warteschlange
     * gar nichts zu tun hat. Einbau und Aktivierung brauchen auf einem
     * ausgelasteten Prüfläufer länger als hier.
     */
    await page
      .waitForFunction(
        () => navigator.serviceWorker.getRegistration('/office').then((r) => Boolean(r?.active)),
        null,
        { timeout: 60_000, polling: 500 },
      )
      .catch(() => undefined)

    // ── Netz weg ──
    await context.setOffline(true)

    const name = `Werkstattpartner ${Date.now()}`
    await page.locator('input').first().fill(name)
    await page.getByRole('button', { name: /speichern|anlegen/i }).first().click()

    // Steht augenblicklich in der Liste — ohne dass der Server davon weiß
    await page.goto('/office/partner', { waitUntil: 'domcontentloaded' })
    await expect(page.getByText(name), 'Eingabe ist sofort da').toBeVisible({ timeout: 20_000 })
    await expect(page.locator('.buero-abgleich'), 'und sie ist als wartend gekennzeichnet')
      .toContainText('warte', { timeout: 20_000 })

    // Beim Server ist sie noch nicht
    const vorher = await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(vorher.ok()).toBeTruthy()
    const jetztDa = async () => {
      const antwort = await request.get(`${BASIS}/api/contacts?limit=300`, {
        headers: WIE_IM_BROWSER,
      })
      const { docs } = await antwort.json()
      return (docs ?? []).some((d: { name: string }) => d.name === name)
    }
    expect(await jetztDa(), 'noch nicht beim Server').toBe(false)

    // ── Netz wieder da ──
    await context.setOffline(false)
    await expect.poll(jetztDa, { timeout: 45_000 }).toBe(true)

    // Und die Schlange ist leer
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              new Promise<number>((fertig) => {
                const anfrage = indexedDB.open('vh-buero')
                anfrage.onsuccess = () => {
                  const zaehlung = anfrage.result
                    .transaction('warteschlange', 'readonly')
                    .objectStore('warteschlange')
                    .count()
                  zaehlung.onsuccess = () => fertig(zaehlung.result)
                  zaehlung.onerror = () => fertig(-1)
                }
                anfrage.onerror = () => fertig(-1)
              }),
          ),
        { timeout: 30_000 },
      )
      .toBe(0)
  })

  test('Beleg-Foto aus der Werkstatt geht später von selbst raus', async ({
    page,
    context,
    request,
  }) => {
    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto('/office/belege/neu')
    await page.waitForLoadState('networkidle')

    // ── Netz weg, dann fotografieren ──
    await context.setOffline(true)

    // Ein winziges PNG steht hier fürs Foto
    const bild = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const name = `Werkstattbeleg ${Date.now()}`
    await page.locator('input[type="file"]').setInputFiles({
      name: 'beleg.png',
      mimeType: 'image/png',
      buffer: bild,
    })
    await expect(page.locator('.buero-hinweis')).toContainText('im Gerät', { timeout: 20_000 })

    // Pflichtangaben ausfüllen und speichern
    await page.getByLabel('Bezeichnung').fill(name)
    await page.getByLabel('Rechnungsdatum').fill('2026-08-19')
    await page.getByLabel(/Brutto/).first().fill('42')
    await page.getByRole('button', { name: /speichern/i }).first().click()
    await expect(page.locator('.buero-hinweis')).toContainText('Gemerkt', { timeout: 20_000 })

    // ── Netz wieder da ──
    await context.setOffline(false)
    await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })

    await expect
      .poll(
        async () => {
          const antwort = await request.get(`${BASIS}/api/expenses?limit=300&depth=1`, {
            headers: WIE_IM_BROWSER,
          })
          const { docs } = await antwort.json()
          const beleg = (docs ?? []).find((d: { title: string }) => d.title === name)
          // Und der Scan muss daran hängen — sonst zählt die Buchung nicht
          return Boolean(beleg && beleg.document)
        },
        { timeout: 90_000 },
      )
      .toBe(true)
  })

  test('was der Server abweist, bleibt liegen und lässt sich verwerfen', async ({ page }) => {
    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[type="email"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto('/office/einstellungen?teil=geraet')
    await page.waitForLoadState('networkidle')

    /*
     * Ein Eintrag, den der Server nicht annehmen kann — ein Partner ohne
     * Namen. Über das Formular ginge das nicht, das fängt es vorher ab; hier
     * wird er direkt in die Schlange gelegt, so wie er dort läge, wenn eine
     * ältere Fassung der App ihn eingereiht hätte.
     */
    await page.evaluate(
      () =>
        new Promise<void>((fertig) => {
          const anfrage = indexedDB.open('vh-buero')
          anfrage.onsuccess = () => {
            const vorgang = anfrage.result.transaction('warteschlange', 'readwrite')
            vorgang.objectStore('warteschlange').put({
              pfad: '/api/office/partner',
              bereich: 'partner',
              koerper: {},
              versuche: 0,
              zeit: Date.now(),
            })
            vorgang.oncomplete = () => fertig()
            vorgang.onerror = () => fertig()
          }
          anfrage.onerror = () => fertig()
        }),
    )

    // Beim nächsten Öffnen nimmt sich die Schlange den Eintrag vor
    await page.reload()

    // Er wird nicht endlos wiederholt und nicht heimlich weggeworfen
    await expect(page.getByText('Nicht angekommen')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.buero-abgleich')).toContainText('abgelehnt', { timeout: 20_000 })

    // Verwerfen räumt ihn weg
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'verwerfen' }).first().click()
    await expect(page.getByText('Nicht angekommen')).toBeHidden({ timeout: 20_000 })
  })
})
