import { expect, test } from '@playwright/test'

/**
 * Die eigentliche Probe: Büro ohne Netz.
 *
 * Geprüft wird der Fall, für den der ganze Umbau gemacht ist — jemand steht in
 * der Werkstatt, das Netz ist weg, und die App soll trotzdem aufgehen und die
 * Zahlen von vorhin zeigen. Dazu gehört auch, dass sie *sagt*, dass es die von
 * vorhin sind.
 *
 * Der letzte Teil prüft den Mechanismus statt einer Navigation: Playwright
 * kappt bei `setOffline` nur die Anfragen der Seite, nicht die des Service
 * Workers. Eine Navigation sähe deshalb auch dann gut aus, wenn ohne Server
 * gar nichts ginge. Was im Zwischenspeicher liegt, ist dagegen belastbar —
 * und genau daraus wird die Seite bedient, wenn wirklich niemand antwortet.
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

    // Liste und *eine* Detailseite öffnen — damit liegen beide Hüllen im
    // Zwischenspeicher. Mehr braucht es nicht: Alle Detailseiten eines
    // Bereichs teilen sich eine Hülle.
    await page.goto('/office/partner')
    await expect(page.getByText(name)).toBeVisible({ timeout: 30_000 })
    await page.locator('.buero-zeile').first().click()
    await page.waitForLoadState('networkidle')
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

    /*
     * Was hier bewusst *nicht* über eine Navigation geprüft wird:
     *
     * Playwright kappt bei `setOffline` nur die Anfragen der Seite, nicht die
     * des Service Workers — der holt weiter vom laufenden Server. Eine
     * Navigation sagt hier also nichts darüber aus, ob sie auch ohne Server
     * gelänge; sie sah nur so aus. (Nachgemessen: `/office/steuer` lieferte
     * „offline" den echten Steuer-Export.)
     *
     * Nachweisbar ist dagegen der Mechanismus dahinter — was im
     * Zwischenspeicher liegt. Genau daraus wird die Seite bedient, wenn
     * wirklich kein Server da ist.
     */
    // Der Vorrat füllt sich nebenher, damit das Büro sofort bedienbar ist —
    // hier wird gewartet, bis er steht.
    await page
      .waitForFunction(
        async () => {
          const cache = await caches.open('vh-buero-geruest')
          const pfade = (await cache.keys()).map((a) => new URL(a.url).pathname)
          return pfade.some((p) => p.includes('/chunks/app/(office)/office/partner/page-'))
        },
        null,
        { timeout: 60_000, polling: 1_000 },
      )
      .catch(() => undefined)

    const abgelegt = await page.evaluate(async () => {
      const cache = await caches.open('vh-buero-geruest')
      return (await cache.keys()).map((a) => new URL(a.url).pathname)
    })

    expect(abgelegt, 'die Liste liegt bereit').toContain('/office/partner')
    expect(abgelegt, 'und eine Hülle für alle Detailseiten des Bereichs').toContain(
      '/office/partner/_',
    )
    expect(abgelegt, 'dazu die Auskunft für alles, was nie geladen wurde').toContain(
      '/office-nicht-geladen.html',
    )

    // Das Gerüst selbst — ohne das käme man nach dem Schließen nicht mehr hinein
    expect(abgelegt.some((p) => p.startsWith('/_next/static/')), 'Skripte und Stile').toBe(true)

    /*
     * Und die Skripte der einzelnen Ansichten.
     *
     * Sie liegen unter `/_next/static/chunks/app/(office)/…` — die Klammern
     * gehören zum Ordnernamen. Wer sie beim Auslesen der Seite für das Ende
     * der Adresse hält, merkt sich nichts, und ohne Netz bleiben genau die
     * Ansichten leer, die ihren Inhalt erst im Browser aufbauen (Belege,
     * Rechnungen, Kalender, Einstellungen). Das sah lange gut aus, weil die
     * übrigen Seiten ihren Titel schon fertig mitbringen.
     */
    const seitenSkripte = abgelegt.filter((p) => p.includes('/chunks/app/'))
    expect(seitenSkripte.length, 'die Skripte der einzelnen Ansichten').toBeGreaterThan(10)
    expect(
      seitenSkripte.some((p) => p.includes('/office/partner/page-')),
      'darunter das der Partnerliste — mit Klammern im Pfad',
    ).toBe(true)

    /*
     * Nachschlagen muss auch klappen, nicht nur Ablegen.
     *
     * Die Antworten tragen `Vary: Sec-CH-Prefers-Color-Scheme, Accept-Encoding`.
     * Ohne `ignoreVary` vergleicht der Browser diese Kopfzeilen mit — und die
     * stimmen zwischen Ablegen und Abrufen nie überein. Der Zwischenspeicher
     * sah dann gefüllt aus und antwortete trotzdem auf jede Frage mit nichts.
     */
    const gefunden = await page.evaluate(async () => {
      const cache = await caches.open('vh-buero-geruest')
      const quellen = [...document.querySelectorAll('script[src^="/_next/static/"]')].map((s) =>
        s.getAttribute('src'),
      )
      const treffer = await Promise.all(
        quellen.map((q) => cache.match(q as string, { ignoreVary: true }).then(Boolean)),
      )
      return { gesucht: quellen.length, gefunden: treffer.filter(Boolean).length }
    })
    expect(gefunden.gesucht, 'die Seite lädt überhaupt Skripte').toBeGreaterThan(0)
    expect(gefunden.gefunden, 'und jedes davon ist abrufbar').toBe(gefunden.gesucht)
  })
})
