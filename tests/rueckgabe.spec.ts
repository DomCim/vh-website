import { expect, test } from '@playwright/test'

import { RUECKGABE_GRUND, RUECKGABE_STATUS, RUECKGABE_UEBERGAENGE, werteVon } from '../src/lib/listen'

/**
 * Ein Storno hatte keine Folgen — jetzt hat es welche.
 *
 * Wer eine Bestellung auf „storniert" setzte, änderte ein Wort und sonst
 * nichts: Das verkaufte Werkstattstück blieb ausgeblendet und war für
 * niemanden mehr zu kaufen, der Auftrag lief weiter durch die Fertigung, und
 * dass Geld zurückgeht, wusste nur, wer daran dachte.
 *
 * Geprüft wird beides — dass die Folgen eintreten, und dass eine Grenze hält,
 * die teuer wäre: Aus „erstattet" führt kein Weg zurück, weil das Geld dann
 * schon geflossen ist.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Rückabwicklung — die Wege', () => {
  test('aus erstattet und abgelehnt führt kein Weg zurück', () => {
    expect(RUECKGABE_UEBERGAENGE.erstattet).toEqual([])
    expect(RUECKGABE_UEBERGAENGE.abgelehnt).toEqual([])
  })

  test('offen führt überall hin, ware-zurück nicht mehr nach offen', () => {
    // Zurück auf „offen" hieße: Die Ware steht im Haus und gilt wieder als
    // unterwegs. Das ist keine Korrektur, das ist ein Fehler.
    expect(RUECKGABE_UEBERGAENGE.offen).toContain('wareZurueck')
    expect(RUECKGABE_UEBERGAENGE.wareZurueck).not.toContain('offen')
  })

  test('jeder Stand hat einen Weg — auch wenn er nirgendwohin führt', () => {
    for (const s of werteVon(RUECKGABE_STATUS)) {
      expect(RUECKGABE_UEBERGAENGE[s], `Für „${s}" fehlt der Eintrag`).toBeDefined()
    }
  })

  test('die drei Gründe stehen fest', () => {
    // An ihnen hängt Verschiedenes: Beim Widerruf zahlt der Kunde die
    // Rücksendung, bei der Reklamation das Haus.
    expect(werteVon(RUECKGABE_GRUND)).toEqual(['storno', 'widerruf', 'reklamation'])
  })
})

test.describe('Rückabwicklung im Büro', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  /** Meldet an und legt eine bezahlte Bestellung an */
  async function bestellung(request: import('@playwright/test').APIRequestContext) {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/orders`, {
      headers: kopf,
      data: {
        orderNumber: `VH-PRUEF-${Date.now()}`,
        status: 'paid',
        subtotal: 250,
        total: 250,
        deliveryMethod: 'pickup',
        customer: { name: 'Rückgabeprobe', email: 'rueck@example.test' },
        // Ohne Position keine Bestellung — dieselbe Prüfung wie in der Kasse
        items: [{ titleSnapshot: 'Prüfstück', quantity: 1, unitPrice: 250 }],
      },
    })
    const { doc } = await angelegt.json()
    return { kopf, id: doc.id as number, nummer: doc.orderNumber as string }
  }

  test('ein Storno legt die Rückabwicklung von selbst an', async ({ request }) => {
    const { kopf, id } = await bestellung(request)

    await request.patch(`${BASIS}/api/orders/${id}`, {
      headers: kopf,
      data: { status: 'cancelled' },
    })

    const gelesen = await request.get(`${BASIS}/api/orders/${id}`, { headers: kopf })
    const o = await gelesen.json()
    expect(o.rueckgabe?.grund).toBe('storno')
    expect(o.rueckgabe?.status).toBe('offen')
    // Der volle Betrag — beim Storno ist noch nichts unterwegs gewesen
    expect(o.rueckgabe?.betrag).toBe(250)
    expect(o.rueckgabe?.angefragtAm).toBeTruthy()
  })

  test('ein schon angelegter Vorgang wird vom Storno nicht überschrieben', async ({ request }) => {
    const { kopf, id } = await bestellung(request)

    // Erst der Widerruf mit gekürztem Betrag (Rücksendung zahlt der Kunde)
    await request.patch(`${BASIS}/api/orders/${id}`, {
      headers: kopf,
      data: {
        rueckgabe: { grund: 'widerruf', status: 'offen', betrag: 210, notiz: 'Rücksendung ab' },
      },
    })
    // Und danach das Storno — es darf den Vorgang nicht platt machen
    await request.patch(`${BASIS}/api/orders/${id}`, {
      headers: kopf,
      data: { status: 'cancelled' },
    })

    const o = await (await request.get(`${BASIS}/api/orders/${id}`, { headers: kopf })).json()
    expect(o.rueckgabe?.grund).toBe('widerruf')
    expect(o.rueckgabe?.betrag).toBe(210)
    expect(o.rueckgabe?.notiz).toBe('Rücksendung ab')
  })

  test('das Büro weist einen Stand ab, den es von dort nicht gibt', async ({ request }) => {
    const { kopf, id } = await bestellung(request)
    await request.patch(`${BASIS}/api/orders/${id}`, {
      headers: kopf,
      data: { rueckgabe: { grund: 'widerruf', status: 'erstattet' } },
    })

    const antwort = await request.post(`${BASIS}/api/office/bestellung`, {
      headers: kopf,
      data: { id, rueckgabe: { status: 'offen' } },
    })
    expect(antwort.status()).toBe(400)
    expect((await antwort.json()).error).toBe('stand-nicht-erlaubt')
  })

  test('das Büro setzt den Zeitpunkt zum Stand — nicht der Aufrufer', async ({ request }) => {
    const { kopf, id } = await bestellung(request)
    await request.patch(`${BASIS}/api/orders/${id}`, {
      headers: kopf,
      data: { rueckgabe: { grund: 'widerruf', status: 'offen' } },
    })

    const antwort = await request.post(`${BASIS}/api/office/bestellung`, {
      headers: kopf,
      data: { id, rueckgabe: { status: 'wareZurueck' } },
    })
    expect(antwort.ok()).toBe(true)

    const o = await (await request.get(`${BASIS}/api/orders/${id}`, { headers: kopf })).json()
    // Sonst stünde am Ende „Ware zurück" ohne Datum daneben
    expect(o.rueckgabe?.wareZurueckAm).toBeTruthy()
  })

  test('ein erfundener Grund kommt nicht durch', async ({ request }) => {
    const { kopf, id } = await bestellung(request)
    const antwort = await request.post(`${BASIS}/api/office/bestellung`, {
      headers: kopf,
      data: { id, rueckgabe: { grund: 'weilichkann' } },
    })
    expect(antwort.status()).toBe(400)
    expect((await antwort.json()).error).toBe('grund-unbekannt')
  })
})
