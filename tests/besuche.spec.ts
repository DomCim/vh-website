import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'

import { expect, test } from '@playwright/test'

import {
  besucheAus,
  besuchsAbfrage,
  besuchszugangAus,
  clickhouse,
  geraeteText,
  herkunftText,
  landText,
  NOETIG,
  type Rohzeile,
} from '../src/lib/besuche'

/**
 * Die einzelnen Besuchswege — geprüft ohne ClickHouse.
 *
 * Zwei Dinge stehen hier auf dem Spiel. Das eine ist das Zusammensetzen: Aus
 * einzelnen Ereignissen wird ein Weg, und der muss vorwärts stehen, obwohl
 * rückwärts gelesen wird. Das andere ist die Abfrage selbst — sie hängt an
 * Plausibles Schema, und genau deshalb baut sie sich aus den Spalten
 * zusammen, die es wirklich gibt. Was passiert, wenn eine fehlt, ist keine
 * Frage für den Ernstfall.
 */

const zeile = (teil: Partial<Rohzeile> & { session_id: string; zeit: number }): Rohzeile => teil

test('aus Ereignissen wird ein Weg — vorwärts, obwohl rückwärts gelesen wird', () => {
  const besuche = besucheAus([
    // So kommt es aus der Datenbank: das Neueste zuerst
    zeile({ session_id: '77', zeit: 300, pathname: '/kontakt' }),
    zeile({ session_id: '77', zeit: 200, pathname: '/outdoor/gartenbank' }),
    zeile({ session_id: '77', zeit: 100, pathname: '/outdoor', referrer_source: 'Google' }),
  ])

  expect(besuche).toHaveLength(1)
  expect(besuche[0]!.schritte.map((s) => s.pfad)).toEqual([
    '/outdoor',
    '/outdoor/gartenbank',
    '/kontakt',
  ])
  expect(besuche[0]!.dauer).toBe(200)
})

test('die Herkunft steht am ersten Aufruf, nicht am letzten', () => {
  // Ab dem zweiten Aufruf ist der Verweis die eigene Seite — wer den nimmt,
  // hält jeden Besucher für einen, der von einem selbst kommt.
  const besuche = besucheAus([
    zeile({ session_id: '1', zeit: 200, pathname: '/kontakt', referrer: 'https://vincent-hellmann.com/outdoor' }),
    zeile({ session_id: '1', zeit: 100, pathname: '/outdoor', referrer_source: 'Google' }),
  ])
  expect(besuche[0]!.herkunft).toBe('Google')
})

test('mehrere Besuche stehen nach ihrem Ende, neueste zuerst', () => {
  const besuche = besucheAus([
    zeile({ session_id: 'alt', zeit: 100, pathname: '/' }),
    zeile({ session_id: 'neu', zeit: 900, pathname: '/' }),
  ])
  expect(besuche.map((b) => b.schritte[0]!.zeit)).toEqual([900, 100])
})

test('die Grenze schneidet die ältesten Besuche ab, nicht die neuesten', () => {
  const zeilen = Array.from({ length: 10 }, (_, i) =>
    zeile({ session_id: `s${i}`, zeit: i * 100, pathname: '/' }),
  )
  const besuche = besucheAus(zeilen, 3)
  expect(besuche).toHaveLength(3)
  expect(besuche[0]!.beginn).toBe(900)
})

test('Herkunft: eigene Kennzeichnung schlägt Quelle schlägt Verweis schlägt Direkt', () => {
  expect(herkunftText({ session_id: '1', zeit: 0, utm_source: 'newsletter', referrer_source: 'Google' })).toBe(
    'newsletter',
  )
  expect(herkunftText({ session_id: '1', zeit: 0, referrer_source: 'Google' })).toBe('Google')
  expect(herkunftText({ session_id: '1', zeit: 0, referrer: 'https://www.example.com/seite' })).toBe(
    'example.com',
  )
  expect(herkunftText({ session_id: '1', zeit: 0 })).toBe('Direkt')
  // Kaputter Verweis: lieber roh anzeigen als die Seite mit einem Fehler anhalten
  expect(herkunftText({ session_id: '1', zeit: 0, referrer: ':::' })).toBe(':::')
})

test('Land und Gerät stehen auf Deutsch da', () => {
  expect(landText('DE')).toBe('Deutschland')
  expect(landText('ZZ')).toBeUndefined()
  expect(landText('')).toBeUndefined()
  expect(geraeteText('Mobile')).toBe('Handy')
  // Was Plausible sonst noch liefert, geht unverändert durch
  expect(geraeteText('Watch')).toBe('Watch')
})

test('die Abfrage nimmt nur Spalten, die es gibt', () => {
  const { sql } = besuchsAbfrage(new Set([...NOETIG, 'referrer_source', 'hostname']), true)
  expect(sql).toContain('referrer_source')
  expect(sql).toContain('hostname = {seite:String}')
  // Was fehlt, wird nicht angefragt — sonst scheitert die ganze Abfrage
  expect(sql).not.toContain('country_code')
  expect(sql).not.toContain('screen_size')
})

test('ohne Adressspalte wird nicht nach der Adresse gefiltert', () => {
  const { sql } = besuchsAbfrage(new Set([...NOETIG]), true)
  expect(sql).not.toContain('hostname')
  expect(sql).toContain('timestamp >= {seit:DateTime}')
})

test('fehlt eine tragende Spalte, sagt es das statt eine kaputte Abfrage zu bauen', () => {
  const { sql, fehlend } = besuchsAbfrage(new Set(['session_id', 'timestamp']), false)
  expect(fehlend).toEqual(['pathname'])
  expect(sql).toBe('')
})

test('der Zugang braucht nur die Adresse, der Rest hat Vorgaben', () => {
  const zugang = besuchszugangAus('http://ch:8123/', undefined, undefined, undefined, 'meine.de')
  expect(zugang).toEqual({
    adresse: 'http://ch:8123',
    datenbank: 'plausible_events_db',
    benutzer: 'default',
    passwort: undefined,
    seite: 'meine.de',
  })
  expect(besuchszugangAus('  ', undefined, undefined, undefined, undefined)).toBeUndefined()
})

test('die Abfrage geht nur lesend hinaus und schickt Werte als Parameter', async () => {
  let gesehen: { pfad: string; kopf: Record<string, string | string[] | undefined>; koerper: string } | null =
    null
  const server: Server = createServer((anfrage, antwort) => {
    let koerper = ''
    anfrage.on('data', (teil) => (koerper += teil))
    anfrage.on('end', () => {
      gesehen = { pfad: anfrage.url ?? '', kopf: anfrage.headers, koerper }
      antwort.writeHead(200, { 'Content-Type': 'application/json' })
      antwort.end(JSON.stringify({ data: [{ session_id: '1', zeit: 5 }] }))
    })
  })
  await new Promise<void>((fertig) => server.listen(0, '127.0.0.1', fertig))
  const port = (server.address() as AddressInfo).port

  const zeilen = await clickhouse<Rohzeile>(
    { adresse: `http://127.0.0.1:${port}`, datenbank: 'plausible_events_db', benutzer: 'default' },
    'SELECT 1',
    { seite: 'meine.de' },
  )

  expect(zeilen).toEqual([{ session_id: '1', zeit: 5 }])
  const anfrage = gesehen!
  // Ein Tippfehler in einer Abfrage darf die Statistik nicht verändern können
  expect(anfrage.pfad).toContain('readonly=1')
  expect(anfrage.pfad).toContain('param_seite=meine.de')
  expect(anfrage.pfad).toContain('database=plausible_events_db')
  expect(anfrage.kopf['x-clickhouse-user']).toBe('default')
  expect(anfrage.koerper).toBe('SELECT 1')

  await new Promise<void>((fertig) => server.close(() => fertig()))
})

test('ein Fehler der Datenbank kommt als lesbarer Satz zurück', async () => {
  const server: Server = createServer((_anfrage, antwort) => {
    antwort.writeHead(500)
    antwort.end('Code: 60. DB::Exception: Table events_v2 does not exist')
  })
  await new Promise<void>((fertig) => server.listen(0, '127.0.0.1', fertig))
  const port = (server.address() as AddressInfo).port

  await expect(
    clickhouse(
      { adresse: `http://127.0.0.1:${port}`, datenbank: 'x', benutzer: 'default' },
      'SELECT 1',
    ),
  ).rejects.toThrow(/antwortet mit 500.*events_v2/s)

  await new Promise<void>((fertig) => server.close(() => fertig()))
})
