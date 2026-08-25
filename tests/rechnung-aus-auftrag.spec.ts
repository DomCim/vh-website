import { expect, test } from '@playwright/test'

/**
 * Die Rechnung direkt aus dem Auftrag.
 *
 * Am Auftrag steht alles, was auf die Rechnung gehört: Positionen, Mengen,
 * Preise, Kundschaft. Trotzdem gab es dafür keinen Weg, solange keine
 * Bestellung dahinterstand — die Auslöser legen nur Stufenentwürfe an, und
 * die greifen nur bei einem Auftrag mit Zahlplan. Beim gewöhnlichen Auftrag
 * blieb Abtippen, mit jeder Position von Hand.
 *
 * Geprüft wird deshalb dreierlei: dass die Zahlen unverändert übernommen
 * werden, dass ein **Entwurf** entsteht (verschickt wird von Hand) und dass
 * kein zweiter dazukommt.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Rechnung aus dem Auftrag', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('übernimmt die Positionen und legt genau einen Entwurf an', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    // Ein Auftrag ohne Zahlplan — der Fall, für den es bisher keinen Weg gab
    const auftrag = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: {
        title: 'Prüflauf Rechnung aus Auftrag',
        customerName: 'Prüf-Kundschaft',
        status: 'geplant',
        positions: [
          { description: 'Sitzbank Corten', quantity: 2, price: 480 },
          { description: 'Anlieferung', quantity: 1, price: 90 },
        ],
      },
    })
    expect(auftrag.ok()).toBeTruthy()
    const { id: auftragId } = await auftrag.json()

    const erstellt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: { aktion: 'rechnung', id: auftragId },
    })
    expect(erstellt.ok(), 'die Rechnung entsteht aus dem Auftrag').toBeTruthy()
    const { rechnung: rechnungId } = await erstellt.json()
    expect(rechnungId).toBeTruthy()

    const r = await request.get(`${BASIS}/api/outgoing-invoices/${rechnungId}?depth=0`, {
      headers: kopf,
    })
    const stand = (await r.json()) as {
      status: string
      stufe?: string | null
      invoiceNumber?: string | null
      netTotal?: number | null
      customerName?: string | null
      items?: { description?: string; quantity?: number; unitPrice?: number }[]
    }

    // Ein Entwurf, keine gestellte Rechnung: Ein Klick bereitet vor und
    // verschickt nicht.
    expect(stand.status, 'es entsteht ein Entwurf').toBe('entwurf')
    expect(stand.invoiceNumber, 'ohne Nummer — die kommt beim Festschreiben').toBeFalsy()

    // Keine Rate eines Zahlplans, sondern die ganze Leistung
    expect(stand.stufe).toBe('vollstaendig')

    // Die Zahlen kommen unverändert vom Auftrag: 2 × 480 + 1 × 90 = 1050
    expect(stand.netTotal).toBe(1050)
    expect(stand.customerName).toBe('Prüf-Kundschaft')
    expect(stand.items).toHaveLength(2)
    expect(stand.items?.[0]).toMatchObject({
      description: 'Sitzbank Corten',
      quantity: 2,
      unitPrice: 480,
    })

    // Ein zweiter Aufruf legt nichts nach — ohne Netz steht die Anfrage in der
    // Warteschlange, und zweimal getippt käme sie zweimal an.
    const nochmal = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: { aktion: 'rechnung', id: auftragId },
    })
    expect(nochmal.status(), 'keine zweite Rechnung zum selben Auftrag').toBe(409)

    // Aufräumen: Der Entwurf hat keine Nummer, also lässt er sich verwerfen.
    await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { aktion: 'verwerfen', id: rechnungId },
    })
  })

  test('ohne Positionen mit Preis entsteht keine Rechnung', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const auftrag = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: { title: 'Prüflauf ohne Positionen', status: 'geplant' },
    })
    expect(auftrag.ok()).toBeTruthy()
    const { id: auftragId } = await auftrag.json()

    /*
     * Kein Serverfehler, sondern eine unfertige Vorbereitung am Auftrag: Im
     * Büro steht an dieser Stelle deshalb auch kein Knopf, sondern der Satz,
     * dass erst die Positionen gebraucht werden.
     */
    const versuch = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: { aktion: 'rechnung', id: auftragId },
    })
    expect(versuch.status()).toBe(400)
    expect((await versuch.json()).error).toBe('keine-positionen')
  })
})
