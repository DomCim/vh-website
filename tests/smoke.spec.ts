import { expect, test } from '@playwright/test'

/**
 * Rauchtests — bewusst wenige, dafür solche, die echte Regressionen fangen:
 * rendert die Website überhaupt, riegelt der MCP-Endpunkt korrekt ab, und
 * antwortet er mit der erwarteten Werkzeugliste.
 */

test('Startseite rendert', async ({ page }) => {
  const antwort = await page.goto('/de')
  expect(antwort?.status()).toBe(200)
  await expect(page.locator('header')).toBeVisible()
})

test('Suche liefert eine Ergebnisseite', async ({ page }) => {
  const antwort = await page.goto('/de/suche?q=stahl')
  expect(antwort?.status()).toBe(200)
  await expect(page.getByRole('searchbox')).toHaveValue('stahl')
})

test('MCP-Endpunkt verlangt einen Schlüssel', async ({ request }) => {
  const antwort = await request.post('/api/mcp', {
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  })
  expect(antwort.status()).toBe(401)
})

test('MCP-Endpunkt liefert mit Schlüssel die Werkzeugliste', async ({ request }) => {
  const schluessel = process.env.MCP_API_KEY
  test.skip(!schluessel, 'Ohne MCP_API_KEY nicht prüfbar')

  const antwort = await request.post(`/api/mcp?key=${schluessel}`, {
    headers: { Accept: 'application/json, text/event-stream' },
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  })
  expect(antwort.ok()).toBe(true)

  // Streamable HTTP antwortet als Server-Sent Event
  const text = await antwort.text()
  const zeile = text
    .split('\n')
    .map((z) => z.replace(/^data: /, ''))
    .find((z) => z.startsWith('{'))
  expect(zeile, 'keine JSON-Antwort im Datenstrom').toBeTruthy()

  const namen: string[] = JSON.parse(zeile!).result.tools.map((w: { name: string }) => w.name)
  expect(namen).toContain('referenzen_liste')
  expect(namen).toContain('bild_hochladen')
  expect(namen.length).toBeGreaterThan(40)
})
