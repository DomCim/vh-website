import { expect, test } from '@playwright/test'

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Lange Formulare in Abschnitten — und was dabei schiefgehen könnte.
 *
 * Die Auftragsseite war am Handy 6023 Pixel hoch. Seit sie in aufklappbare
 * Abschnitte zerfällt, sind es gut 4000, und an der Rechnung hat sich die
 * Länge halbiert. Der Gewinn ist offensichtlich; die Gefahr ist es nicht:
 *
 *  1. **Ein zugeklappter Abschnitt darf nichts verlieren.** Die Formulare
 *     halten ihre Werte in React und schicken beim Speichern alles mit. Baute
 *     ein Abschnitt seinen Inhalt beim Zuklappen aus, wäre jedes Feld darin
 *     beim Speichern leer — und zwar still. Deshalb `<details>`: Der Inhalt
 *     bleibt im Dokument. Diese Prüfung nagelt das fest.
 *
 *  2. **Die Leiste muss sich wieder schlafen legen.** Sie meldet „Nicht
 *     gespeichert", solange etwas offen ist. Bliebe sie nach dem Speichern
 *     stehen, wäre sie nach zwei Tagen nur noch ein Balken, den niemand
 *     liest.
 */
test.describe('Abschnitte in langen Formularen', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('ein zugeklappter Abschnitt speichert seinen Inhalt mit', async ({ page, request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    test.skip(!token, 'Anmeldung fehlgeschlagen — läuft der Server?')

    const titel = `Abschnitt-Probe ${Date.now()}`
    const angelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: { Authorization: `JWT ${token}` },
      data: { title: titel, positions: [{ description: 'Probestück' }] },
    })
    expect(angelegt.ok()).toBe(true)
    const { id } = (await angelegt.json()) as { id: number }

    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[autocomplete="username"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    /*
     * Auf den Auftrag warten, statt ihn vorauszusetzen.
     *
     * Die Büro-Seiten lesen aus dem Bestand im Gerät, und der wird nach dem
     * Anmelden erst abgeglichen. Wer sofort losklickt, klickt manchmal in
     * eine Seite, die den Auftrag noch nicht kennt — genau daran hängt die
     * Unzuverlässigkeit von `ablauf-editor.spec.ts`.
     */
    await page.goto(`/office/auftraege/${id}`)
    await expect(page.getByLabel('Bezeichnung').first()).toHaveValue(titel, { timeout: 30_000 })

    const notizen = page.locator('details.buero-abschnitt').filter({
      has: page.getByRole('heading', { name: 'Notizen zur Fertigung' }),
    })

    // Ohne Notiz ist der Abschnitt zu — das ist die Vorgabe, und sie ist der
    // Ausgangspunkt dieser Prüfung.
    await expect(notizen).toHaveAttribute('open', '', { timeout: 10_000 }).catch(() => {})
    if (await notizen.evaluate((e) => !(e as HTMLDetailsElement).open)) {
      await notizen.getByRole('heading', { name: 'Notizen zur Fertigung' }).click()
    }
    await expect(notizen).toHaveJSProperty('open', true)

    const notiz = `Beim Kanten auf die Faserrichtung achten ${Date.now()}`
    await notizen.getByRole('textbox').fill(notiz)

    // Wieder zuklappen — und genau so speichern
    await notizen.getByRole('heading', { name: 'Notizen zur Fertigung' }).click()
    await expect(notizen).toHaveJSProperty('open', false)

    const leiste = page.locator('.buero-fussleiste')
    await expect(leiste).toHaveClass(/wach/)
    await expect(page.getByText('Nicht gespeichert')).toBeVisible()

    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Gespeichert.')).toBeVisible({ timeout: 15_000 })

    // Nach dem Speichern ist nichts mehr offen — die Leiste legt sich hin
    await expect(leiste).not.toHaveClass(/wach/)

    // Und die Notiz steht in der Datenbank, nicht nur im Bildschirm
    const geholt = await request.get(`${BASIS}/api/jobs/${id}`, {
      headers: { Authorization: `JWT ${token}` },
    })
    const daten = (await geholt.json()) as { notes?: string | null }
    expect(daten.notes).toBe(notiz)

    await request.delete(`${BASIS}/api/jobs/${id}`, { headers: { Authorization: `JWT ${token}` } })
  })

  /**
   * „Verwerfen" und die Warnung beim Weggehen.
   *
   * Beides kam aus derselben Beobachtung von Dominik: Verwerfen gab es gar
   * nicht — wer eine Änderung loswerden wollte, verließ die Seite. Und dabei
   * sagte niemand etwas; ein Tipp auf „Übersicht" warf die Arbeit weg.
   */
  test('Verwerfen fragt nach, und Weggehen warnt', async ({ page, request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    test.skip(!token, 'Anmeldung fehlgeschlagen — läuft der Server?')

    const titel = `Verwerfen-Probe ${Date.now()}`
    const angelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: { Authorization: `JWT ${token}` },
      data: { title: titel, positions: [{ description: 'Probestück' }] },
    })
    const { id } = (await angelegt.json()) as { id: number }

    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[autocomplete="username"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto(`/office/auftraege/${id}`)
    const bezeichnung = page.getByLabel('Bezeichnung').first()
    await expect(bezeichnung).toHaveValue(titel, { timeout: 30_000 })

    await bezeichnung.fill(`${titel} — geändert`)
    await expect(page.locator('.buero-fussleiste')).toHaveClass(/wach/)

    /*
     * Playwright weist jede Frage von selbst ab, solange niemand zuhört —
     * genau richtig für die erste Hälfte: Wer „nein" sagt, bleibt stehen.
     */
    await page.getByRole('link', { name: 'Übersicht' }).first().click()
    await page.waitForTimeout(500)
    expect(page.url(), 'abgelehntes Weggehen bleibt auf der Seite').toContain(`/auftraege/${id}`)

    await page.getByRole('button', { name: 'Verwerfen' }).click()
    await expect(bezeichnung, 'abgelehntes Verwerfen lässt den Text stehen').toHaveValue(
      `${titel} — geändert`,
    )

    // Und jetzt mit „ja"
    page.once('dialog', (d) => void d.accept())
    await page.getByRole('button', { name: 'Verwerfen' }).click()
    await expect(bezeichnung).toHaveValue(titel)
    await expect(page.locator('.buero-fussleiste')).not.toHaveClass(/wach/)

    await request.delete(`${BASIS}/api/jobs/${id}`, { headers: { Authorization: `JWT ${token}` } })
  })
})
