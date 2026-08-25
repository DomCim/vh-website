import zlib from 'node:zlib'

import { expect, test } from '@playwright/test'

/**
 * Fotos zum Zustand bei der Übergabe.
 *
 * Der Lieferschein sagt, **was** mitgefahren ist — nicht, in welchem Zustand.
 * Genau darum wird gestritten, wenn eine Kante verbogen ankommt: War sie das
 * vorher, oder ist es beim Transport passiert? Die Fotos beantworten das auf
 * demselben Blatt, das der Empfänger unterschreibt.
 *
 * Geprüft wird der ganze Weg — hochladen, am Auftrag stehen, aufs Papier
 * kommen — und die beiden Stellen, an denen es schiefgehen kann: ein falscher
 * Dateityp und der Seitenumbruch bei vielen Fotos.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Ein winziges PNG, von Hand gebaut.
 *
 * Kein Beiwerk aus dem Netz und keine Datei im Repository: Der Test soll
 * überall laufen, und ein echtes Foto brächte Megabyte mit, um nichts zu
 * beweisen, was ein Schachbrettmuster nicht auch beweist.
 */
function pngBauen(breite = 240, hoehe = 180): Buffer {
  const zeilen: number[] = []
  for (let y = 0; y < hoehe; y++) {
    zeilen.push(0) // Filtertyp je Zeile
    for (let x = 0; x < breite; x++) {
      const hell = (Math.floor(x / 30) + Math.floor(y / 30)) % 2 === 0
      zeilen.push(...(hell ? [176, 92, 48] : [232, 228, 222]))
    }
  }
  const stueck = (art: string, daten: Buffer) => {
    const laenge = Buffer.alloc(4)
    laenge.writeUInt32BE(daten.length)
    const koerper = Buffer.concat([Buffer.from(art, 'latin1'), daten])
    const pruef = Buffer.alloc(4)
    pruef.writeUInt32BE(crc32(koerper))
    return Buffer.concat([laenge, koerper, pruef])
  }

  const kopf = Buffer.alloc(13)
  kopf.writeUInt32BE(breite, 0)
  kopf.writeUInt32BE(hoehe, 4)
  kopf[8] = 8 // 8 Bit je Kanal
  kopf[9] = 2 // Farbe, ohne Alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    stueck('IHDR', kopf),
    stueck('IDAT', zlib.deflateSync(Buffer.from(zeilen))),
    stueck('IEND', Buffer.alloc(0)),
  ])
}

/** CRC-32, falls die Node-Fassung es nicht selbst mitbringt. */
function crc32(daten: Buffer): number {
  let c = ~0
  for (const b of daten) {
    c ^= b
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

/** Wie viele Seiten hat das PDF? */
const seiten = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length

/** Wie viele Bilder stecken darin? (Das Logo zählt mit.) */
const bilder = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Subtype\s*\/Image/g) ?? []).length

test.describe('Fotos zur Übergabe', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('kommen an den Auftrag und auf den Lieferschein', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: {
        title: 'Prüflauf Übergabefotos',
        customerName: 'Prüf-Kundschaft',
        status: 'fertig',
        positions: [{ description: 'Sitzbank Corten', quantity: 1, price: 900 }],
      },
    })
    expect(angelegt.ok()).toBeTruthy()
    const { id } = await angelegt.json()

    // Ohne Fotos: der Lieferschein wie immer
    const ohne = await request.get(`${BASIS}/api/office/auftrag/${id}/lieferschein`, {
      headers: kopf,
    })
    expect(ohne.ok()).toBeTruthy()
    const ohneBytes = Buffer.from(await ohne.body())
    const ohneBilder = bilder(ohneBytes)

    const foto = pngBauen()
    const hochladen = (bemerkung?: string) =>
      request.post(`${BASIS}/api/office/auftrag/${id}/uebergabefoto`, {
        headers: kopf,
        multipart: {
          datei: { name: 'verladung.png', mimeType: 'image/png', buffer: foto },
          ...(bemerkung ? { bemerkung } : {}),
        },
      })

    const erstes = await hochladen('auf Palette, Kanten mit Filz')
    expect(erstes.ok(), 'das Foto wird angenommen').toBeTruthy()
    const zweites = await hochladen()
    expect(zweites.ok(), 'auch ohne Bemerkung').toBeTruthy()

    /*
     * Angehängt, nicht ersetzt: Zwei Leute, die bei einer Verladung
     * gleichzeitig fotografieren, sind der Normalfall. Wer die Liste
     * überschreibt, nimmt dem anderen sein Foto weg.
     */
    const auftrag = await request.get(`${BASIS}/api/jobs/${id}?depth=0`, { headers: kopf })
    const stand = (await auftrag.json()) as {
      uebergabefotos?: { bild?: unknown; bemerkung?: string | null }[]
    }
    expect(stand.uebergabefotos, 'beide Fotos hängen am Auftrag').toHaveLength(2)
    expect(stand.uebergabefotos?.[0]?.bemerkung).toBe('auf Palette, Kanten mit Filz')
    expect(stand.uebergabefotos?.[1]?.bemerkung ?? null).toBeNull()

    // Mit Fotos: sie stehen auf dem Blatt
    const mit = await request.get(`${BASIS}/api/office/auftrag/${id}/lieferschein`, {
      headers: kopf,
    })
    expect(mit.ok()).toBeTruthy()
    const mitBytes = Buffer.from(await mit.body())
    expect(bilder(mitBytes), 'zwei Bilder mehr als ohne Fotos').toBe(ohneBilder + 2)

    /*
     * Und das Blatt bleibt leicht. Genommen wird eine kleine Fassung — ein
     * 4000-Pixel-Foto machte den Lieferschein um Megabyte schwerer, ohne dass
     * man mehr erkennt, und niemand könnte ihn mailen.
     */
    expect(mitBytes.length - ohneBytes.length, 'die Fotos wiegen wenig').toBeLessThan(500_000)
    expect(seiten(mitBytes), 'zwei Fotos passen auf eine Seite').toBe(1)
  })

  test('weisen ab, was kein Bild ist', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: { title: 'Prüflauf Dateityp', status: 'geplant' },
    })
    const { id } = await angelegt.json()

    const versuch = await request.post(`${BASIS}/api/office/auftrag/${id}/uebergabefoto`, {
      headers: kopf,
      multipart: {
        datei: { name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('kein Bild') },
      },
    })
    expect(versuch.status()).toBe(400)
    expect((await versuch.json()).error).toBe('dateityp')
  })

  /**
   * Der Umbruch — und warum er eigene Prüfung verdient.
   *
   * Zwei hässliche Fassungen gab es schon: erst eine einzelne Fotoreihe, die
   * allein am Blattende hing, dann eine dritte Seite, auf der nur noch die
   * beiden Unterschriftslinien standen. Beides fällt nicht auf, wenn man nur
   * zählt, ob die Bilder drin sind.
   */
  test('brechen bei vielen Fotos ordentlich um', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: {
        title: 'Prüflauf Umbruch',
        customerName: 'Prüf-Kundschaft',
        status: 'fertig',
        positions: Array.from({ length: 6 }, (_, i) => ({
          description: `Position ${i + 1}: Sitzbank Cortenstahl, 2,00 m, nach Zeichnung`,
          quantity: 1,
          price: 480,
        })),
      },
    })
    const { id } = await angelegt.json()

    const foto = pngBauen()
    const bemerkungen = [
      'auf Palette, Kanten mit Filz',
      'Sichtseite oben, ohne Kratzer',
      '',
      'Umreifung doppelt, Ecken geschützt',
      'Beschriftung Richtung Ladetor',
      'Ladung gesichert, Zurrgurte über der Palette',
    ]
    for (const bemerkung of bemerkungen) {
      const a = await request.post(`${BASIS}/api/office/auftrag/${id}/uebergabefoto`, {
        headers: kopf,
        multipart: {
          datei: { name: 'verladung.png', mimeType: 'image/png', buffer: foto },
          ...(bemerkung ? { bemerkung } : {}),
        },
      })
      expect(a.ok()).toBeTruthy()
    }

    const pdf = await request.get(`${BASIS}/api/office/auftrag/${id}/lieferschein`, {
      headers: kopf,
    })
    expect(pdf.ok()).toBeTruthy()
    const bytes = Buffer.from(await pdf.body())

    // Alle sechs sind drauf — keines fällt beim Umbruch heraus
    expect(bilder(bytes)).toBeGreaterThanOrEqual(6)

    /*
     * Zwei Seiten sind in Ordnung, drei nicht: Bei drei stand auf der letzten
     * nur die Unterschriftslinie. Der Prüfsatz und die Linien gehören auf die
     * Seite, auf der die Fotos enden.
     */
    expect(seiten(bytes), 'sechs Fotos brauchen genau zwei Seiten').toBe(2)
  })

  /**
   * Vier Fotos passen noch auf ein Blatt — und das ist der häufige Fall.
   *
   * Zwei Anläufe brauchten hier zwei Seiten, weil der Abstand über den
   * Unterschriften starr war und die Unterkante fünfzehn Punkte zu vorsichtig
   * angesetzt: Es fehlten am Ende fünf Punkte, und dafür entstand ein zweites
   * Blatt mit nichts als den beiden Linien darauf.
   */
  test('vier Fotos bleiben auf einem Blatt', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf,
      data: {
        title: 'Prüflauf vier Fotos',
        customerName: 'Prüf-Kundschaft',
        status: 'fertig',
        positions: [{ description: 'Sitzbank Corten', quantity: 1, price: 900 }],
      },
    })
    const { id } = await angelegt.json()

    const foto = pngBauen()
    for (let i = 1; i <= 4; i++) {
      const a = await request.post(`${BASIS}/api/office/auftrag/${id}/uebergabefoto`, {
        headers: kopf,
        multipart: {
          datei: { name: 'verladung.png', mimeType: 'image/png', buffer: foto },
          bemerkung: `Foto ${i}: Verpackung geprüft und dokumentiert`,
        },
      })
      expect(a.ok()).toBeTruthy()
    }

    const pdf = await request.get(`${BASIS}/api/office/auftrag/${id}/lieferschein`, {
      headers: kopf,
    })
    const bytes = Buffer.from(await pdf.body())
    expect(bilder(bytes)).toBeGreaterThanOrEqual(4)
    expect(seiten(bytes), 'vier Fotos samt Unterschriften passen auf eine Seite').toBe(1)
  })
})
