import { expect, test } from '@playwright/test'

/**
 * Kategorien löschen — mit laufendem Server.
 *
 * Der Anlass war ein Fehler, der nach einem Defekt der Datenbank aussah: Manche
 * Kategorien ließen sich nicht löschen, und im Admin stand „Failed query:
 * delete from categories". Die Ursache war ein Widerspruch im Schema. Am
 * Artikel ist die Kategorie Pflicht, die Spalte also NOT NULL — der
 * Fremdschlüssel wollte beim Löschen aber genau dorthin ein NULL schreiben.
 *
 * Geprüft wird deshalb nicht nur, *dass* abgelehnt wird, sondern **womit**:
 * Eine unverständliche Meldung ist derselbe Fehler nochmal, nur später.
 *
 * 1. Leere Kategorien lassen sich löschen — sonst wäre die Sperre zu grob.
 * 2. Eine Kategorie mit Artikeln wird abgelehnt, mit einem Satz, der die Zahl
 *    der Artikel nennt und sagt, was zu tun ist.
 * 3. Nach dem Umhängen der Artikel geht es. Die Sperre ist eine Bedingung,
 *    keine Einbahnstraße.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Kategorie löschen', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('leer geht, voll nicht — und nach dem Umhängen wieder', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const { token: jwt } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${jwt}` }

    // Eindeutige Pfade, damit sich zwei Läufe nicht in die Quere kommen
    const marke = `pruef-kat-${Date.now()}`
    const kategorieAnlegen = async (name: string) => {
      const antwort = await request.post(`${BASIS}/api/categories`, {
        headers: kopf,
        data: { name, slug: `${marke}-${name.toLowerCase()}` },
      })
      expect(antwort.ok()).toBeTruthy()
      return (await antwort.json()).doc.id as number
    }
    const loeschen = (id: number) => request.delete(`${BASIS}/api/categories/${id}`, { headers: kopf })

    // ── 1. Leere Kategorie ───────────────────────────────────────────────
    expect((await loeschen(await kategorieAnlegen('Leer'))).ok()).toBeTruthy()

    // ── 2. Kategorie mit einem Artikel ───────────────────────────────────
    const voll = await kategorieAnlegen('Voll')

    // Der Artikel braucht ein Bild; irgendeins aus dem Bestand genügt
    const medien = await request.get(`${BASIS}/api/media?limit=1`, { headers: kopf })
    const bild = (await medien.json()).docs[0]
    expect(bild, 'Für die Prüfung muss mindestens eine Datei in der Mediathek liegen').toBeTruthy()

    const artikel = await request.post(`${BASIS}/api/products`, {
      headers: kopf,
      data: {
        title: 'Prüfartikel Kategorie',
        slug: `${marke}-artikel`,
        category: voll,
        price: 100,
        status: 'published',
        images: [bild.id],
      },
    })
    expect(artikel.ok()).toBeTruthy()
    const artikelId = (await artikel.json()).doc.id

    const abgelehnt = await loeschen(voll)
    expect(abgelehnt.ok()).toBeFalsy()
    const meldung = JSON.stringify(await abgelehnt.json())

    // Kein Datenbankkauderwelsch, sondern ein Satz mit Zahl und Anweisung
    expect(meldung).not.toContain('Failed query')
    expect(meldung).toContain('lässt sich nicht löschen')
    expect(meldung).toContain('1 Artikel')
    expect(meldung).toContain('Prüfartikel Kategorie')
    expect(meldung).toContain('anderen Kategorie')

    // ── 3. Nach dem Umhängen ─────────────────────────────────────────────
    const ersatz = await kategorieAnlegen('Ersatz')
    const umgehaengt = await request.patch(`${BASIS}/api/products/${artikelId}`, {
      headers: kopf,
      data: { category: ersatz },
    })
    expect(umgehaengt.ok()).toBeTruthy()
    expect((await loeschen(voll)).ok()).toBeTruthy()

    // Aufräumen
    await request.delete(`${BASIS}/api/products/${artikelId}`, { headers: kopf })
    await loeschen(ersatz)
  })
})
