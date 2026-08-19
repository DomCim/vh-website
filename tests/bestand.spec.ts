import { expect, test, type Page } from '@playwright/test'

/**
 * Prüft den Bestand im Gerät.
 *
 * Der Anspruch ist nicht „es lädt", sondern: Nach dem Anmelden liegen die
 * Geschäftsdaten im Browser, sie überstehen das Schließen der App, sie holen
 * Änderungen von selbst nach — und beim Abmelden sind sie weg. Der letzte
 * Punkt ist der wichtigste: Ein Tablet in der Werkstatt darf keine Umsätze
 * mit sich herumtragen, nachdem sich jemand abgemeldet hat.
 *
 * Anmerkung zu den Auswertungen im Browser: Sie werden als Funktion übergeben,
 * nicht als Zeichenkette. Eine Zeichenkette liefe über `eval`, und das
 * verbietet die Sicherheitsrichtlinie des Büros zu Recht.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

/** Wie viele Datensätze liegen in einem Behälter? −1 heißt: Behälter fehlt. */
function zaehlen(seite: Page, bereich: string): Promise<number> {
  return seite.evaluate(
    (b) =>
      new Promise<number>((fertig) => {
        const anfrage = indexedDB.open('vh-buero')
        anfrage.onsuccess = () => {
          const db = anfrage.result
          if (!db.objectStoreNames.contains(b)) return fertig(-1)
          const zaehlung = db.transaction(b, 'readonly').objectStore(b).count()
          zaehlung.onsuccess = () => fertig(zaehlung.result)
          zaehlung.onerror = () => fertig(-2)
        }
        anfrage.onerror = () => fertig(-3)
      }),
    bereich,
  )
}

function namen(seite: Page): Promise<string[]> {
  return seite.evaluate(
    () =>
      new Promise<string[]>((fertig) => {
        const anfrage = indexedDB.open('vh-buero')
        anfrage.onsuccess = () => {
          const alle = anfrage.result
            .transaction('partner', 'readonly')
            .objectStore('partner')
            .getAll()
          alle.onsuccess = () => fertig(alle.result.map((p: { name: string }) => p.name))
          alle.onerror = () => fertig([])
        }
        anfrage.onerror = () => fertig([])
      }),
  )
}

async function anmelden(seite: Page) {
  await seite.goto('/office/login')
  // Erst wenn die Seite im Browser lebendig ist, tut der Knopf etwas
  await seite.waitForLoadState('networkidle')
  await seite.fill('input[type="email"]', EMAIL)
  await seite.fill('input[type="password"]', PASSWORT!)
  await seite.locator('form button[type="submit"]').first().click()
  await seite.waitForURL(/\/office$/, { timeout: 30_000 })
}

test.describe('Bestand im Gerät', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('füllt sich, überlebt einen Neustart und verschwindet beim Abmelden', async ({
    page,
    request,
  }) => {
    await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })
    const name = `Bestandspartner ${Date.now()}`
    const angelegt = await request.post(`${BASIS}/api/contacts`, {
      headers: WIE_IM_BROWSER,
      data: { name, type: 'lieferant' },
    })
    expect(angelegt.status()).toBe(201)

    await anmelden(page)

    // Der Abgleich läuft nach dem Anmelden von selbst los
    await expect.poll(() => zaehlen(page, 'partner'), { timeout: 40_000 }).toBeGreaterThan(0)
    expect(await namen(page), 'der neue Partner liegt im Gerät').toContain(name)

    // Neustart der App: Seite komplett neu laden, Bestand ist sofort da
    await page.reload()
    await page.waitForLoadState('networkidle')
    expect(await zaehlen(page, 'partner'), 'überlebt den Neustart').toBeGreaterThan(0)

    // Was währenddessen dazukommt, zieht die offene Seite selbst nach
    const vorher = await zaehlen(page, 'partner')
    await request.post(`${BASIS}/api/contacts`, {
      headers: WIE_IM_BROWSER,
      data: { name: `Nachzügler ${Date.now()}`, type: 'lieferant' },
    })
    await expect.poll(() => zaehlen(page, 'partner'), { timeout: 30_000 }).toBeGreaterThan(vorher)

    // Abmelden räumt auf
    await page.getByRole('button', { name: 'Abmelden' }).click()
    await page.waitForURL(/\/office\/login/, { timeout: 30_000 })
    await expect.poll(() => zaehlen(page, 'partner'), { timeout: 30_000 }).toBeLessThanOrEqual(0)
  })
})
