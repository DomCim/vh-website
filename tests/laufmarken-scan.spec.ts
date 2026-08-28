import { type APIRequestContext, expect, test } from '@playwright/test'

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Der ganze Weg einer Laufmarke — gegen den laufenden Server.
 *
 * Marke anlegen, an einen Auftrag koppeln, als Gast scannen (nichts sehen),
 * als Betrieb mit PIN anmelden (nur den eigenen Schritt sehen), bestätigen,
 * Büro bucht raus und zurück, Auftrag geliefert → Marke frei → der alte
 * Betrieb sieht wieder nichts.
 *
 * Das Wichtigste steht zwischen den Zeilen: **kein Kundenmail-Versand** beim
 * Scan (geprüft am Mail-Protokoll) und **keine Auftragsdaten für Unbefugte**.
 */
test.describe('Laufmarken am laufenden Server', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  async function buero(request: APIRequestContext) {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    return token ? { Authorization: `JWT ${token}` } : null
  }

  test('Gast-Sicht ist für echten und erfundenen Code identisch', async ({ request }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen — läuft der Server?')

    const angelegt = await request.post(`${BASIS}/api/office/laufmarken`, {
      headers: kopf!,
      data: { aktion: 'anlegen', anzahl: 1 },
    })
    expect(angelegt.ok()).toBe(true)
    const { codes } = (await angelegt.json()) as { codes: string[] }

    // Ohne jede Anmeldung: echter Code und erfundener Code — dieselbe Antwort
    const echt = await request.get(`${BASIS}/api/m/${codes[0]}`, {
      headers: { Authorization: '' },
    })
    const erfunden = await request.get(`${BASIS}/api/m/M-999999`, {
      headers: { Authorization: '' },
    })
    expect(await echt.json()).toEqual({ sicht: 'gast' })
    expect(await erfunden.json()).toEqual({ sicht: 'gast' })
  })

  test('PIN-Anmeldung, eigener Schritt, Bestätigung, Rückgabe', async ({ request, browser }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen')

    // Ein Dienstleister mit PIN
    const betrieb = await request.post(`${BASIS}/api/office/partner`, {
      headers: kopf!,
      data: { name: `Verzinkerei Probe ${Date.now()}`, role: 'dienstleister' },
    })
    expect(betrieb.ok()).toBe(true)
    const { id: betriebId } = (await betrieb.json()) as { id: number }
    const pinAntwort = await request.post(`${BASIS}/api/office/partner`, {
      headers: kopf!,
      data: { aktion: 'markenPin', id: betriebId },
    })
    expect(pinAntwort.ok()).toBe(true)
    const { pin } = (await pinAntwort.json()) as { pin: string }
    expect(pin).toMatch(/^[A-Z2-9]{8}$/)

    // Ein Auftrag voller Dinge, die der Betrieb nie sehen darf
    const auftrag = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: {
        title: `Marken-Probe ${Date.now()}`,
        customerName: 'Geheimer Kunde',
        notes: 'Rabatt mündlich zugesagt',
        positions: [
          { description: 'Tor 300 × 180', quantity: 2, price: 4890, farbe: 'Rubinrot (RAL 3003)' },
        ],
        arbeitsplan: [
          { was: 'Zuschnitt', art: 'eigen', minuten: 60 },
          { was: 'Verzinken', art: 'fremd', dienstleister: betriebId, kosten: 260, vorlaufTage: 5 },
        ],
      },
    })
    expect(auftrag.ok()).toBe(true)
    const { id: auftragId } = (await auftrag.json()) as { id: number }

    // Marke anlegen und koppeln
    const angelegt = await request.post(`${BASIS}/api/office/laufmarken`, {
      headers: kopf!,
      data: { aktion: 'anlegen', anzahl: 1 },
    })
    const { codes } = (await angelegt.json()) as { codes: string[] }
    const code = codes[0]
    const gekoppelt = await request.post(`${BASIS}/api/office/laufmarken`, {
      headers: kopf!,
      data: { aktion: 'koppeln', code, auftragId },
    })
    expect(gekoppelt.ok()).toBe(true)

    // Doppelt koppeln geht nicht — eine Marke, ein Auftrag
    const nochmal = await request.post(`${BASIS}/api/office/laufmarken`, {
      headers: kopf!,
      data: { aktion: 'koppeln', code, auftragId },
    })
    expect(nochmal.status()).toBe(409)

    /*
     * Der Betrieb scannt — in einem eigenen Browser-Kontext, damit weder das
     * Büro-Cookie noch der JWT-Kopf mitreist. Genau so kommt der Beschichter
     * an: fremdes Gerät, keine Anmeldung.
     */
    const fremd = await browser.newContext()
    const extern = fremd.request

    const falscherPin = await extern.post(`${BASIS}/api/m/${code}`, {
      data: { aktion: 'anmelden', pin: 'FALSCH99' },
    })
    expect(falscherPin.status()).toBe(401)

    const anmeldung = await extern.post(`${BASIS}/api/m/${code}`, {
      data: { aktion: 'anmelden', pin },
    })
    expect(anmeldung.ok()).toBe(true)
    const sicht = (await anmeldung.json()) as {
      sicht: string
      schritt: { was: string }
      positionen: { beschreibung: string; farbe: string | null }[]
    }
    expect(sicht.sicht).toBe('dienstleister')
    expect(sicht.schritt.was).toBe('Verzinken')
    expect(sicht.positionen[0].farbe).toBe('Rubinrot (RAL 3003)')

    // Die Whitelist am lebenden Objekt: nichts Verbotenes in der Antwort
    const roh = JSON.stringify(sicht)
    for (const verboten of ['4890', '260', 'Geheimer Kunde', 'Rabatt', 'Zuschnitt', 'AU-']) {
      expect(roh, `„${verboten}" darf nicht in der Antwort stehen`).not.toContain(verboten)
    }

    // Bestätigen — und ein Doppel-Scan ändert nichts (idempotent)
    const angekommen = await extern.post(`${BASIS}/api/m/${code}`, { data: { aktion: 'angekommen' } })
    expect(angekommen.ok()).toBe(true)
    const zeit1 = ((await angekommen.json()) as { schritt: { angekommenAm: string } }).schritt
      .angekommenAm
    expect(zeit1).toBeTruthy()
    const nochmalAngekommen = await extern.post(`${BASIS}/api/m/${code}`, {
      data: { aktion: 'angekommen' },
    })
    const zeit2 = ((await nochmalAngekommen.json()) as { schritt: { angekommenAm: string } })
      .schritt.angekommenAm
    expect(zeit2).toBe(zeit1)

    // Kein Kundenmail-Versand durch den Scan: Der Status blieb unangetastet
    const stand = await request.get(`${BASIS}/api/jobs/${auftragId}?depth=0`, { headers: kopf! })
    const doc = (await stand.json()) as { status: string; gemeldet?: { inFertigung?: string | null } }
    expect(doc.status).toBe('geplant')
    expect(doc.gemeldet?.inFertigung ?? null).toBeNull()

    /*
     * Eigene Arbeit abhaken — der Weg, den die Scan-Seite für „CNC - ASP2"
     * und Verwandte braucht. Bei Fremd-Schritten wäre er falsch (da gilt
     * raus/zurück), aber bei eigener Arbeit war vorher gar kein Knopf da.
     */
    const abgehakt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: { aktion: 'schrittErledigt', id: auftragId, schritt: 0 },
    })
    expect(abgehakt.ok()).toBe(true)
    const nachAbhaken = await request.get(`${BASIS}/api/jobs/${auftragId}?depth=0`, {
      headers: kopf!,
    })
    const planEigen = ((await nachAbhaken.json()) as { arbeitsplan: Record<string, unknown>[] })
      .arbeitsplan
    expect(planEigen[0].stand).toBe('erledigt')
    expect(planEigen[0].erledigtAm).toBeTruthy()
    // Und kein rausAm: Was das Haus nie verlässt, ist nicht draußen gewesen
    expect(planEigen[0].rausAm ?? null).toBeNull()

    // Umgekehrt bleibt raus/zurück den Fremd-Schritten vorbehalten
    const falsch = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: { aktion: 'schrittRaus', id: auftragId, schritt: 0 },
    })
    expect(falsch.status()).toBe(400)

    /*
     * Die Zeit, die beim Abhaken mitgeht: dieselbe Arbeitszeit-Liste wie die
     * Stoppuhr, mit dem Namen des Arbeitsgangs als Beschriftung. Ohne sie
     * bliebe die Nachkalkulation blind — der Anlass der ganzen Sache.
     */
    const gebucht = await request.post(`${BASIS}/api/office/zeit`, {
      headers: kopf!,
      data: { aktion: 'nachtragen', id: auftragId, minuten: 75, notiz: 'Zuschnitt' },
    })
    expect(gebucht.ok()).toBe(true)
    const mitZeit = await request.get(`${BASIS}/api/jobs/${auftragId}?depth=0`, { headers: kopf! })
    const zeiten = ((await mitZeit.json()) as { timeEntries?: Record<string, unknown>[] })
      .timeEntries
    expect(zeiten?.some((z) => z.minutes === 75 && z.note === 'Zuschnitt')).toBe(true)

    // Und die zwei Schalter, nach denen die Scan-Seite ihr Feld richtet
    const regel = await request.get(`${BASIS}/api/office/laufmarken`, { headers: kopf! })
    expect(regel.ok()).toBe(true)
    const { schrittzeit } = (await regel.json()) as {
      schrittzeit: { pflicht: boolean; planzeitVorbelegen: boolean }
    }
    expect(typeof schrittzeit.pflicht).toBe('boolean')
    expect(typeof schrittzeit.planzeitVorbelegen).toBe('boolean')

    // Büro bucht raus und zurück — die zwei engen Wege
    const raus = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: { aktion: 'schrittRaus', id: auftragId, schritt: 1 },
    })
    expect(raus.ok()).toBe(true)
    const zurueck = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: { aktion: 'schrittZurueck', id: auftragId, schritt: 1 },
    })
    expect(zurueck.ok()).toBe(true)
    const danach = await request.get(`${BASIS}/api/jobs/${auftragId}?depth=0`, { headers: kopf! })
    const plan = ((await danach.json()) as { arbeitsplan: Record<string, unknown>[] }).arbeitsplan
    expect(plan[1].stand).toBe('erledigt')
    expect(plan[1].rausAm).toBeTruthy()
    expect(plan[1].zurueckAm).toBeTruthy()
    // Die Meldung des Betriebs blieb dabei stehen — zwei Schreiber, zwei Felder
    expect(plan[1].angekommenAm).toBeTruthy()

    /*
     * Geliefert → die Marke wird frei, und der alte Betrieb sieht nichts mehr.
     * Lieferart Abholung, damit keine Sendungsnummer nötig ist.
     */
    const geliefert = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: { id: auftragId, lieferart: 'abholung', kundeBenachrichtigen: false, status: 'geliefert' },
    })
    expect(geliefert.ok()).toBe(true)

    const marke = await request.get(
      `${BASIS}/api/job-tags?where[code][equals]=${code}&depth=0`,
      { headers: kopf! },
    )
    const markeDoc = ((await marke.json()) as { docs: { auftrag: unknown; verlauf: unknown[] }[] })
      .docs[0]
    expect(markeDoc.auftrag).toBeNull()
    expect(markeDoc.verlauf).toHaveLength(1)

    const alterBetrieb = await extern.get(`${BASIS}/api/m/${code}`)
    expect(await alterBetrieb.json()).toEqual({ sicht: 'gast' })

    await fremd.close()
    // Aufräumen
    await request.delete(`${BASIS}/api/jobs/${auftragId}`, { headers: kopf! })
  })

  test('nach zehn Fehlversuchen fällt die Bremse', async ({ request, browser }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen')
    // Ein frischer Code, damit die Bremse nur diesen Test zählt
    const angelegt = await request.post(`${BASIS}/api/office/laufmarken`, {
      headers: kopf!,
      data: { aktion: 'anlegen', anzahl: 1 },
    })
    const { codes } = (await angelegt.json()) as { codes: string[] }

    const fremd = await browser.newContext()
    let letzter = 0
    for (let i = 0; i < 11; i += 1) {
      const r = await fremd.request.post(`${BASIS}/api/m/${codes[0]}`, {
        data: { aktion: 'anmelden', pin: 'FALSCH99' },
      })
      letzter = r.status()
    }
    expect(letzter).toBe(429)
    await fremd.close()
  })

  test('das Druckblatt kommt als PDF', async ({ request }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen')
    const blatt = await request.get(`${BASIS}/api/office/laufmarken/blatt`, { headers: kopf! })
    expect(blatt.ok()).toBe(true)
    expect(blatt.headers()['content-type']).toContain('application/pdf')
    expect((await blatt.body()).subarray(0, 4).toString()).toBe('%PDF')
  })

  test('die Scan-Seite lädt serverseitig keine Auftragsdaten', async ({ browser }) => {
    // Die Seite selbst, ohne jede Anmeldung — sie zeigt den Gast-Satz
    const fremd = await browser.newContext()
    const seite = await fremd.newPage()
    await seite.goto(`${BASIS}/de/m/M-000001-test`)
    await expect(seite.getByText('Diese Marke gehört zu einem Auftrag')).toBeVisible()
    await expect(seite.getByText('PIN Ihres Betriebs')).toBeVisible()
    await fremd.close()
  })
})
