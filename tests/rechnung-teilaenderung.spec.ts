import { expect, test } from '@playwright/test'

/**
 * Eine Teiländerung an der Rechnung darf nichts wegnehmen.
 *
 * Die Probe am laufenden Stand — die Rechenregel selbst prüft
 * `teilaenderung.spec.ts`. Hier geht es um den Weg durch die Schnittstelle:
 * Wer nur den Status setzt, soll die Positionen behalten; wer nur die
 * Positionen ändert, soll den Status behalten.
 *
 * Geprüft wird das am **Entwurf**, und das ist seit 08/2026 der Unterschied:
 * Eine gestellte Rechnung nimmt über diesen Weg gar keine Änderung mehr an
 * (siehe den zweiten Test unten). Vorher stand hier eine gestellte Rechnung,
 * die zweimal geändert wurde — die Prüfung sicherte damit genau die Freiheit
 * ab, die jetzt zugesperrt ist. Ihr eigentlicher Zweck bleibt richtig, er
 * gehört nur dorthin, wo Ändern erlaubt ist.
 *
 * Zugangsdaten kommen aus der Umgebung; ohne sie überspringt der Test.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Teiländerung an einer Rechnung', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('nimmt am Entwurf weder Positionen noch Status weg', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        status: 'entwurf',
        customerName: 'Teiländerung',
        items: [
          { description: 'Sitzbank Corten', quantity: 1, unit: 'Stück', unitPrice: 100, vatRate: 20 },
          { description: 'Lieferung', quantity: 1, unit: 'Stück', unitPrice: 60, vatRate: 20 },
        ],
      },
    })
    expect(angelegt.ok()).toBeTruthy()
    const { id } = await angelegt.json()

    const stand = async () => {
      const r = await request.get(`${BASIS}/api/outgoing-invoices/${id}?depth=0`, { headers: kopf })
      return (await r.json()) as { status: string; items?: unknown[]; customerName?: string }
    }

    expect((await stand()).items).toHaveLength(2)

    // Nur den Hinweis setzen — die Positionen bleiben
    const vermerkt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { id, note: 'Nur ein Vermerk' },
    })
    expect(vermerkt.ok()).toBeTruthy()
    const nachVermerk = await stand()
    expect(nachVermerk.items).toHaveLength(2)
    expect(nachVermerk.customerName).toBe('Teiländerung')

    // Nur eine Position ändern — der Kundenname bleibt stehen und fällt nicht
    // auf leer zurück
    const gekuerzt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        id,
        items: [
          { description: 'Sitzbank Corten', quantity: 1, unit: 'Stück', unitPrice: 100, vatRate: 20 },
        ],
      },
    })
    expect(gekuerzt.ok()).toBeTruthy()
    const nachPositionen = await stand()
    expect(nachPositionen.items).toHaveLength(1)
    expect(nachPositionen.customerName).toBe('Teiländerung')
    expect(nachPositionen.status).toBe('entwurf')

    // Aufräumen: Ein Entwurf ohne Nummer lässt sich verwerfen
    await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { aktion: 'verwerfen', id },
    })
  })

  /**
   * Der Riegel: Was gestellt ist, bleibt wie es ist.
   *
   * Eine gestellte Rechnung liegt beim Kunden und steht in dessen
   * Buchhaltung. Ließe sie sich hier noch ändern, gäbe es zwei verschiedene
   * Papiere unter derselben Nummer. Bisher hielt dagegen nur ein Satz im
   * Formular — „sollten jetzt nicht mehr geändert werden" —, und ein Klick auf
   * „Speichern" schrieb sie trotzdem um.
   *
   * Was erlaubt bleibt, steht mit in dieser Prüfung: bezahlt melden. Eine
   * eingegangene Zahlung ändert die Rechnung nicht, sie stellt nur fest, dass
   * das Geld da ist.
   */
  test('lässt sich nach dem Festschreiben nicht mehr ändern', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }

    const angelegt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: {
        status: 'gestellt',
        customerName: 'Festgeschrieben',
        note: 'So steht es auf dem Blatt',
        items: [
          { description: 'Sitzbank Corten', quantity: 2, unit: 'Stück', unitPrice: 100, vatRate: 20 },
        ],
      },
    })
    expect(angelegt.ok()).toBeTruthy()
    const { id, invoiceNumber } = await angelegt.json()
    // Das Festschreiben selbst muss durchgehen — sonst entstünde nie eine Rechnung
    expect(invoiceNumber, 'beim Festschreiben wird die Nummer vergeben').toBeTruthy()

    const stand = async () => {
      const r = await request.get(`${BASIS}/api/outgoing-invoices/${id}?depth=0`, { headers: kopf })
      return (await r.json()) as {
        status: string
        items?: unknown[]
        note?: string | null
        invoiceNumber?: string | null
        paidDate?: string | null
      }
    }

    // Den Hinweis ändern — abgewiesen
    const umgeschrieben = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { id, note: 'Das darf nicht durchgehen' },
    })
    expect(umgeschrieben.status(), 'eine gestellte Rechnung nimmt keine Änderung an').toBe(409)

    // Die Positionen leeren — der gefährlichste Fall, ebenfalls abgewiesen
    const geleert = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { id, items: [] },
    })
    expect(geleert.status(), 'und schon gar keine, die alles wegnimmt').toBe(409)

    const unberuehrt = await stand()
    expect(unberuehrt.note).toBe('So steht es auf dem Blatt')
    expect(unberuehrt.items).toHaveLength(1)
    expect(unberuehrt.invoiceNumber).toBe(invoiceNumber)

    // Bezahlt melden bleibt erlaubt — das ändert die Rechnung nicht
    const bezahlt = await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { aktion: 'bezahlt', id },
    })
    expect(bezahlt.ok(), 'bezahlt melden geht weiter').toBeTruthy()
    const danach = await stand()
    expect(danach.status).toBe('bezahlt')
    expect(danach.paidDate).toBeTruthy()
    expect(danach.items, 'und nimmt dabei nichts weg').toHaveLength(1)

    // Aufräumen: Eine gestellte Rechnung wird storniert, nicht gelöscht.
    await request.post(`${BASIS}/api/office/rechnung`, {
      headers: kopf,
      data: { aktion: 'stornieren', id, grund: 'Prüflauf' },
    })
  })
})
