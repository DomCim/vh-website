import { expect, test } from '@playwright/test'

/**
 * Die Mediathek gibt Bilder heraus — und sonst nichts.
 *
 * Anlass war Dominiks Frage (08/2026), ob die Dateien nicht besser auf
 * getrennte Adressen und ein eigenes Volume gehörten. Beim Nachsehen stellte
 * sich heraus, dass die Frage dringender war als gedacht:
 *
 * 1. **Der Unterordner.** Die Werkstattdateien liegen als Unterordner in
 *    demselben Ordner, aus dem die öffentliche Bildadresse ausliefert.
 *    Geprüft wurde der Dateiname nur gegen `..`, nicht gegen einen
 *    Schrägstrich — mit einem kodierten (`werkstattdateien%2F…`) gab
 *    `/api/media/file/…` Laserdateien heraus, ohne jede Anmeldung.
 * 2. **Die Liste.** `/api/media` nannte ohne Anmeldung jeden Datensatz mit
 *    Namen. In der Mediathek liegen aber auch Belegscans, Wareneingänge und
 *    das, was Kundschaft an eine Anfrage hängt. Damit waren sie nicht
 *    erratbar, sondern abzählbar.
 *
 * 3. **Und die Gegenprobe**, die hier der wichtigere Teil ist: Ein
 *    Produktbild muss ohne Anmeldung ausgeliefert werden. Es steckt in jeder
 *    Seite, Google Shopping holt es dort ab. Eine Absicherung, die das
 *    mitnimmt, kostet den Laden Kundschaft und fällt niemandem auf.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Mediathek', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('liefert Bilder öffentlich aus, aber weder die Liste noch den Unterordner', async ({
    playwright,
    request,
  }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    /*
     * Ein eigener Zusammenhang ohne Kekse und ohne Kopfzeile — sonst nimmt
     * die Prüfung die Anmeldung von oben mit und misst sich selbst.
     */
    const fremder = await playwright.request.newContext()

    // Vorbereitung: eine Werkstattdatei, deren Namen wir kennen
    const artikel = await request.get(`${BASIS}/api/products?limit=1&depth=0`, { headers: kopf })
    const produkt = (await artikel.json()).docs?.[0]
    test.skip(!produkt, 'Ohne Artikel nicht prüfbar')

    const hochgeladen = await request.post(`${BASIS}/api/office/werkstattdatei`, {
      headers: kopf,
      multipart: {
        datei: {
          name: 'geheim.dxf',
          mimeType: 'application/dxf',
          buffer: Buffer.from('0\nSECTION\nGEHEIM\n'),
        },
        product: String(produkt.id),
        variantId: '',
        folder: '',
      },
    })
    expect(hochgeladen.ok()).toBeTruthy()
    const { id } = await hochgeladen.json()
    const datei = await request.get(`${BASIS}/api/product-files/${id}?depth=0`, { headers: kopf })
    const dateiname = (await datei.json()).filename as string
    expect(dateiname).toBeTruthy()

    try {
      // 1 — der Weg in den Unterordner ist zu
      const heraus = await fremder.get(
        `${BASIS}/api/media/file/werkstattdateien%2F${encodeURIComponent(dateiname)}`,
      )
      expect(heraus.status()).not.toBe(200)

      // … auch die eigene Adresse der Sammlung gibt ohne Anmeldung nichts
      const direkt = await fremder.get(
        `${BASIS}/api/product-files/file/${encodeURIComponent(dateiname)}`,
      )
      expect(direkt.status()).not.toBe(200)

      // 2 — die Liste nennt Fremden keinen einzigen Datensatz
      const liste = await fremder.get(`${BASIS}/api/media?limit=1&depth=0`)
      expect(liste.status()).not.toBe(200)

      // … mit Anmeldung selbstverständlich schon, sonst wäre das Büro blind
      const mitAnmeldung = await request.get(`${BASIS}/api/media?limit=1&depth=0`, { headers: kopf })
      expect(mitAnmeldung.ok()).toBeTruthy()
      const bild = (await mitAnmeldung.json()).docs?.[0]

      // 3 — die Gegenprobe: das Bild selbst bleibt ohne Anmeldung erreichbar
      if (bild?.filename) {
        const oeffentlich = await fremder.get(
          `${BASIS}/api/media/file/${encodeURIComponent(bild.filename)}`,
        )
        expect(oeffentlich.status()).toBe(200)
      }
    } finally {
      await fremder.dispose()
      await request.post(`${BASIS}/api/office/werkstattdatei`, {
        headers: kopf,
        data: { aktion: 'datei-loeschen', id },
      })
    }
  })

  test('Internes und PDFs gibt es nur mit Anmeldung', async ({ playwright, request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }
    const fremder = await playwright.request.newContext()

    /*
     * Der Weg des Betriebs: Ein Belegfoto über die Upload-Route. Sie setzt
     * das intern-Kennzeichen — und genau das muss die Auslieferung dann
     * auch durchsetzen. Wichtig als Bedingung, nicht als Feldvergleich:
     * Payload reicht der Statikdatei-Prüfung nur den Dateinamen herein,
     * ein `data.intern`-Vergleich wäre still immer wahr (so gefunden
     * 08/2026, am Container nachgemessen).
     */
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const hochgeladen = await request.post(`${BASIS}/api/office/beleg-upload`, {
      headers: kopf,
      multipart: { datei: { name: 'beleg-probe.png', mimeType: 'image/png', buffer: PNG } },
    })
    expect(hochgeladen.ok()).toBeTruthy()
    const { id, datei } = await hochgeladen.json()

    try {
      const url = `${BASIS}/api/media/file/${encodeURIComponent(datei)}`
      // Ohne Anmeldung zu, mit Anmeldung offen
      expect((await fremder.get(url)).status()).toBe(403)
      expect((await request.get(url, { headers: kopf })).status()).toBe(200)

      // Und ein PDF ist ohne Anmeldung pauschal zu, egal was am Datensatz steht
      const proben = await request.get(`${BASIS}/api/media?limit=200`, { headers: kopf })
      const pdf = (await proben.json()).docs?.find((m: { mimeType?: string }) =>
        m.mimeType === 'application/pdf',
      )
      if (pdf?.filename) {
        expect(
          (await fremder.get(`${BASIS}/api/media/file/${encodeURIComponent(pdf.filename)}`)).status(),
        ).toBe(403)
      }
    } finally {
      await fremder.dispose()
      await request.delete(`${BASIS}/api/media/${id}`, { headers: kopf })
    }
  })
})
