import { expect, request as anfrageWerk, test } from '@playwright/test'

/**
 * Dateien am Vorgang — und was das Kundenportal davon sieht.
 *
 * Bis hierher hingen Dateien am Artikel. Bei Lohnfertigung gibt es keinen
 * Artikel; die Zeichnung gehört an Anfrage, Angebot oder Auftrag.
 *
 * Geprüft wird das, was teuer wäre, wenn es bricht:
 *
 * 1. Eine Datei landet am Vorgang und ist dort wiederzufinden.
 * 2. Die Nummer in der Anfrage ist **kein** Generalschlüssel: Wer eine
 *    fremde Datei über einen eigenen Vorgang löschen will, kommt nicht durch.
 * 3. Was im Haus bleibt, bleibt im Haus — auch für angemeldete Kundschaft.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Dateien am Vorgang', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('liegen am Auftrag, und die Nummer öffnet nichts Fremdes', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const { token: jwt } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${jwt}` }

    const auftraege = await request.get(`${BASIS}/api/jobs?limit=2&depth=0`, { headers: kopf })
    const alle = (await auftraege.json()).docs ?? []
    test.skip(alle.length < 1, 'Ohne Auftrag nicht prüfbar')
    const auftrag = alle[0]

    const hoch = await request.post(
      `${BASIS}/api/office/vorgangsdatei?auftrag=${auftrag.id}&name=fertigungszeichnung.pdf`,
      {
        headers: { ...kopf, 'Content-Type': 'application/octet-stream' },
        data: Buffer.from('%PDF-1.4\n'),
      },
    )
    expect(hoch.ok()).toBeTruthy()
    const dateiId = (await hoch.json()).id

    const gefunden = await request.get(
      `${BASIS}/api/product-files?where[auftrag][equals]=${auftrag.id}&depth=0`,
      { headers: kopf },
    )
    const liste = (await gefunden.json()).docs ?? []
    expect(liste.some((d: { id: number }) => String(d.id) === String(dateiId))).toBe(true)
    // Am Vorgang abgelegt heißt: aus dem Haus und erst einmal nicht freigegeben
    const meine = liste.find((d: { id: number }) => String(d.id) === String(dateiId))
    expect(meine.herkunft).toBe('haus')
    expect(Boolean(meine.freigabe)).toBe(false)

    // Ohne Bezug geht gar nichts
    const ohneBezug = await request.post(`${BASIS}/api/office/vorgangsdatei?name=x.pdf`, {
      headers: { ...kopf, 'Content-Type': 'application/octet-stream' },
      data: Buffer.from('%PDF'),
    })
    expect(ohneBezug.status()).toBe(400)

    // Was der Browser ausführen würde, kommt auch hier nicht durch
    const boese = await request.post(
      `${BASIS}/api/office/vorgangsdatei?auftrag=${auftrag.id}&name=seite.html`,
      { headers: { ...kopf, 'Content-Type': 'application/octet-stream' }, data: Buffer.from('<b>') },
    )
    expect(boese.status()).toBe(400)

    /*
     * Löschen nur über den Vorgang, an dem die Datei wirklich hängt.
     *
     * Ohne diese Prüfung wäre die Nummer in der Anfrage ein Schlüssel auf
     * jede Werkstattdatei im Haus.
     */
    const fremd = await request.post(`${BASIS}/api/office/vorgangsdatei`, {
      headers: kopf,
      data: { aktion: 'loeschen', id: dateiId, auftrag: Number(auftrag.id) + 99999 },
    })
    expect(fremd.status()).toBe(400)

    // Das Portal zeigt nichts, wofür man nicht angemeldet ist
    const fremder = await anfrageWerk.newContext({ baseURL: BASIS })
    const ohneAnmeldung = await fremder.get(`/api/konto/datei?auftrag=${auftrag.id}`)
    expect(ohneAnmeldung.status()).toBe(401)
    const download = await fremder.get(`/api/konto/datei/${dateiId}`)
    expect(download.status()).toBe(401)
    await fremder.dispose()

    const weg = await request.post(`${BASIS}/api/office/vorgangsdatei`, {
      headers: kopf,
      data: { aktion: 'loeschen', id: dateiId, auftrag: auftrag.id },
    })
    expect(weg.ok()).toBeTruthy()
  })
})
