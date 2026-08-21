import { expect, test } from '@playwright/test'

/**
 * Abholbestellungen lassen sich abschließen.
 *
 * Der Abschluss verlangte eine Sendungsnummer — die es bei Abholung nicht
 * gibt. Solche Bestellungen standen für immer auf „bezahlt". Geprüft wird
 * beides: Abholung geht ohne Nummer durch, Versand verlangt sie weiterhin.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Abholbestellung', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Abholung schließt ohne Sendungsnummer, Versand nicht', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }
    const kennung = Date.now()

    const bestellen = async (lieferart: 'pickup' | 'shipping') => {
      const antwort = await request.post(`${BASIS}/api/orders`, {
        headers: kopf,
        data: {
          orderNumber: `PRUEF-${lieferart}-${kennung}`,
          status: 'paid',
          items: [{ titleSnapshot: 'Prüfstück', quantity: 1, unitPrice: 100 }],
          subtotal: 100,
          total: 100,
          deliveryMethod: lieferart,
          customer: { name: 'Prüfkunde', email: `pruefkunde-${kennung}@example.com` },
        },
      })
      expect(antwort.status(), `Bestellung (${lieferart}) angelegt`).toBe(201)
      const { doc } = await antwort.json()
      return doc.id as number
    }

    const abschliessen = (id: number) =>
      request.post(`${BASIS}/api/office/bestellung`, {
        headers: kopf,
        data: { id, status: 'shipped' },
      })

    // Abholung: kein Paket, keine Nummer — trotzdem fertig
    const abholung = await bestellen('pickup')
    const ok = await abschliessen(abholung)
    expect(ok.status()).toBe(200)

    // Versand: ohne Nummer bleibt die Tür zu, die Mail wäre leer
    const versand = await bestellen('shipping')
    const zu = await abschliessen(versand)
    expect(zu.status()).toBe(400)
    expect((await zu.json()).error).toBe('sendungsnummer-fehlt')

    // Ein erfundener Status wird an der Tür abgewiesen
    const kaputt = await request.post(`${BASIS}/api/office/bestellung`, {
      headers: kopf,
      data: { id: versand, status: 'erfunden' },
    })
    expect(kaputt.status()).toBe(400)
    expect((await kaputt.json()).error).toBe('status-unbekannt')
  })
})
