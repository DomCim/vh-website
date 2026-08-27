import { type APIRequestContext, expect, test } from '@playwright/test'

import { arbeitenAus } from '../src/lib/arbeiten'

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Interne Artikel existieren nach außen nicht.
 *
 * Geprüft wird jede Ausgangstür einzeln: Artikelseite, Sitemap, Merchant-Feed,
 * Suche, REST-Schnittstelle und die „Verwendete Arbeiten"-Kacheln. Eine
 * vergessene Tür heißt: Der Kundenname aus einer Lohnarbeits-Vorlage steht
 * bei Google — deshalb je Tür eine eigene Zusicherung statt einer summarischen.
 */
test.describe('Interne Artikel', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  async function buero(request: APIRequestContext) {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    return token ? { Authorization: `JWT ${token}` } : null
  }

  test('sind an keiner öffentlichen Tür zu sehen — im Büro schon', async ({
    request,
    browser,
  }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen — läuft der Server?')

    // Zutaten für einen Artikel: Kategorie und Bild sind Pflicht
    const kategorien = await request.get(`${BASIS}/api/office/kategorien`, { headers: kopf! })
    const kategorie = ((await kategorien.json()) as { kategorien: { id: number }[] })
      .kategorien[0]
    test.skip(!kategorie, 'Keine Kategorie in der Datenbank')
    const medien = await request.get(`${BASIS}/api/media?limit=1&depth=0`, { headers: kopf! })
    const bild = ((await medien.json()) as { docs: { id: number }[] }).docs[0]
    test.skip(!bild, 'Kein Bild in der Mediathek')

    const name = `Geheime Lohnarbeit ${Date.now()}`
    const angelegt = await request.post(`${BASIS}/api/products?locale=de`, {
      headers: kopf!,
      data: {
        title: name,
        category: kategorie.id,
        images: [bild.id],
        intern: true,
        available: true,
        price: 999,
      },
    })
    expect(angelegt.ok()).toBe(true)
    const artikel = ((await angelegt.json()) as { doc: { id: number; slug: string } }).doc

    // Ein anonymer Besucher — eigener Kontext, keine Anmeldung
    const fremd = await browser.newContext()

    // 1. Keine Artikelseite: 404, egal unter welcher Kategorie
    const katSlug = (
      (await (
        await request.get(`${BASIS}/api/categories/${kategorie.id}?depth=0&locale=de`, {
          headers: kopf!,
        })
      ).json()) as { slug?: string }
    ).slug
    const seite = await fremd.request.get(`${BASIS}/de/${katSlug}/${artikel.slug}`)
    expect(seite.status(), 'Die Artikelseite darf es öffentlich nicht geben').toBe(404)

    // 2. Nicht in der Sitemap
    const sitemap = await (await fremd.request.get(`${BASIS}/sitemap.xml`)).text()
    expect(sitemap).not.toContain(artikel.slug)

    // 3. Nicht im Merchant-Feed
    const feed = await (await fremd.request.get(`${BASIS}/feed/produkte.xml`)).text()
    expect(feed).not.toContain(name)

    // 4. Nicht in der Suche
    const suche = await (
      await fremd.request.get(`${BASIS}/de/suche?q=${encodeURIComponent('Geheime Lohnarbeit')}`)
    ).text()
    expect(suche).not.toContain(artikel.slug)

    // 5. Nicht über die REST-Schnittstelle — die unterste Verteidigungslinie
    const rest = await (
      await fremd.request.get(`${BASIS}/api/products?limit=200&depth=0`)
    ).text()
    expect(rest, 'Die anonyme REST-Schnittstelle darf ihn nicht kennen').not.toContain(name)
    const direkt = await fremd.request.get(`${BASIS}/api/products/${artikel.id}?depth=0`)
    expect(direkt.ok(), 'Auch der direkte Griff nach der Kennung geht ins Leere').toBe(false)

    // 6. Das Büro sieht ihn — mit Anmeldung ist er ein Artikel wie jeder andere
    const intern = await request.get(`${BASIS}/api/products/${artikel.id}?depth=0&locale=de`, {
      headers: kopf!,
    })
    expect(intern.ok()).toBe(true)
    expect(((await intern.json()) as { intern?: boolean }).intern).toBe(true)

    await fremd.close()
    await request.delete(`${BASIS}/api/products/${artikel.id}`, { headers: kopf! })
  })

  test('„Als Artikel ablegen" legt intern ab', async ({ request }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen')

    const kategorien = await request.get(`${BASIS}/api/office/kategorien`, { headers: kopf! })
    const kategorie = ((await kategorien.json()) as { kategorien: { id: number }[] })
      .kategorien[0]
    const medien = await request.get(`${BASIS}/api/media?limit=1&depth=0`, { headers: kopf! })
    const bild = ((await medien.json()) as { docs: { id: number }[] }).docs[0]
    test.skip(!kategorie || !bild, 'Kategorie oder Bild fehlt')

    const auftrag = await request.post(`${BASIS}/api/office/auftrag`, {
      headers: kopf!,
      data: {
        title: `Intern-Probe ${Date.now()}`,
        positions: [{ description: 'Frästeil', quantity: 1 }],
      },
    })
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
    expect(((await geladen.json()) as { intern?: boolean }).intern).toBe(true)

    await request.delete(`${BASIS}/api/jobs/${auftragId}`, { headers: kopf! })
    await request.delete(`${BASIS}/api/products/${artikelId}`, { headers: kopf! })
  })

  test('der Merchant-Feed trägt die Zusatzbilder', async ({ request, browser }) => {
    const kopf = await buero(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen')

    // Gibt es überhaupt einen Feed-Artikel mit mehr als einem Bild?
    const produkte = await request.get(`${BASIS}/api/products?limit=100&depth=0&locale=de`, {
      headers: kopf!,
    })
    const { docs } = (await produkte.json()) as {
      docs: { images?: unknown[]; onRequestOnly?: boolean; intern?: boolean; price?: number; variants?: unknown[] }[]
    }
    const kandidat = docs.find(
      (d) =>
        (d.images ?? []).length > 1 &&
        !d.onRequestOnly &&
        !d.intern &&
        (typeof d.price === 'number' || (d.variants ?? []).length > 0),
    )
    test.skip(!kandidat, 'Kein Feed-Artikel mit mehreren Bildern in der Datenbank')

    const fremd = await browser.newContext()
    const feed = await (await fremd.request.get(`${BASIS}/feed/produkte.xml`)).text()
    expect(feed).toContain('<g:additional_image_link>')
    await fremd.close()
  })
})

/**
 * Die „Verwendete Arbeiten"-Kacheln lassen interne Artikel weg.
 *
 * Reine Funktion — eine Kachel auf einen internen Artikel führte auf eine
 * 404 und verriete obendrein, dass da etwas ist.
 */
test('arbeitenAus lässt interne Artikel weg', () => {
  const kacheln = arbeitenAus(
    [
      {
        id: 1,
        title: 'Öffentlich',
        slug: 'oeffentlich',
        category: { slug: 'moebel' },
        images: [],
      },
      {
        id: 2,
        title: 'Geheim',
        slug: 'geheim',
        category: { slug: 'moebel' },
        images: [],
        intern: true,
      },
    ],
    () => undefined,
    (_m, fallback) => fallback,
  )
  expect(kacheln.map((k) => k.titel)).toEqual(['Öffentlich'])
})
