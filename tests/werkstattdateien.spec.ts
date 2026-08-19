import { expect, test } from '@playwright/test'

/**
 * Werkstattdateien an einer Artikelvariante.
 *
 * Geprüft wird das, was teuer wäre, wenn es bricht:
 *
 * 1. **Sie sind nicht öffentlich.** Eine Laserdatei unter einer ratbaren
 *    Adresse ist die Arbeit von Wochen, frei zum Mitnehmen.
 * 2. **Der Download trägt den Originalnamen.** Auf der Platte steht ein
 *    Zeitstempel davor, damit zwei Varianten ihre gleichnamige
 *    `zuschnitt.dxf` nicht gegenseitig überschreiben — in der Werkstatt
 *    darf davon nichts ankommen.
 * 3. **Ein Ordner mit Inhalt lässt sich nicht löschen**, und beim Umbenennen
 *    ziehen die Dateien mit. Sonst liegt alles in einem Ordner, den es nicht
 *    mehr gibt.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Werkstattdateien', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('liegen nicht offen im Netz und kommen mit ihrem Namen zurück', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const artikel = await request.get(`${BASIS}/api/products?limit=1&depth=0`, { headers: kopf })
    const produkt = (await artikel.json()).docs?.[0]
    test.skip(!produkt, 'Ohne Artikel nicht prüfbar')

    const ordner = `Prüfung ${Date.now()}`
    const angelegt = await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      data: { aktion: 'ordner-anlegen', product: produkt.id, variantId: '', name: ordner },
    })
    expect(angelegt.ok()).toBeTruthy()

    // Derselbe Ordner ein zweites Mal wäre eine stille Dublette
    const doppelt = await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      data: { aktion: 'ordner-anlegen', product: produkt.id, variantId: '', name: ordner },
    })
    expect(doppelt.status()).toBe(400)

    const hochgeladen = await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      multipart: {
        datei: { name: 'zuschnitt.dxf', mimeType: 'application/dxf', buffer: Buffer.from('0\nSECTION\n') },
        product: String(produkt.id),
        variantId: '',
        folder: ordner,
      },
    })
    expect(hochgeladen.ok()).toBeTruthy()
    const { id } = await hochgeladen.json()

    // 1 — ohne Anmeldung nichts
    const fremd = await request.get(`${BASIS}/api/office/werkstattdatei/${id}`, {
      headers: { Authorization: '' },
    })
    expect(fremd.status()).toBe(403)

    // 2 — mit Anmeldung, und unter dem Namen, den die Datei hatte
    const geladen = await request.get(`${BASIS}/api/office/werkstattdatei/${id}`, { headers: kopf })
    expect(geladen.ok()).toBeTruthy()
    expect(geladen.headers()['content-disposition']).toContain('zuschnitt.dxf')

    // 3 — voller Ordner bleibt stehen
    const zuFrueh = await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      data: { aktion: 'ordner-loeschen', product: produkt.id, variantId: '', name: ordner },
    })
    expect(zuFrueh.status()).toBe(400)

    // … und beim Umbenennen zieht die Datei mit
    const neuerName = `${ordner} neu`
    const umbenannt = await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      data: {
        aktion: 'ordner-umbenennen',
        product: produkt.id,
        variantId: '',
        name: ordner,
        neuerName,
      },
    })
    expect(umbenannt.ok()).toBeTruthy()
    const nachher = await request.get(`${BASIS}/api/product-files/${id}?depth=0`, { headers: kopf })
    expect((await nachher.json()).folder).toBe(neuerName)

    // Aufräumen, damit die nächste Prüfung nicht auf Resten sitzt
    await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      data: { aktion: 'datei-loeschen', id },
    })
    await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      data: { aktion: 'ordner-loeschen', product: produkt.id, variantId: '', name: neuerName },
    })
  })
})
