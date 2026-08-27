import { expect, test } from '@playwright/test'

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Der Ablauf lässt sich im Büro anlegen und umbauen — nicht nur abhaken.
 *
 * Bis hierher versprach der Leertext „hier von Hand anlegen", und es gab
 * keinen Knopf dafür: Ein Auftrag ohne Artikel (Lohnfertigung) stand ohne
 * Ablauf da, und niemand konnte einen eintragen. Der Test geht den Weg, den
 * Vincent geht — Auftrag öffnen, Schritte antippen, speichern, wiederkommen.
 */
test.describe('Ablauf-Editor', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Schritte anlegen, umsortieren, löschen am Auftrag', async ({ page, request }) => {
    // Einen frischen Auftrag über die API — der Test räumt sein eigenes Feld
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    test.skip(!token, 'Anmeldung fehlgeschlagen — läuft der Server?')
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: { title: `Ablauf-Probe ${Date.now()}`, positions: [{ description: 'Probestück' }] },
    })
    expect(angelegt.ok()).toBe(true)
    const { id } = (await angelegt.json()) as { id: number }

    // Im Browser anmelden und den Auftrag öffnen
    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[autocomplete="username"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto(`/office/auftraege/${id}`)
    await page.getByRole('button', { name: 'Ersten Schritt anlegen' }).click()

    // Zwei Schritte: eigene Arbeit und Fremdleistung
    await page.getByPlaceholder('z.B. Zuschnitt, Schweißen, Verzinken').fill('Schweißen')
    await page.getByRole('button', { name: 'Schritt hinzufügen' }).click()
    const zweiter = page.getByPlaceholder('z.B. Zuschnitt, Schweißen, Verzinken').nth(1)
    await zweiter.fill('Verzinken')
    await page.locator('select').filter({ hasText: 'Eigene Arbeit' }).nth(1).selectOption('fremd')
    // Der Fremd-Schritt zeigt jetzt Betrieb/Kosten/Vorlauf statt Minuten
    await expect(page.getByText('Vorlauf (Tage)')).toBeVisible()

    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Gespeichert.')).toBeVisible({ timeout: 15_000 })

    // Neu laden: Die Schritte stehen noch da, in dieser Reihenfolge
    await page.reload()
    const felder = page.getByPlaceholder('z.B. Zuschnitt, Schweißen, Verzinken')
    await expect(felder.nth(0)).toHaveValue('Schweißen', { timeout: 15_000 })
    await expect(felder.nth(1)).toHaveValue('Verzinken')

    // Umsortieren: Verzinken nach oben
    await page.getByRole('button', { name: 'Verzinken nach oben' }).click()
    await expect(felder.nth(0)).toHaveValue('Verzinken')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Gespeichert.')).toBeVisible({ timeout: 15_000 })

    const stand = await request.get(`${BASIS}/api/jobs/${id}?depth=0`, { headers: kopf })
    const doc = (await stand.json()) as { arbeitsplan?: { was?: string }[] }
    expect((doc.arbeitsplan ?? []).map((s) => s.was)).toEqual(['Verzinken', 'Schweißen'])

    // Löschen: Verzinken entfernen
    await page.getByRole('button', { name: 'Verzinken entfernen' }).click()
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Gespeichert.')).toBeVisible({ timeout: 15_000 })

    const danach = await request.get(`${BASIS}/api/jobs/${id}?depth=0`, { headers: kopf })
    const doc2 = (await danach.json()) as { arbeitsplan?: { was?: string }[] }
    expect((doc2.arbeitsplan ?? []).map((s) => s.was)).toEqual(['Schweißen'])

    // Aufräumen — der Probeauftrag soll die Übersichten nicht füllen
    await request.delete(`${BASIS}/api/jobs/${id}`, { headers: kopf })
  })

  test('die Vorlage am Artikel lässt sich anlegen', async ({ page, request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    test.skip(!token, 'Anmeldung fehlgeschlagen')
    const kopf = { Authorization: `JWT ${token}` }

    const suche = await request.get(`${BASIS}/api/products?limit=1&depth=0&locale=de`, {
      headers: kopf,
    })
    const { docs } = (await suche.json()) as { docs: { id: number }[] }
    test.skip(!docs.length, 'Kein Artikel in der Datenbank')
    const artikelId = docs[0].id

    // Vorlage leeren, damit der Test bei sich anfängt
    await request.post(`${BASIS}/api/office/stueckliste`, {
      headers: kopf,
      data: { produktId: artikelId, zeilen: [], dienstleister: [], arbeitsminuten: 0, ablauf: [] },
    })

    await page.goto('/office/login')
    await page.waitForLoadState('networkidle')
    await page.fill('input[autocomplete="username"]', EMAIL)
    await page.fill('input[type="password"]', PASSWORT!)
    await page.locator('form button[type="submit"]').first().click()
    await page.waitForURL(/\/office$/, { timeout: 30_000 })

    await page.goto(`/office/artikel/${artikelId}`)
    await page.getByRole('button', { name: 'Ersten Schritt anlegen' }).click()
    await page.getByPlaceholder('z.B. Zuschnitt, Schweißen, Verzinken').first().fill('Kanten')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Gespeichert.')).toBeVisible({ timeout: 15_000 })

    const danach = await request.get(`${BASIS}/api/products/${artikelId}?depth=0&locale=de`, {
      headers: kopf,
    })
    const doc = (await danach.json()) as { arbeitsplan?: { was?: string }[] }
    expect((doc.arbeitsplan ?? []).map((s) => s.was)).toEqual(['Kanten'])
  })
})
