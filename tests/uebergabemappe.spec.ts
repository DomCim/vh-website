import { expect, request as anfrageWerk, test } from '@playwright/test'

/**
 * Die Übergabemappe von beiden Seiten — mit laufendem Server.
 *
 * Geprüft wird, was teuer wäre, wenn es bricht:
 *
 * 1. **Ohne Bezug keine Mappe.** Ein Ordner, der an nichts hängt, ist in
 *    einem halben Jahr ein Rätsel.
 * 2. **Der Link allein öffnet nichts.** Er wandert durch Postfächer; zum
 *    Öffnen gehört das Passwort.
 * 3. **Eine Hausdatei bleibt im Haus, bis sie freigegeben ist.** Das ist der
 *    Unterschied zwischen einem Austausch und einem Leck.
 * 4. **Die Kennung in der Adresse ist kein Generalschlüssel.** Eine fremde
 *    Werkstattdatei bleibt unerreichbar, auch mit gültiger Sitzung.
 * 5. **Zurückgezogen heißt zurückgezogen** — auch für den, der schon
 *    angemeldet war.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Übergabemappe', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Link und Passwort, beide Richtungen, und nichts darüber hinaus', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const { token: jwt } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${jwt}` }

    // ── Ohne Bezug geht es nicht ─────────────────────────────────────────
    const ohneBezug = await request.post(`${BASIS}/api/office/uebergabe`, {
      headers: kopf,
      data: { aktion: 'anlegen' },
    })
    expect(ohneBezug.status()).toBe(400)
    expect((await ohneBezug.json()).error).toBe('kein-bezug')

    // ── Mappe an einem Geschäftspartner ──────────────────────────────────
    const partner = await request.post(`${BASIS}/api/contacts`, {
      headers: kopf,
      data: { name: `Prüf-Metallbau ${Date.now()}`, role: 'kunde' },
    })
    expect(partner.ok()).toBeTruthy()
    const partnerId = (await partner.json()).doc.id

    const angelegt = await request.post(`${BASIS}/api/office/uebergabe`, {
      headers: kopf,
      data: { aktion: 'anlegen', contact: partnerId },
    })
    expect(angelegt.ok()).toBeTruthy()
    const mappe = await angelegt.json()
    // Der Name entsteht aus dem Bezug — niemand muss ihn erfinden
    expect(mappe.title).toContain('Prüf-Metallbau')

    // „Zeichnungen" legt die Mappe schon selbst an — ein zweites Mal wäre
    // eine stille Dublette
    const doppelt = await request.post(`${BASIS}/api/office/uebergabe`, {
      headers: kopf,
      data: { aktion: 'ordner-anlegen', id: mappe.id, name: 'Zeichnungen' },
    })
    expect(doppelt.status()).toBe(400)

    const ordner = await request.post(`${BASIS}/api/office/uebergabe`, {
      headers: kopf,
      data: { aktion: 'ordner-anlegen', id: mappe.id, name: 'Freigaben' },
    })
    expect(ordner.ok()).toBeTruthy()

    // ── Zugang erzeugen ──────────────────────────────────────────────────
    const zugang = await request.post(`${BASIS}/api/office/uebergabe`, {
      headers: kopf,
      data: { aktion: 'link', id: mappe.id, senden: false },
    })
    expect(zugang.ok()).toBeTruthy()
    const { url, passwort } = await zugang.json()
    const kennung = url.split('/').pop() as string
    expect(kennung.length).toBeGreaterThan(20)

    // ── Der Link allein öffnet nichts ────────────────────────────────────
    const kunde = await anfrageWerk.newContext({ baseURL: BASIS })
    const ohneAnmeldung = await kunde.get(`/api/uebergabe/${kennung}`)
    expect(ohneAnmeldung.status()).toBe(401)

    const falsch = await kunde.post(`/api/uebergabe/${kennung}`, {
      data: { aktion: 'anmelden', passwort: 'XXXXXXXX' },
    })
    expect(falsch.status()).toBe(401)

    // Eine erfundene Kennung antwortet genauso — sie verrät nicht, dass es
    // die Mappe gibt
    const erfunden = await kunde.post(`/api/uebergabe/${'A'.repeat(32)}`, {
      data: { aktion: 'anmelden', passwort },
    })
    expect(erfunden.status()).toBe(401)

    const offen = await kunde.post(`/api/uebergabe/${kennung}`, {
      data: { aktion: 'anmelden', passwort },
    })
    expect(offen.ok()).toBeTruthy()
    const bild = await offen.json()
    expect(bild.ordner).toEqual(['Zeichnungen', 'Freigaben'])
    expect(bild.dateien).toHaveLength(0)

    // ── Der Auftraggeber legt etwas ab ───────────────────────────────────
    const hoch = await kunde.post(
      `/api/uebergabe/${kennung}/datei?name=zuschnitt.dxf&ordner=Zeichnungen`,
      { headers: { 'Content-Type': 'application/octet-stream' }, data: Buffer.from('0\nSECTION\n') },
    )
    expect(hoch.ok()).toBeTruthy()

    // Was der Browser ausführen würde, kommt nicht durch
    const boese = await kunde.post(`/api/uebergabe/${kennung}/datei?name=seite.html`, {
      headers: { 'Content-Type': 'application/octet-stream' },
      data: Buffer.from('<script>'),
    })
    expect(boese.status()).toBe(400)
    expect((await boese.json()).error).toBe('dateityp')

    const nachher = await (await kunde.get(`/api/uebergabe/${kennung}`)).json()
    expect(nachher.dateien).toHaveLength(1)
    expect(nachher.dateien[0].name).toBe('zuschnitt.dxf')
    expect(nachher.dateien[0].vonUns).toBe(false)

    // ── Eine Hausdatei bleibt im Haus, bis sie freigegeben ist ────────────
    const haus = await request.post(
      `${BASIS}/api/office/uebergabe/datei?mappe=${mappe.id}&name=kalkulation.pdf&ordner=Zeichnungen&freigabe=0`,
      { headers: { ...kopf, 'Content-Type': 'application/octet-stream' }, data: Buffer.from('%PDF-1.4\n') },
    )
    expect(haus.ok()).toBeTruthy()
    const hausId = (await haus.json()).id

    const zurueckgehalten = await (await kunde.get(`/api/uebergabe/${kennung}`)).json()
    expect(zurueckgehalten.dateien).toHaveLength(1)

    // Auch der unmittelbare Griff auf die Nummer geht ins Leere
    const versuch = await kunde.get(`/api/uebergabe/${kennung}/datei/${hausId}`)
    expect(versuch.status()).toBe(404)

    // ── Freigeben — und erst jetzt ist sie da ────────────────────────────
    const frei = await request.post(`${BASIS}/api/office/uebergabe`, {
      headers: kopf,
      data: { aktion: 'datei-freigeben', id: mappe.id, datei: hausId, freigabe: true },
    })
    expect(frei.ok()).toBeTruthy()

    const jetzt = await (await kunde.get(`/api/uebergabe/${kennung}`)).json()
    expect(jetzt.dateien).toHaveLength(2)
    const hausZeile = jetzt.dateien.find((d: { id: number }) => String(d.id) === String(hausId))
    expect(hausZeile.vonUns).toBe(true)

    const geladen = await kunde.get(`/api/uebergabe/${kennung}/datei/${hausId}`)
    expect(geladen.ok()).toBeTruthy()
    // Auf der Platte trägt sie einen Zeitstempel — beim Kunden darf davon
    // nichts ankommen
    expect(geladen.headers()['content-disposition']).toContain('kalkulation.pdf')
    expect(geladen.headers()['content-disposition']).not.toMatch(/\d{13}/)

    // ── Die Kennung ist kein Generalschlüssel ────────────────────────────
    const fremde = await request.get(`${BASIS}/api/product-files?limit=1&depth=0`, { headers: kopf })
    const fremdeDatei = (await fremde.json()).docs?.find(
      (d: { id: number; mappe?: unknown }) => !d.mappe,
    )
    if (fremdeDatei) {
      const verwehrt = await kunde.get(`/api/uebergabe/${kennung}/datei/${fremdeDatei.id}`)
      expect(verwehrt.status()).toBe(404)
    }

    // ── Zurückziehen wirkt sofort, auch bei bestehender Sitzung ──────────
    const zurueck = await request.post(`${BASIS}/api/office/uebergabe`, {
      headers: kopf,
      data: { aktion: 'zurueckziehen', id: mappe.id, token: kennung },
    })
    expect(zurueck.ok()).toBeTruthy()

    const danach = await kunde.get(`/api/uebergabe/${kennung}`)
    expect(danach.status()).toBe(401)
    const danachGeladen = await kunde.get(`/api/uebergabe/${kennung}/datei/${hausId}`)
    expect(danachGeladen.status()).toBe(401)

    await kunde.dispose()
  })
})
