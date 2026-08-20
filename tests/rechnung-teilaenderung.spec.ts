import { expect, test } from '@playwright/test'

/**
 * Eine Teiländerung an der Rechnung darf nichts wegnehmen.
 *
 * Die Probe am laufenden Stand — die Rechenregel selbst prüft
 * `teilaenderung.spec.ts`. Hier geht es um den Weg durch die Schnittstelle:
 * Wer nur den Status setzt, soll die Positionen behalten; wer nur die
 * Positionen ändert, soll den Status behalten.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Teiländerung an einer Rechnung', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('nimmt weder Positionen noch Status weg', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        status: 'gestellt',
        customerName: 'Teiländerung',
        items: [
          { description: 'Sitzbank Corten', quantity: 1, unit: 'Stück', unitPrice: 100, vatRate: 20 },
          { description: 'Lieferung', quantity: 1, unit: 'Stück', unitPrice: 60, vatRate: 20 },
        ],
      },
    })
    expect(angelegt.ok()).toBeTruthy()
    const { id } = await angelegt.json()

    const stand = async () => {
      const r = await request.get(`${BASIS}/api/outgoing-invoices/${id}?depth=0`, { headers: kopf })
      return (await r.json()) as { status: string; items?: unknown[]; customerName?: string }
    }

    expect((await stand()).items).toHaveLength(2)

    // Nur den Status setzen — die Positionen bleiben
    const bezahlt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { id, status: 'bezahlt' },
    })
    expect(bezahlt.ok()).toBeTruthy()
    const nachStatus = await stand()
    expect(nachStatus.status).toBe('bezahlt')
    expect(nachStatus.items).toHaveLength(2)
    expect(nachStatus.customerName).toBe('Teiländerung')

    // Nur eine Position ändern — der Status bleibt „bezahlt" und fällt nicht
    // auf „Entwurf" zurück
    const gekuerzt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        id,
        items: [
          { description: 'Sitzbank Corten', quantity: 1, unit: 'Stück', unitPrice: 100, vatRate: 20 },
        ],
      },
    })
    expect(gekuerzt.ok()).toBeTruthy()
    const nachPositionen = await stand()
    expect(nachPositionen.items).toHaveLength(1)
    expect(nachPositionen.status).toBe('bezahlt')
  })
})
