import { type APIRequestContext, expect, test } from '@playwright/test'

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

/**
 * Bild und Ablauf einer Variante überleben das Speichern der Stückliste.
 *
 * Die Stücklisten-Route schreibt die Variantenzeilen als Abschrift neu —
 * Bild und Ablauf stehen nicht darin. Dass sie trotzdem bleiben, hängt an
 * genau einem Umstand: Die Abschrift führt die **Kennung** der Zeile mit,
 * und Payload behält dann die nicht mitgeschickten Unterfelder (nachgemessen
 * 08/2026 — ohne Kennung sind sie weg, siehe den Farbbild-Vorfall im MCP).
 *
 * Dieser Test nagelt das fest. Fällt er um, hat jemand die Kennung aus der
 * Abschrift genommen — und ab da löscht jedes Stücklisten-Speichern still
 * die Farbbilder und Ablauf-Vorlagen aller Varianten.
 */
test.describe('Variantenfelder und die Stücklisten-Route', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  async function anmelden(request: APIRequestContext) {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = (await anmeldung.json()) as { token?: string }
    return token ? { Authorization: `JWT ${token}` } : null
  }

  test('Ablauf und Bild stehen nach dem Speichern noch da', async ({ request }) => {
    const kopf = await anmelden(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen — läuft der Server?')

    const suche = await request.get(`${BASIS}/api/products?limit=100&depth=0&locale=de`, {
      headers: kopf!,
    })
    const { docs } = (await suche.json()) as {
      docs: { id: number; variants?: { id?: string; title?: string; price?: number }[] }[]
    }
    const artikel = docs.find((d) => (d.variants ?? []).length > 0)
    test.skip(!artikel, 'Kein Artikel mit Varianten in der Datenbank')
    const variante = artikel!.variants![0]

    // Ablauf und Bild an der ersten Variante sicherstellen — der Test schafft
    // seine eigene Voraussetzung, statt auf gepflegte Daten zu hoffen
    const medien = await request.get(`${BASIS}/api/media?limit=1&depth=0`, { headers: kopf! })
    const bildId = ((await medien.json()) as { docs: { id: number }[] }).docs[0]?.id ?? null
    const vorbereiten = await request.patch(`${BASIS}/api/products/${artikel!.id}?locale=de`, {
      headers: kopf!,
      data: {
        variants: artikel!.variants!.map((v, i) =>
          i === 0
            ? {
                ...v,
                image: bildId,
                arbeitsplan: [{ was: 'Zuschnitt', art: 'eigen', minuten: 30 }],
              }
            : v,
        ),
      },
    })
    expect(vorbereiten.ok()).toBe(true)

    // Jetzt die Stücklisten-Route so aufrufen, wie das Büro-Formular es tut —
    // die Varianten-Abschrift kennt weder Bild noch Ablauf
    const speichern = await request.post(`${BASIS}/api/office/stueckliste`, {
      headers: kopf!,
      data: {
        produktId: artikel!.id,
        zeilen: [],
        dienstleister: [],
        arbeitsminuten: 0,
        varianten: (artikel!.variants ?? []).map((v) => ({
          id: v.id,
          zeilen: [],
          dienstleister: [],
          minuten: null,
        })),
      },
    })
    expect(speichern.ok()).toBe(true)

    const danach = await request.get(`${BASIS}/api/products/${artikel!.id}?depth=0&locale=de`, {
      headers: kopf!,
    })
    const doc = (await danach.json()) as {
      variants?: { id?: string; image?: number | null; arbeitsplan?: { was?: string }[] }[]
    }
    const geprueft = (doc.variants ?? []).find((v) => String(v.id) === String(variante.id))
    expect(geprueft, 'Die Variante hat ihre Kennung verloren').toBeTruthy()
    expect(geprueft!.arbeitsplan?.length, 'Der Ablauf der Variante ist weg').toBeGreaterThan(0)
    if (bildId !== null) {
      expect(geprueft!.image, 'Das Bild der Variante ist weg').toBe(bildId)
    }
  })

  test('ein mitgeschickter Ablauf wird geschrieben — am Artikel und an der Variante', async ({
    request,
  }) => {
    const kopf = await anmelden(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen')

    const suche = await request.get(`${BASIS}/api/products?limit=100&depth=0&locale=de`, {
      headers: kopf!,
    })
    const { docs } = (await suche.json()) as {
      docs: { id: number; variants?: { id?: string }[] }[]
    }
    const artikel = docs.find((d) => (d.variants ?? []).length > 0)
    test.skip(!artikel, 'Kein Artikel mit Varianten')

    const speichern = await request.post(`${BASIS}/api/office/stueckliste`, {
      headers: kopf!,
      data: {
        produktId: artikel!.id,
        zeilen: [],
        dienstleister: [],
        arbeitsminuten: 0,
        ablauf: [
          { was: 'Schweißen', art: 'eigen', minuten: 90 },
          { was: 'Verzinken', art: 'fremd', vorlaufTage: 5 },
        ],
        varianten: (artikel!.variants ?? []).map((v, i) => ({
          id: v.id,
          zeilen: [],
          dienstleister: [],
          minuten: null,
          ablauf: i === 0 ? [{ was: 'Feinschliff', art: 'eigen', minuten: 15 }] : [],
        })),
      },
    })
    expect(speichern.ok()).toBe(true)

    const danach = await request.get(`${BASIS}/api/products/${artikel!.id}?depth=0&locale=de`, {
      headers: kopf!,
    })
    const doc = (await danach.json()) as {
      arbeitsplan?: { was?: string; art?: string; stand?: string }[]
      variants?: { arbeitsplan?: { was?: string }[] }[]
    }
    expect((doc.arbeitsplan ?? []).map((s) => s.was)).toEqual(['Schweißen', 'Verzinken'])
    // Die Vorlage kennt keinen Stand — den bekommt erst der Auftrag
    expect(doc.arbeitsplan![0].stand).toBeUndefined()
    expect((doc.variants?.[0]?.arbeitsplan ?? []).map((s) => s.was)).toEqual(['Feinschliff'])
  })

  test('ein Formular ohne Ablauf-Feld leert nichts', async ({ request }) => {
    // Die ältere Formular-Fassung im Gerät schickt kein `ablauf` mit — der
    // eben geschriebene Plan muss das überstehen
    const kopf = await anmelden(request)
    test.skip(!kopf, 'Anmeldung fehlgeschlagen')

    const suche = await request.get(`${BASIS}/api/products?limit=100&depth=0&locale=de`, {
      headers: kopf!,
    })
    const { docs } = (await suche.json()) as {
      docs: { id: number; arbeitsplan?: { was?: string }[]; variants?: { id?: string }[] }[]
    }
    const artikel = docs.find((d) => (d.arbeitsplan ?? []).length > 0)
    test.skip(!artikel, 'Kein Artikel mit Ablauf — läuft der vorige Test nicht mit?')

    const speichern = await request.post(`${BASIS}/api/office/stueckliste`, {
      headers: kopf!,
      data: { produktId: artikel!.id, zeilen: [], dienstleister: [], arbeitsminuten: 0 },
    })
    expect(speichern.ok()).toBe(true)

    const danach = await request.get(`${BASIS}/api/products/${artikel!.id}?depth=0&locale=de`, {
      headers: kopf!,
    })
    const doc = (await danach.json()) as { arbeitsplan?: { was?: string }[] }
    expect((doc.arbeitsplan ?? []).length).toBeGreaterThan(0)
  })
})
