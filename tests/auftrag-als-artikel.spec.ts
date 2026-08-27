import { type APIRequestContext, expect, test } from '@playwright/test'

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Aus dem Auftrag wird ein Artikel — die Vorlage für das nächste Mal.
 *
 * Geprüft wird die Übernahme-Tabelle aus dem Plan: Material ohne
 * Beigestelltes, Mengen und Minuten je Stück statt gesamt, der Ablauf ohne
 * Stand und Reise-Zeitstempel, kein Preis, nicht im Shop. Und der
 * Doppel-Riegel: Zweimal getippt gibt keinen zweiten Artikel.
 */
test.describe('Auftrag als Artikel ablegen', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  async function buero(request: APIRequestContext) {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    return token ? { Authorization: `JWT ${token}` } : null
  }

  test('übernimmt Vorlage, lässt Kundschaft und Preise zurück', async ({ request }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen — läuft der Server?')

    // Zutaten: ein Inventarposten, eine Kategorie, ein Bild
    const inventar = await request.get(`${BASIS}/api/inventory-items?limit=1&depth=0`, {
      headers: kopf!,
    })
    const posten = ((await inventar.json()) as { docs: { id: number }[] }).docs[0]
    test.skip(!posten, 'Kein Inventarposten in der Datenbank')
    const kategorien = await request.get(`${BASIS}/api/office/kategorien`, { headers: kopf! })
    const kategorie = ((await kategorien.json()) as { kategorien: { id: number }[] }).kategorien[0]
    test.skip(!kategorie, 'Keine Kategorie in der Datenbank')
    const medien = await request.get(`${BASIS}/api/media?limit=1&depth=0`, { headers: kopf! })
    const bild = ((await medien.json()) as { docs: { id: number }[] }).docs[0]
    test.skip(!bild, 'Kein Bild in der Mediathek')

    // Ein Auftrag über zwei Stück, mit allem, was NICHT mitwandern darf
    const auftrag = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: {
        title: `CNC-Lohnarbeit Probe ${Date.now()}`,
        customerName: 'Geheimer Kunde',
        plannedMinutes: 480,
        positions: [
          { description: 'Frästeil Sonderform', quantity: 2, price: 1200, farbe: 'roh' },
        ],
        material: [
          { item: posten.id, quantity: 8 },
          { item: posten.id, quantity: 4, beigestellt: true },
        ],
        arbeitsplan: [
          { was: 'Fräsen', art: 'eigen', minuten: 180, stand: 'erledigt' },
          { was: 'Entgraten', art: 'eigen', minuten: 30, stand: 'offen' },
        ],
      },
    })
    expect(auftrag.ok()).toBe(true)
    const { id: auftragId } = (await auftrag.json()) as { id: number }

    const abgelegt = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: { aktion: 'alsArtikel', id: auftragId, kategorie: kategorie.id, bild: bild.id },
    })
    expect(abgelegt.ok()).toBe(true)
    const { artikel: artikelId } = (await abgelegt.json()) as { artikel: number }

    const geladen = await request.get(`${BASIS}/api/products/${artikelId}?depth=0&locale=de`, {
      headers: kopf!,
    })
    const artikel = (await geladen.json()) as {
      title: string
      onRequestOnly?: boolean
      available?: boolean
      price?: number | null
      productionMinutes?: number | null
      billOfMaterials?: { item: number; quantity: number }[]
      arbeitsplan?: { was: string; stand?: string; erledigtAm?: string }[]
    }

    // Nicht im Shop, doppelt vernäht — und ohne Preis
    expect(artikel.onRequestOnly).toBe(true)
    expect(artikel.available).toBe(false)
    expect(artikel.price ?? null).toBeNull()

    // Je Stück statt gesamt: 8 Stück Material / 2 = 4; 480 min / 2 = 240
    expect(artikel.billOfMaterials).toHaveLength(1) // Beigestelltes bleibt draußen
    expect(artikel.billOfMaterials![0].quantity).toBe(4)
    expect(artikel.productionMinutes).toBe(240)

    // Der Ablauf als Vorlage — ohne den Stand des alten Auftrags
    expect((artikel.arbeitsplan ?? []).map((s) => s.was)).toEqual(['Fräsen', 'Entgraten'])
    expect(artikel.arbeitsplan![0].stand).toBeUndefined()
    expect(artikel.arbeitsplan![0].erledigtAm).toBeUndefined()

    // Kein Kundenname im Artikel
    expect(JSON.stringify(artikel)).not.toContain('Geheimer Kunde')

    // Rückverweis: Die Position zeigt auf den Artikel, die Farbe blieb stehen
    const stand = await request.get(`${BASIS}/api/jobs/${auftragId}?depth=0`, { headers: kopf! })
    const doc = (await stand.json()) as {
      positions: { product?: number | null; farbe?: string | null }[]
    }
    expect(doc.positions[0].product).toBe(artikelId)
    expect(doc.positions[0].farbe).toBe('roh')

    // Doppel-Riegel: Der zweite Tipp legt keinen zweiten Artikel an
    const nochmal = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: { aktion: 'alsArtikel', id: auftragId, kategorie: kategorie.id, bild: bild.id },
    })
    expect(nochmal.status()).toBe(409)

    // Aufräumen
    await request.delete(`${BASIS}/api/jobs/${auftragId}`, { headers: kopf! })
    await request.delete(`${BASIS}/api/products/${artikelId}`, { headers: kopf! })
  })
})
