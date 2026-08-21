import zlib from 'zlib'

import { expect, test } from '@playwright/test'

/**
 * Der Büro-Ausbau vom August 2026, serverseitig geprüft:
 *
 * - Textbausteine: Die Leseroute liefert Angemeldeten die Liste — und sonst
 *   niemandem, denn sie hängt an den Integrationen.
 * - Wiederkehrende Belege: Der Turnus überlebt den Weg durch die Beleg-Route.
 * - Abnahme: Aus Unterschrift wird Protokoll, der Auftrag merkt sich die
 *   Abnahme, und eine zweite Unterschrift wird abgewiesen — ein
 *   Abnahmeprotokoll wird nie überschrieben.
 * - Monatspaket: Das ZIP für den Steuerberater kommt als ZIP heraus.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Ein echtes PNG für die Unterschrift, ohne Browser gemalt.
 *
 * Die Route verlangt ein PNG von ein paar hundert Bytes — ein 1×1-Bildchen
 * fiele durch die Junk-Sperre. Hier entsteht ein 120×40-Streifen mit ein
 * paar schwarzen Pixeln, Byte für Byte nach PNG-Bauplan.
 */
function unterschriftPng(): Buffer {
  const breite = 120
  const hoehe = 40
  const zeilen: Buffer[] = []
  for (let y = 0; y < hoehe; y++) {
    const zeile = Buffer.alloc(1 + breite) // Filtertyp 0 + Graustufen-Pixel
    for (let x = 0; x < breite; x++) {
      // Eine Wellenlinie — irgendetwas, das nach Strich aussieht
      const strich = Math.abs(y - (20 + Math.round(10 * Math.sin(x / 8)))) <= 1
      zeile[1 + x] = strich ? 0 : 255
    }
    zeilen.push(zeile)
  }
  const roh = zlib.deflateSync(Buffer.concat(zeilen))

  const crcTabelle = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const byte of b) c = crcTabelle[(c ^ byte) & 0xff]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const stueck = (typ: string, daten: Buffer) => {
    const laenge = Buffer.alloc(4)
    laenge.writeUInt32BE(daten.length)
    const rumpf = Buffer.concat([Buffer.from(typ, 'ascii'), daten])
    const pruefsumme = Buffer.alloc(4)
    pruefsumme.writeUInt32BE(crc(rumpf))
    return Buffer.concat([laenge, rumpf, pruefsumme])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(breite, 0)
  ihdr.writeUInt32BE(hoehe, 4)
  ihdr[8] = 8 // Bittiefe
  ihdr[9] = 0 // Graustufen

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stueck('IHDR', ihdr),
    stueck('IDAT', roh),
    stueck('IEND', Buffer.alloc(0)),
  ])
}

test.describe('Büro-Ausbau: Bausteine, Turnus, Abnahme, Monatspaket', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('alle vier Strecken antworten wie versprochen', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    // Payload prüft bei Schreibzugriffen die Herkunft — ohne diese Kopfzeilen
    // antwortet es 403, sobald der Anmelde-Keks aus dem Login mitfährt
    const kopf = {
      Authorization: `JWT ${token}`,
      Origin: BASIS,
      'Sec-Fetch-Site': 'same-origin',
    }
    const kennung = `${Date.now()}-${Math.round(Math.random() * 1e6)}`

    // ── Textbausteine: ohne Anmeldung zu, mit Anmeldung eine Liste ──────────
    const fremd = await request.get(`${BASIS}/api/office/textbausteine`)
    expect(fremd.status(), 'Textbausteine ohne Anmeldung verschlossen').toBe(403)
    const bausteine = await request.get(`${BASIS}/api/office/textbausteine`, { headers: kopf })
    expect(bausteine.status(), 'Textbausteine für Angemeldete lesbar').toBe(200)
    expect(Array.isArray((await bausteine.json()).bausteine)).toBe(true)

    // ── Wiederkehrender Beleg: der Turnus kommt an ──────────────────────────
    const beleg = await request.post(`${BASIS}/api/office/beleg`, {
      headers: kopf,
      data: {
        supplierName: `Prüf-Vermieter ${kennung}`,
        invoiceDate: new Date().toISOString(),
        grossAmount: 850,
        category: 'miete',
        turnus: 'monatlich',
        paid: false,
        deductible: true,
      },
    })
    expect(beleg.status(), 'Beleg mit Turnus angelegt').toBe(200)
    const belegId = (await beleg.json()).id
    const belegPruefen = await request.get(`${BASIS}/api/expenses/${belegId}`, { headers: kopf })
    expect((await belegPruefen.json()).turnus, 'Turnus gespeichert').toBe('monatlich')

    // ── Abnahme: Unterschrift → Protokoll, zweite Unterschrift abgewiesen ───
    const auftrag = await request.post(`${BASIS}/api/jobs`, {
      headers: kopf,
      data: { title: `Prüf-Geländer ${kennung}`, status: 'geplant', customerName: 'Prüfkunde' },
    })
    expect(auftrag.status(), 'Auftrag angelegt').toBe(201)
    const auftragId = (await auftrag.json()).doc.id

    const unterschrift = `data:image/png;base64,${unterschriftPng().toString('base64')}`
    const abnahme = await request.post(`${BASIS}/api/office/auftrag/${auftragId}/abnahme`, {
      headers: kopf,
      data: { unterschrift, name: 'Prüfkunde', ort: 'Prüfstadt' },
    })
    expect(abnahme.status(), 'Abnahme angenommen').toBe(200)
    expect((await abnahme.json()).dateiname).toContain('Abnahme-')

    const nochmal = await request.post(`${BASIS}/api/office/auftrag/${auftragId}/abnahme`, {
      headers: kopf,
      data: { unterschrift, name: 'Zweitkunde' },
    })
    expect(nochmal.status(), 'zweite Abnahme abgewiesen').toBe(409)

    const auftragDanach = await request.get(`${BASIS}/api/jobs/${auftragId}`, { headers: kopf })
    const abnahmeStand = (await auftragDanach.json()).abnahme
    expect(abnahmeStand?.am, 'Abnahmezeitpunkt am Auftrag').toBeTruthy()
    expect(abnahmeStand?.name).toBe('Prüfkunde')

    // Das Protokoll liegt bei den Vorgangsdateien des Auftrags
    const dateien = await request.get(
      `${BASIS}/api/product-files?where[auftrag][equals]=${auftragId}`,
      { headers: kopf },
    )
    const eintraege = (await dateien.json()).docs as { label?: string; folder?: string }[]
    expect(
      eintraege.some((d) => d.folder === 'Abnahme' && (d.label ?? '').startsWith('Abnahme-')),
      'Abnahmeprotokoll in den Vorgangsdateien',
    ).toBe(true)

    // ── Monatspaket: kommt als ZIP heraus ───────────────────────────────────
    const jetzt = new Date()
    const paket = await request.get(
      `${BASIS}/api/office/steuer/monat?jahr=${jetzt.getFullYear()}&monat=${jetzt.getMonth() + 1}`,
      { headers: kopf },
    )
    expect(paket.status(), 'Monatspaket lieferbar').toBe(200)
    expect(paket.headers()['content-type']).toContain('application/zip')
    // Jedes ZIP beginnt mit „PK"
    expect((await paket.body()).subarray(0, 2).toString('ascii')).toBe('PK')
  })
})
