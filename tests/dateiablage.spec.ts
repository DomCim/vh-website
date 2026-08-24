import { expect, test } from '@playwright/test'

/**
 * Einfügen und Fallenlassen an den Dateiauswahlen.
 *
 * Geprüft wird am Maßanfertigungs-Formular, weil das ohne Anmeldung und ohne
 * eingerichtete Zugänge erreichbar ist. Der Haken selbst ist überall
 * derselbe (`lib/buero/dateiablage.ts`) — was hier hält, hält auch am Beleg
 * und an der Werkstattdatei.
 *
 * Die drei Fälle sind die, an denen es beim Bauen gescheitert wäre:
 * Eingefügtes kommt an, Einfügen wird dem Schreibfeld nicht weggenommen, und
 * eine fallengelassene Datei ersetzt nicht die Seite (sonst wäre alles
 * Getippte weg).
 */

const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const ABLAGE = '.border-dashed'

/** Ein Bild als Ereignis in die Seite geben — ohne echtes Betriebssystem-Ziehen */
async function schicken(
  seite: import('@playwright/test').Page,
  art: 'paste' | 'drop',
  ziel: string,
  name: string,
) {
  await seite.evaluate(
    ({ art, ziel, name }) => {
      const daten = new DataTransfer()
      daten.items.add(new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' }))
      const el = document.querySelector(ziel) as HTMLElement
      if (art === 'paste') {
        el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: daten, bubbles: true }))
        return
      }
      for (const schritt of ['dragenter', 'dragover', 'drop']) {
        el.dispatchEvent(
          new DragEvent(schritt, { dataTransfer: daten, bubbles: true, cancelable: true }),
        )
      }
    },
    { art, ziel, name },
  )
}

test.describe('Dateien einfügen und fallen lassen', () => {
  test.beforeEach(async ({ page }) => {
    // Der Upload geht sonst wirklich hinaus — die Antwort wird hier gestellt
    await page.route('**/api/upload', (weg) =>
      weg.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 1, datei: 'probe.png' }),
      }),
    )
    await page.goto(`${BASIS}/de/massanfertigung`)
    await expect(page.locator(ABLAGE)).toBeVisible()
  })

  test('ein eingefügtes Bild wird angenommen', async ({ page }) => {
    await schicken(page, 'paste', ABLAGE, 'probe.png')
    await expect(page.getByText('probe.png')).toBeVisible()
  })

  test('im Schreibfeld bleibt Einfügen dem Text', async ({ page }) => {
    await schicken(page, 'paste', 'textarea[name="message"]', 'probe.png')
    await expect(page.getByText('probe.png')).toHaveCount(0)
  })

  test('eine fallengelassene Datei ersetzt nicht die Seite', async ({ page }) => {
    await schicken(page, 'drop', ABLAGE, 'probe.png')
    await expect(page.getByText('probe.png')).toBeVisible()
    // Die Seite steht noch — der Browser hat das Bild nicht selbst geöffnet
    expect(new URL(page.url()).pathname).toBe('/de/massanfertigung')
  })
})
