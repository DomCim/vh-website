import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

/**
 * Wer macht was — und warum der Takt umgezogen ist.
 *
 * Am 11.09.2026 nachgemessen: zwölf Aussetzer der Website in acht Stunden,
 * während das FWG-Portal auf demselben Wirt mit demselben Wächter durchgehend
 * erreichbar blieb. Der Postfach-Blick wertet Rechnungs-PDFs aus; Node ist
 * einprozessig, und eine blockierte Schleife antwortet gar nicht mehr — auch
 * nicht auf den Health-Check. Die Arbeit, die blockiert, saß im Prozess, der
 * antworten muss.
 */

import { hoertZu, machtStart, machtZeitplan, rolle } from '../src/lib/rolle'

/*
 * Die vier Fragen lesen die Umgebung bei jedem Aufruf — ein Neuladen des
 * Moduls braucht es also nicht, nur ein sauberes Zurücksetzen danach.
 */
const mitUmgebung = (werte: Record<string, string | undefined>) => {
  const vorher = { ROLLE: process.env.ROLLE, ZEITPLAN: process.env.ZEITPLAN }
  for (const [k, v] of Object.entries(werte)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const ergebnis = {
    rolle: rolle(),
    hoertZu: hoertZu(),
    machtStart: machtStart(),
    machtZeitplan: machtZeitplan(),
  }
  for (const [k, v] of Object.entries(vorher)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  return ergebnis
}

test('der Web-Container startet die Datenbank, hält aber keinen Zeitplan mehr', () => {
  const r = mitUmgebung({ ROLLE: 'web', ZEITPLAN: 'aus' })
  expect(r.machtStart, 'Migrationen bleiben beim Web-Container').toBe(true)
  expect(r.machtZeitplan, 'der Takt nicht mehr').toBe(false)
  expect(r.hoertZu, 'Live-Drähte hält das Büro').toBe(false)
})

test('ohne ZEITPLAN=aus macht der Web-Container den Takt weiter', () => {
  /*
   * Die Brücke. Zwischen dem neuen Abbild und dem neuen Stapel liegt ein
   * Augenblick — und in dem darf der Takt nicht stillstehen. Ein Takt, der
   * steht, fällt nicht auf: keine Sicherung, keine Erinnerung, keine Post.
   */
  const r = mitUmgebung({ ROLLE: 'web', ZEITPLAN: undefined })
  expect(r.machtZeitplan).toBe(true)
})

test('der Takt-Container macht nur den Zeitplan', () => {
  const r = mitUmgebung({ ROLLE: 'takt', ZEITPLAN: undefined })
  expect(r.machtZeitplan).toBe(true)
  expect(r.machtStart, 'er baut die Datenbank nicht um').toBe(false)
  expect(r.hoertZu, 'und hält keine Live-Verbindungen').toBe(false)
})

test('das Büro hält die Drähte und sonst nichts', () => {
  const r = mitUmgebung({ ROLLE: 'buero', ZEITPLAN: undefined })
  expect(r.hoertZu).toBe(true)
  expect(r.machtStart).toBe(false)
  expect(r.machtZeitplan).toBe(false)
})

test('in der Entwicklung macht ein Prozess alles', () => {
  const r = mitUmgebung({ ROLLE: undefined, ZEITPLAN: undefined })
  expect(r.rolle).toBe('alles')
  expect(r.hoertZu && r.machtStart && r.machtZeitplan).toBe(true)
})

test('genau ein Dienst im Stapel hält den Zeitplan', () => {
  /*
   * Liefe er in zweien, gäbe es jede Sicherung doppelt und jede Erinnerung
   * zweimal aufs Handy. Das ist der Grund, aus dem es die Rollen überhaupt
   * gibt — hier festgehalten, weil eine vergessene Zeile im Stapel es leise
   * kaputtmacht.
   */
  const stapel = fs.readFileSync(path.join(process.cwd(), 'docker-compose.yml'), 'utf8')
  expect(stapel, 'der Takt-Dienst existiert').toMatch(/^ {2}takt:$/m)
  expect(stapel, 'und trägt seine Rolle').toMatch(/ROLLE:\s*takt/)
  expect(stapel, 'der Web-Container gibt den Zeitplan ab').toMatch(/ZEITPLAN:\s*aus/)
  expect(stapel, 'und wird nicht von außen erreichbar gemacht').not.toMatch(
    /traefik\.http\.routers\.vhtakt/,
  )
})
