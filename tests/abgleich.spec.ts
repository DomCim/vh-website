import { expect, test } from '@playwright/test'

/**
 * Prüft den Abgleich, von dem der Bestand im Gerät lebt.
 *
 * Der heikle Teil ist nicht das Geänderte — das findet sich über den
 * Änderungszeitpunkt. Es ist das Gelöschte: Ein Datensatz, der weg ist,
 * hinterlässt keine Spur, und ohne Grabstein bliebe er auf einem Gerät
 * stehen, das gerade offline war. Genau das wird hier nachgestellt.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/** Payload nimmt den Anmelde-Keks nur an, wenn die Anfrage wie aus einem Browser aussieht */
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

test.describe('Abgleich', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('liefert Geändertes und Gelöschtes seit dem letzten Stand', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()

    const abgleich = async (staende: Record<string, string | null>, bereiche?: string[]) => {
      const antwort = await request.post(`${BASIS}/api/office/abgleich`, {
        headers: WIE_IM_BROWSER,
        data: { staende, ...(bereiche ? { bereiche } : {}) },
      })
      expect(antwort.status(), 'Abgleich beantwortet').toBe(200)
      return antwort.json()
    }

    // Erster Abruf ohne Stand: alles, was da ist
    const ersteRunde = await abgleich({}, ['partner'])
    expect(Object.keys(ersteRunde.bereiche)).toEqual(['partner'])
    const stand = ersteRunde.bereiche.partner.stand as string
    expect(stand).toBeTruthy()

    // Etwas anlegen — muss beim nächsten Abruf dabei sein
    const angelegt = await request.post(`${BASIS}/api/contacts`, {
      headers: WIE_IM_BROWSER,
      data: { name: `Abgleichspartner ${Date.now()}`, type: 'lieferant' },
    })
    expect(angelegt.status()).toBe(201)
    const { doc } = await angelegt.json()

    const zweiteRunde = await abgleich({ partner: stand }, ['partner'])
    const gefunden = (zweiteRunde.bereiche.partner.geaendert as { id: number }[]).map((p) => p.id)
    expect(gefunden, 'neuer Partner kommt im Abgleich vor').toContain(doc.id)
    expect(zweiteRunde.bereiche.partner.geloescht).toEqual([])

    // Und nun löschen: Der Grabstein muss den Weg finden
    const standVorLoeschen = zweiteRunde.bereiche.partner.stand as string
    const geloescht = await request.delete(`${BASIS}/api/contacts/${doc.id}`, {
      headers: WIE_IM_BROWSER,
    })
    expect(geloescht.ok(), 'Partner gelöscht').toBeTruthy()

    const dritteRunde = await abgleich({ partner: standVorLoeschen }, ['partner'])
    expect(dritteRunde.bereiche.partner.geloescht, 'Löschung wird gemeldet').toContain(
      String(doc.id),
    )
  })

  test('ohne Anmeldung verschlossen', async ({ playwright }) => {
    const frisch = await playwright.request.newContext()
    const antwort = await frisch.post(`${BASIS}/api/office/abgleich`, {
      headers: WIE_IM_BROWSER,
      data: { staende: {} },
    })
    expect(antwort.status()).toBe(403)
    await frisch.dispose()
  })
})
