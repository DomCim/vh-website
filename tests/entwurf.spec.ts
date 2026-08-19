import { expect, test } from '@playwright/test'

/**
 * Entwürfe: Angefangenes, das den Gerätewechsel überlebt.
 *
 * Der Fall, für den es das gibt: Jemand fängt am Handy eine Rechnung an,
 * kommt bis zur dritten Position, setzt sich an den Rechner. Damit das dort
 * ankommt, muss der Stand beim Server liegen und nicht nur im Gerät — genau
 * das prüft dieser Test, indem er wie zwei verschiedene Geräte auftritt.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

test.describe('Entwürfe am Benutzer', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('am einen Gerät angefangen, am anderen weiter', async ({ playwright }) => {
    const handy = await playwright.request.newContext()
    const rechner = await playwright.request.newContext()

    for (const geraet of [handy, rechner]) {
      const anmeldung = await geraet.post(`${BASIS}/api/users/login`, {
        headers: WIE_IM_BROWSER,
        data: { email: EMAIL, password: PASSWORT },
      })
      expect(anmeldung.ok(), 'Anmeldung').toBeTruthy()
    }

    const schluessel = 'rechnungen:neu'
    const stand = {
      status: 'entwurf',
      items: [{ description: 'Geländer, halb getippt', quantity: 2, unitPrice: 480 }],
    }

    // ── Am Handy ──
    const abgelegt = await handy.post(`${BASIS}/api/office/entwurf`, {
      headers: WIE_IM_BROWSER,
      data: { schluessel, stand, geraet: 'Handy' },
    })
    expect(abgelegt.status(), 'Entwurf abgelegt').toBe(200)

    // ── Am Rechner ──
    const geholt = await rechner.get(
      `${BASIS}/api/office/entwurf?schluessel=${encodeURIComponent(schluessel)}`,
      { headers: WIE_IM_BROWSER },
    )
    expect(geholt.status()).toBe(200)
    const daten = (await geholt.json()) as {
      entwurf: { stand: typeof stand; geraet: string } | null
    }
    expect(daten.entwurf, 'der Entwurf ist am anderen Gerät da').toBeTruthy()
    expect(daten.entwurf!.stand.items[0].description).toBe('Geländer, halb getippt')
    expect(daten.entwurf!.geraet, 'und es steht dran, wo er entstand').toBe('Handy')

    /*
     * Zweimal ablegen darf keine zwei Entwürfe ergeben.
     *
     * Geschrieben wird beim Tippen, also alle paar Sekunden. Entstünde dabei
     * jedes Mal ein neuer Datensatz, hätte ein halbstündiges Angebot
     * hunderte Fassungen hinterlassen — und beim Öffnen wäre unklar, welche
     * davon die gemeinte ist.
     */
    await handy.post(`${BASIS}/api/office/entwurf`, {
      headers: WIE_IM_BROWSER,
      data: { schluessel, stand: { ...stand, status: 'entwurf', geaendert: true }, geraet: 'Handy' },
    })
    const nochmal = await rechner.get(
      `${BASIS}/api/office/entwurf?schluessel=${encodeURIComponent(schluessel)}`,
      { headers: WIE_IM_BROWSER },
    )
    const zweiteRunde = (await nochmal.json()) as {
      entwurf: { stand: Record<string, unknown> } | null
    }
    expect(zweiteRunde.entwurf!.stand.geaendert, 'der Entwurf hat sich selbst überschrieben').toBe(
      true,
    )

    // ── Gespeichert, also erledigt ──
    const weg = await rechner.delete(
      `${BASIS}/api/office/entwurf?schluessel=${encodeURIComponent(schluessel)}`,
      { headers: WIE_IM_BROWSER },
    )
    expect(weg.status()).toBe(200)

    const danach = await handy.get(
      `${BASIS}/api/office/entwurf?schluessel=${encodeURIComponent(schluessel)}`,
      { headers: WIE_IM_BROWSER },
    )
    expect((await danach.json()).entwurf, 'nach dem Speichern ist er weg').toBeNull()

    await handy.dispose()
    await rechner.dispose()
  })

  test('ohne Anmeldung verschlossen', async ({ playwright }) => {
    const fremd = await playwright.request.newContext()
    const antwort = await fremd.get(`${BASIS}/api/office/entwurf?schluessel=rechnungen:neu`, {
      headers: WIE_IM_BROWSER,
    })
    expect(antwort.status()).toBe(403)
    await fremd.dispose()
  })

  test('unsinnige Schlüssel werden abgewiesen', async ({ request }) => {
    await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })

    /*
     * Der Schlüssel kommt aus dem Browser und landet in einer Abfrage. Er
     * wird deshalb gegen ein Muster geprüft, statt ihm zu glauben — sonst
     * wäre er eine Handhabe, in fremden Entwürfen zu stochern.
     */
    for (const unsinn of ['../andere', 'rechnungen:*', 'rechnungen', '']) {
      const antwort = await request.get(
        `${BASIS}/api/office/entwurf?schluessel=${encodeURIComponent(unsinn)}`,
        { headers: WIE_IM_BROWSER },
      )
      expect(antwort.status(), `abgewiesen: ${unsinn || '(leer)'}`).toBe(400)
    }
  })
})
