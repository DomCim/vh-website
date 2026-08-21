import { expect, test } from '@playwright/test'

import { istOffenerPosten, zaehltZumUmsatz } from '../src/lib/zahlungsstand'

/**
 * Ein Storno darf den Umsatz nur aufheben, nicht doppelt abziehen.
 *
 * Der Fehler, um den es geht: Das Original fiel mit „storniert" aus der
 * Umsatzsumme, die negative Gegenrechnung blieb mit „gestellt" drin — der
 * Betrag fehlte zweimal. Die Regel steht jetzt an einer Stelle
 * (zahlungsstand.ts) und wird hier an beiden Enden geprüft: als reine
 * Rechenregel und am laufenden Server über den echten Storno-Weg.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test('die Regel selbst: beide Belege zählen, keiner ist offen', () => {
  const original = { status: 'storniert' }
  const gegenrechnung = { status: 'gestellt', stornoVon: 7 }
  const normale = { status: 'gestellt' }

  expect(zaehltZumUmsatz(original)).toBe(true)
  expect(zaehltZumUmsatz(gegenrechnung)).toBe(true)
  expect(zaehltZumUmsatz({ status: 'entwurf' })).toBe(false)

  expect(istOffenerPosten(normale)).toBe(true)
  expect(istOffenerPosten(original)).toBe(false)
  expect(istOffenerPosten(gegenrechnung)).toBe(false)
})

test.describe('Storno am laufenden Server', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Original und Gegenrechnung heben sich auf', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        status: 'gestellt',
        customerName: 'Stornoprobe',
        items: [
          { description: 'Pflanzkübel', quantity: 2, unit: 'Stück', unitPrice: 250, vatRate: 20 },
        ],
      },
    })
    expect(angelegt.ok()).toBeTruthy()
    const { id } = await angelegt.json()

    const storniert = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { aktion: 'stornieren', id, grund: 'Prüflauf' },
    })
    expect(storniert.ok()).toBeTruthy()
    const { id: stornoId } = await storniert.json()

    const holen = async (welche: number | string) => {
      const r = await request.get(`${BASIS}/api/outgoing-invoices/${welche}?depth=0`, {
        headers: kopf,
      })
      return (await r.json()) as {
        status: string
        total?: number
        stornoVon?: number | null
      }
    }

    const original = await holen(id)
    const storno = await holen(stornoId)

    expect(original.status).toBe('storniert')
    expect(storno.status).toBe('gestellt')
    expect(storno.stornoVon).toBeTruthy()

    // Das Paar hebt sich auf — und beide zählen zum Umsatz
    expect((original.total ?? 0) + (storno.total ?? 0)).toBeCloseTo(0, 2)
    expect(zaehltZumUmsatz(original)).toBe(true)
    expect(zaehltZumUmsatz(storno)).toBe(true)

    // Keiner von beiden wartet auf Geld
    expect(istOffenerPosten(original)).toBe(false)
    expect(istOffenerPosten(storno)).toBe(false)
  })
})
