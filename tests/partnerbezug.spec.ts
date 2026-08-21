import { expect, test } from '@playwright/test'

/**
 * Die Partnerkette: Partner am Angebot, Anfrage-Bezug, keine Doppelanlage.
 *
 * Drei Dinge, die zusammen erst die Kette Anfrage → Angebot → Auftrag →
 * Rechnung tragen: Der Partner wandert vom Angebot in Auftrag und Rechnung
 * (daran hängen Versand-Empfänger, Portal und Mailsprache). Die Anfrage am
 * Angebot trägt den Zahlplan. Und ein zweiter Klick auf „Auftrag anlegen"
 * führt zum bestehenden, statt einen zweiten anzulegen.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Partnerkette', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Partner und Anfrage wandern mit, Doppelklick legt nichts doppelt an', async ({
    request,
  }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }
    const kennung = Date.now()

    // Ein Partner mit Sprache — die Kette soll ihn bis zur Rechnung tragen
    const partnerAntwort = await request.post(`${BASIS}/api/office/partner`, {
      headers: kopf,
      data: {
        name: `Kettenprobe ${kennung}`,
        role: 'kunde',
        email: `kettenprobe-${kennung}@example.com`,
        line1: 'Rue de la Forge 1',
        postalCode: '75001',
        city: 'Paris',
        sprache: 'fr',
      },
    })
    expect(partnerAntwort.ok()).toBeTruthy()
    const { id: partnerId } = await partnerAntwort.json()

    // Die Sprache muss wirklich gespeichert sein — sie war lange unerreichbar
    const partner = await (
      await request.get(`${BASIS}/api/contacts/${partnerId}?depth=0`, { headers: kopf })
    ).json()
    expect(partner.sprache).toBe('fr')

    // Angebot mit Partner — wie es das Formular jetzt schickt
    const angebotAntwort = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: {
        status: 'angenommen',
        customer: partnerId,
        customerName: `Kettenprobe ${kennung}`,
        customerAddress: 'Rue de la Forge 1\n75001 Paris',
        items: [{ description: 'Tor nach Maß', quantity: 1, unit: 'Stück', unitPrice: 900, vatRate: 20 }],
      },
    })
    expect(angebotAntwort.ok()).toBeTruthy()
    const { id: angebotId } = await angebotAntwort.json()

    const gespeichert = await (
      await request.get(`${BASIS}/api/quotes/${angebotId}?depth=0`, { headers: kopf })
    ).json()
    expect(gespeichert.customer).toBe(partnerId)

    // In einen Auftrag umwandeln — der Partner kommt mit
    const umwandlung = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: { aktion: 'in-auftrag', id: angebotId },
    })
    expect(umwandlung.ok()).toBeTruthy()
    const { auftragId } = await umwandlung.json()
    const auftrag = await (
      await request.get(`${BASIS}/api/jobs/${auftragId}?depth=0`, { headers: kopf })
    ).json()
    expect(auftrag.contact).toBe(partnerId)

    // Der zweite Klick: kein zweiter Auftrag, sondern der Weg zum ersten
    const nochmal = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: { aktion: 'in-auftrag', id: angebotId },
    })
    expect(nochmal.status()).toBe(409)
    const doppelt = await nochmal.json()
    expect(doppelt.error).toBe('schon-vorhanden')
    expect(doppelt.auftragId).toBe(auftragId)

    // „Rechnung daraus" trägt den Partner ebenfalls — und auch nur einmal
    const rechnungAntwort = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: { aktion: 'in-rechnung', id: angebotId },
    })
    expect(rechnungAntwort.ok()).toBeTruthy()
    const { rechnungId } = await rechnungAntwort.json()
    const rechnung = await (
      await request.get(`${BASIS}/api/outgoing-invoices/${rechnungId}?depth=0`, { headers: kopf })
    ).json()
    expect(rechnung.customer).toBe(partnerId)

    const rechnungNochmal = await request.post(`${BASIS}/api/office/angebot`, {
      headers: kopf,
      data: { aktion: 'in-rechnung', id: angebotId },
    })
    expect(rechnungNochmal.status()).toBe(409)
  })
})
