import { expect, test } from '@playwright/test'
import { WebSocket } from 'ws'

/**
 * Prüft die Live-Verbindung des Büros vom Anfang bis zum Ende.
 *
 * Anlass sind zwei Fehler, die beide still waren: Next hängt sich in der
 * Entwicklung selbst an das `upgrade`-Ereignis und warf unsere Verbindung
 * sofort wieder weg — der Browser hätte nur nichts mehr bekommen, ohne
 * Fehlermeldung. Und ohne die Sammelstelle auf `globalThis` verpufft jede
 * Meldung ebenso lautlos.
 *
 * Deshalb hier der ganze Weg: anmelden, Eintrittskarte holen, verbinden,
 * einen Datensatz anlegen und darauf warten, dass die Meldung ankommt.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Payload nimmt den Anmelde-Keks nur an, wenn die Anfrage wie aus einem
 * Browser aussieht — ohne Herkunft gilt sie als fremd und der Benutzer als
 * nicht angemeldet.
 */
const WIE_IM_BROWSER = { Origin: BASIS, 'Sec-Fetch-Site': 'same-origin' }

/** Wartet auf eine Meldung, die zum Bereich passt — oder gibt auf. */
function warteAufMeldung(draht: WebSocket, bereich: string, frist = 10_000) {
  return new Promise<Record<string, unknown>>((fertig, fehler) => {
    const uhr = setTimeout(() => fehler(new Error(`Keine Meldung für ${bereich}`)), frist)
    draht.on('message', (roh) => {
      try {
        const meldung = JSON.parse(String(roh))
        if (meldung?.bereich === bereich) {
          clearTimeout(uhr)
          fertig(meldung)
        }
      } catch {
        // Unverständliches ignorieren
      }
    })
  })
}

test.describe('Live-Verbindung', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('Änderung erreicht die offene Verbindung', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      headers: WIE_IM_BROWSER,
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()

    const kekse = (await request.storageState()).cookies
      .map((k) => `${k.name}=${k.value}`)
      .join('; ')

    const karteAntwort = await request.get(`${BASIS}/api/office/live`, {
      headers: WIE_IM_BROWSER,
    })
    expect(karteAntwort.status(), 'Eintrittskarte').toBe(200)
    const { karte } = await karteAntwort.json()
    expect(karte).toBeTruthy()

    const adresse = new URL(BASIS)
    const draht = new WebSocket(
      `${adresse.protocol === 'https:' ? 'wss' : 'ws'}://${adresse.host}/ws/buero?karte=${encodeURIComponent(karte)}`,
    )
    try {
      await new Promise<void>((fertig, fehler) => {
        draht.on('open', () => fertig())
        draht.on('error', fehler)
        setTimeout(() => fehler(new Error('Verbindung kam nicht zustande')), 10_000)
      })

      // Die Verbindung muss halten — genau hier warf Next sie vorher weg
      await new Promise((r) => setTimeout(r, 1500))
      expect(draht.readyState, 'Verbindung steht noch').toBe(WebSocket.OPEN)

      const meldung = warteAufMeldung(draht, 'partner')
      const angelegt = await request.post(`${BASIS}/api/contacts`, {
        headers: { ...WIE_IM_BROWSER, Cookie: kekse },
        data: { name: `Prüfpartner ${Date.now()}`, type: 'lieferant' },
      })
      expect(angelegt.status(), 'Partner angelegt').toBe(201)

      expect(await meldung).toMatchObject({ bereich: 'partner', art: 'neu' })
    } finally {
      draht.close()
    }
  })

  test('ohne Eintrittskarte keine Verbindung', async () => {
    const adresse = new URL(BASIS)
    const draht = new WebSocket(
      `${adresse.protocol === 'https:' ? 'wss' : 'ws'}://${adresse.host}/ws/buero?karte=erfunden`,
    )
    const ausgang = await new Promise<string>((fertig) => {
      draht.on('open', () => fertig('offen'))
      draht.on('error', () => fertig('abgewiesen'))
      setTimeout(() => fertig('nichts passiert'), 8000)
    })
    draht.close()
    expect(ausgang).toBe('abgewiesen')
  })
})
