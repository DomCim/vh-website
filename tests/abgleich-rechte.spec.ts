import { expect, test } from '@playwright/test'

import { ALLE_BEREICHE, BEREICH_RECHTE, bereichErlaubt } from '../src/lib/bereiche'

/**
 * Der Abgleich liefert nur noch, was die Rechte hergeben.
 *
 * Vorher bekam jeder, der das Büro öffnen durfte, sämtliche Bereiche ins
 * Gerät — Rechnungen, Belege, Kontobewegungen inklusive; ausgeblendet war
 * nur die Anzeige. Hier wird beides geprüft: die Zuordnung als Regel und der
 * echte Abgleich mit einem Konto, das nur die Werkstatt sehen darf.
 */

const EMAIL = process.env.ADMIN_TEST_EMAIL ?? 'admin@vincent-hellmann.com'
const PASSWORT = process.env.ADMIN_TEST_PASSWORT
const BASIS = process.env.TEST_BASE_URL ?? 'http://localhost:3000'

test('die Zuordnung deckt jeden Bereich ab — bewusst frei oder bewusst begrenzt', () => {
  // Geld und Kundendaten sind nie frei
  for (const bereich of ['rechnungen', 'belege', 'kontobewegungen', 'partner'] as const) {
    expect(BEREICH_RECHTE[bereich]?.length, bereich).toBeTruthy()
  }
  // Ein Werkstattkonto sieht Aufträge und Inventar, aber kein Geld
  const werkstatt = ['buero.oeffnen', 'auftraege.bearbeiten']
  expect(bereichErlaubt('auftraege', werkstatt)).toBe(true)
  expect(bereichErlaubt('inventar', werkstatt)).toBe(true)
  expect(bereichErlaubt('rechnungen', werkstatt)).toBe(false)
  expect(bereichErlaubt('belege', werkstatt)).toBe(false)
  expect(bereichErlaubt('kontobewegungen', werkstatt)).toBe(false)
  // Freie Bereiche bleiben frei — Meldungen gehören jedem Gerät
  expect(bereichErlaubt('meldungen', [])).toBe(true)
  // Und jeder Bereich hat überhaupt eine Antwort
  for (const bereich of ALLE_BEREICHE) {
    expect(typeof bereichErlaubt(bereich, werkstatt), bereich).toBe('boolean')
  }
})

test.describe('Abgleich mit begrenztem Konto', () => {
  test.skip(!PASSWORT, 'Ohne ADMIN_TEST_PASSWORT nicht prüfbar')

  test('gesperrte Bereiche kommen leer und werden im Gerät geleert', async ({ request }) => {
    const anmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: EMAIL, password: PASSWORT },
    })
    const { token } = await anmeldung.json()
    const kopf = { Authorization: `JWT ${token}` }
    const kennung = Date.now()

    // Eine Rolle, die nur Werkstatt darf — und ein Konto damit
    const rolleAntwort = await request.post(`${BASIS}/api/roles`, {
      headers: kopf,
      data: {
        name: `Werkstattprobe ${kennung}`,
        schluessel: `werkstattprobe-${kennung}`,
        rechte: ['buero.oeffnen', 'auftraege.bearbeiten'],
      },
    })
    expect(rolleAntwort.status()).toBe(201)
    const { doc: rolle } = await rolleAntwort.json()

    const kontoAntwort = await request.post(`${BASIS}/api/users`, {
      headers: kopf,
      data: {
        email: `werkstattprobe-${kennung}@example.com`,
        password: 'pruef-geheim-123',
        role: 'redaktion',
        rolle: rolle.id,
      },
    })
    expect(kontoAntwort.status()).toBe(201)

    const werkstattAnmeldung = await request.post(`${BASIS}/api/users/login`, {
      data: { email: `werkstattprobe-${kennung}@example.com`, password: 'pruef-geheim-123' },
    })
    expect(werkstattAnmeldung.ok()).toBeTruthy()
    const { token: werkstattToken } = await werkstattAnmeldung.json()

    const abgleich = await request.post(`${BASIS}/api/office/abgleich`, {
      headers: { Authorization: `JWT ${werkstattToken}` },
      data: { staende: {}, bereiche: ['auftraege', 'belege', 'rechnungen', 'meldungen'] },
    })
    expect(abgleich.status()).toBe(200)
    const ergebnis = (await abgleich.json()) as {
      bereiche: Record<string, { geaendert: unknown[]; stand: string }>
      voll: string[]
      rahmen: { rechte: string[] }
    }

    // Erlaubtes kommt, Gesperrtes kommt leer UND steht in `voll`,
    // damit das Gerät seinen Altbestand dazu wegwirft
    expect(ergebnis.bereiche.auftraege).toBeTruthy()
    expect(ergebnis.bereiche.belege.geaendert).toHaveLength(0)
    expect(ergebnis.bereiche.rechnungen.geaendert).toHaveLength(0)
    expect(ergebnis.voll).toContain('belege')
    expect(ergebnis.voll).toContain('rechnungen')
    expect(ergebnis.voll).not.toContain('auftraege')

    // Die Rechte im Rahmen entsprechen der Rolle
    expect(ergebnis.rahmen.rechte).toContain('auftraege.bearbeiten')
    expect(ergebnis.rahmen.rechte).not.toContain('zahlen.sehen')
  })
})
