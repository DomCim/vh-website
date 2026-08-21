import { expect, test } from '@playwright/test'

/**
 * Entwürfe lassen sich verwerfen — und nur Entwürfe.
 *
 * Der Storno-Weg sagte seit jeher „ein Entwurf wird verworfen, nicht
 * storniert", aber das Verwerfen gab es nicht: Der Entwurf stand für immer
 * in der Liste. Hier wird der neue Weg geprüft, und genauso wichtig seine
 * Grenze: Was eine Nummer hat, liegt beim Kunden und bleibt.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Entwurf verwerfen', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Rechnungsentwurf verschwindet, gestellte Rechnung bleibt', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const entwurf = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        status: 'entwurf',
        customerName: 'Verwerfprobe',
        items: [{ description: 'Probe', quantity: 1, unit: 'Stück', unitPrice: 10, vatRate: 20 }],
      },
    })
    expect(entwurf.ok()).toBeTruthy()
    const { id } = await entwurf.json()

    const verworfen = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { aktion: 'verwerfen', id },
    })
    expect(verworfen.ok()).toBeTruthy()

    const weg = await request.get(`${BASIS}/api/outgoing-invoices/${id}?depth=0`, {
      headers: kopf,
    })
    expect(weg.status()).toBe(404)

    // Eine gestellte Rechnung hat eine Nummer — die wird nicht verworfen
    const gestellt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        status: 'gestellt',
        customerName: 'Verwerfprobe fest',
        items: [{ description: 'Probe', quantity: 1, unit: 'Stück', unitPrice: 10, vatRate: 20 }],
      },
    })
    const { id: festeId } = await gestellt.json()
    const abgelehnt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { aktion: 'verwerfen', id: festeId },
    })
    expect(abgelehnt.status()).toBe(409)
  })

  test('Angebotsentwurf verschwindet, versendetes Angebot bleibt', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const entwurf = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: {
        status: 'entwurf',
        customerName: 'Verwerfprobe',
        items: [{ description: 'Probe', quantity: 1, unit: 'Stück', unitPrice: 10, vatRate: 20 }],
      },
    })
    expect(entwurf.ok()).toBeTruthy()
    const { id } = await entwurf.json()

    const verworfen = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: { aktion: 'verwerfen', id },
    })
    expect(verworfen.ok()).toBeTruthy()
    const weg = await request.get(`${BASIS}/api/quotes/${id}?depth=0`, { headers: kopf })
    expect(weg.status()).toBe(404)

    const versendet = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: {
        status: 'versendet',
        customerName: 'Verwerfprobe fest',
        items: [{ description: 'Probe', quantity: 1, unit: 'Stück', unitPrice: 10, vatRate: 20 }],
      },
    })
    const { id: festeId } = await versendet.json()
    const abgelehnt = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: { aktion: 'verwerfen', id: festeId },
    })
    expect(abgelehnt.status()).toBe(409)
  })
})
