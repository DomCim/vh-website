import { expect, test } from '@playwright/test'

/**
 * Anhänge beim Versand aus dem Postfach.
 *
 * Geprüft wird die Grenze, und zwar an der Stelle, an der sie etwas wert
 * ist: **vor** allem anderen. Ein Mailserver weist zu große Post auch ab —
 * aber erst, nachdem alles hochgeladen und die Nachricht gebaut ist, und mit
 * einer Meldung, die niemand versteht. Steht die Grenze zu spät im Weg, hat
 * man dreißig Megabyte hochgeladen, um zu erfahren, dass es nicht geht.
 *
 * Der Versand selbst braucht ein echtes Postfach und ist hier deshalb nicht
 * zu haben. Dass die Grenze zuschlägt, bevor überhaupt ein Postfach gesucht
 * wird, lässt sich dagegen genau prüfen — die beiden Antworten unterscheiden
 * sich.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/** 25 MB ist die Grenze; darunter und darüber je ein Fall */
const GRENZE = 25 * 1024 * 1024

test.describe('Postfach: Anhänge', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('ohne Anmeldung geht auch das Formular nicht durch', async ({ request }) => {
    const antwort = await request.post(`${BASIS}/api/office/post`, {
      multipart: {
        daten: JSON.stringify({ aktion: 'senden', fach: 1, an: 'a@b.de' }),
        dateien: { name: 'p.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
      },
    })
    expect(antwort.status()).toBe(403)
  })

  test('zu große Anhänge werden abgewiesen, bevor irgendetwas passiert', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()

    const antwort = await request.post(`${BASIS}/api/office/post`, {
      headers: { Authorization: `JWT ${token}` },
      multipart: {
        // Ein Postfach, das es nicht gibt — die Grenze muss trotzdem zuerst greifen
        daten: JSON.stringify({ aktion: 'senden', fach: 999999, an: 'a@b.de' }),
        dateien: {
          name: 'zu-gross.bin',
          mimeType: 'application/octet-stream',
          buffer: Buffer.alloc(GRENZE + 1024),
        },
      },
    })
    expect(antwort.status()).toBe(400)
    const daten = await antwort.json()
    expect(daten.error).toBe('anhaenge-zu-gross')
    expect(daten.grenze).toBe(GRENZE)
  })

  test('was durchpasst, kommt bis zur Postfachsuche', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()

    const antwort = await request.post(`${BASIS}/api/office/post`, {
      headers: { Authorization: `JWT ${token}` },
      multipart: {
        daten: JSON.stringify({ aktion: 'senden', fach: 999999, an: 'a@b.de' }),
        dateien: { name: 'klein.txt', mimeType: 'text/plain', buffer: Buffer.from('kurz') },
      },
    })
    // Kein „zu groß" mehr — es scheitert erst am erfundenen Postfach
    expect(antwort.status()).toBe(404)
    expect((await antwort.json()).error).toBe('postfach-unbekannt')
  })
})
