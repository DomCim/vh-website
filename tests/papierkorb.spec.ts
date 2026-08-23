import { expect, test } from '@playwright/test'

import { slugFreigeben } from '../src/lib/slug'

/**
 * Der Papierkorb — die Regeln, die ohne Server prüfbar sind.
 *
 * Der teure Teil (Wegwerfen, Wiederherstellen, Grabsteine) hängt an der
 * Datenbank und steht weiter unten mit laufendem Server. Was hier steht, ist
 * die Stelle, an der es beim ersten Anlauf schiefgegangen wäre: der **Slug**.
 *
 * Er ist eindeutig — auch über den Papierkorb hinweg, denn die Datenbank kennt
 * keinen Papierkorb, nur Zeilen. Bliebe er am weggeworfenen Datensatz hängen,
 * bekäme ein gleichnamiger neuer wortlos `-2`, blockiert von etwas, das
 * niemand mehr sieht. Deshalb wird er beim Wegwerfen freigegeben — und nur
 * dann.
 */

// Der Hook interessiert sich nur für zwei Felder; alles andere reicht Payload
// unverändert durch. Die Aufrufe hier bilden genau das nach.
const lauf = (data: Record<string, unknown>, originalDoc?: Record<string, unknown>) =>
  slugFreigeben({ data, originalDoc, operation: 'update' } as never) as Record<string, unknown>

test('wer weggeworfen wird, gibt seinen Slug frei', () => {
  const raus = lauf({ deletedAt: '2026-08-23T10:00:00.000Z' }, { slug: 'gartentisch' })
  expect(raus.slug).toBeNull()
})

test('eine gewöhnliche Änderung lässt den Slug in Ruhe', () => {
  const raus = lauf({ slug: 'gartentisch', title: 'Gartentisch' }, { slug: 'gartentisch' })
  expect(raus.slug).toBe('gartentisch')
})

test('wer schon im Papierkorb liegt, wird nicht noch einmal angefasst', () => {
  // Sonst schriebe jede Änderung an einem weggeworfenen Datensatz erneut null —
  // harmlos, aber es verwischt, wann der Slug tatsächlich frei wurde.
  const raus = lauf(
    { deletedAt: '2026-08-23T10:00:00.000Z', title: 'Neu benannt' },
    { deletedAt: '2026-08-01T10:00:00.000Z', slug: null },
  )
  expect('slug' in raus).toBe(false)
})

test('das Zurückholen setzt keinen Slug — das macht autoSlug', () => {
  const raus = lauf({ deletedAt: null }, { deletedAt: '2026-08-01T10:00:00.000Z', slug: null })
  expect('slug' in raus).toBe(false)
})

/**
 * Und derselbe Weg mit laufendem Server — dort, wo es zählt.
 *
 * Geprüft wird die volle Runde an zwei Sammlungen, weil zwei verschiedene
 * Dinge schiefgehen können:
 *
 *  - **Kategorien** haben einen eindeutigen Slug. Hier muss der Name nach dem
 *    Wegwerfen wieder frei sein, sonst blockiert Unsichtbares die Adresse.
 *  - **Partner** sind ein Bereich des Büros. Hier muss ein Grabstein
 *    entstehen, sonst steht der weggeworfene Datensatz auf jedem Handy für
 *    immer weiter — der Abgleich erfährt sonst nur von echten Löschungen.
 *
 * In beiden Fällen gilt: aus den Listen raus, aber nicht aus der Datenbank.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test.describe('Papierkorb', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')
  /*
   * Nacheinander, nicht nebeneinander.
   *
   * Melden sich zwei Prüfungen im selben Augenblick mit demselben Konto an,
   * wird eines der beiden Token danach nicht mehr anerkannt und die Abfrage
   * kommt als 403 zurück — mit einer Meldung, die nach einem Rechtefehler
   * aussieht und keiner ist. Das kostete beim Schreiben dieser Prüfungen eine
   * halbe Stunde Suche an der falschen Stelle.
   */
  test.describe.configure({ mode: 'serial' })

  test('weggeworfen ist unsichtbar, aber nicht weg — und der Slug wird frei', async ({
    request,
  }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const kopf = { Authorization: `JWT ${(await anmeldung.json()).token}` }

    const marke = `papierkorb-${Date.now()}`
    const anlegen = async (name: string) => {
      const a = await request.post(`${BASIS}/api/categories`, { headers: kopf, data: { name } })
      expect(a.ok(), await a.text()).toBeTruthy()
      return (await a.json()).doc as { id: number; slug: string }
    }
    const wegwerfen = (id: number) =>
      request.patch(`${BASIS}/api/categories/${id}`, {
        headers: kopf,
        data: { deletedAt: new Date().toISOString() },
      })
    const holen = async (id: number, mitPapierkorb = false) => {
      const a = await request.get(
        `${BASIS}/api/categories/${id}${mitPapierkorb ? '?trash=true' : ''}`,
        { headers: kopf },
      )
      return a.ok() ? ((await a.json()) as { slug: string | null; deletedAt?: string }) : null
    }

    // ── 1. Anlegen: der Slug entsteht aus dem Namen ───────────────────────
    const erste = await anlegen(marke)
    expect(erste.slug).toBe(marke)

    // ── 2. Wegwerfen: aus der Liste raus, in der Datenbank drin ───────────
    expect((await wegwerfen(erste.id)).ok()).toBeTruthy()
    expect(await holen(erste.id)).toBeNull()
    const imKorb = await holen(erste.id, true)
    expect(imKorb?.deletedAt).toBeTruthy()
    // Der Name ist frei — genau darum geht es
    expect(imKorb?.slug ?? null).toBeNull()

    // ── 3. Derselbe Name geht wieder — ohne stilles „-2" ──────────────────
    const zweite = await anlegen(marke)
    expect(zweite.slug).toBe(marke)

    // ── 4. Zurückholen: da, und mit einer eigenen Adresse ─────────────────
    const zurueck = await request.patch(`${BASIS}/api/categories/${erste.id}?trash=true`, {
      headers: kopf,
      data: { deletedAt: null },
    })
    expect(zurueck.ok(), await zurueck.text()).toBeTruthy()
    const geheilt = await holen(erste.id)
    expect(geheilt).not.toBeNull()
    expect(geheilt?.slug).toBe(`${marke}-2`)

    // Aufräumen — endgültig, das ist der zweite Knopf
    for (const id of [erste.id, zweite.id]) {
      await request.delete(`${BASIS}/api/categories/${id}?trash=true`, { headers: kopf })
    }
  })

  test('ein weggeworfener Partner hinterlässt einen Grabstein — und nimmt ihn zurück', async ({
    request,
  }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    expect(anmeldung.ok()).toBeTruthy()
    const kopf = { Authorization: `JWT ${(await anmeldung.json()).token}` }

    const a = await request.post(`${BASIS}/api/contacts`, {
      headers: kopf,
      data: { name: `Papierkorb-Probe ${Date.now()}` },
    })
    expect(a.ok(), await a.text()).toBeTruthy()
    const id = (await a.json()).doc.id as number

    const grabsteine = async () => {
      const r = await request.get(
        `${BASIS}/api/deletions?where[bereich][equals]=partner&where[datensatz][equals]=${id}`,
        { headers: kopf },
      )
      return ((await r.json()) as { totalDocs: number }).totalDocs
    }

    expect(await grabsteine()).toBe(0)

    await request.patch(`${BASIS}/api/contacts/${id}`, {
      headers: kopf,
      data: { deletedAt: new Date().toISOString() },
    })
    expect(await grabsteine()).toBe(1)

    // Zurückholen muss den Grabstein wieder wegnehmen — sonst löschte ihn
    // jedes Gerät, das ihn schon geholt hat, und erführe nie vom Gegenteil.
    await request.patch(`${BASIS}/api/contacts/${id}?trash=true`, {
      headers: kopf,
      data: { deletedAt: null },
    })
    expect(await grabsteine()).toBe(0)

    await request.delete(`${BASIS}/api/contacts/${id}?trash=true`, { headers: kopf })
  })
})
