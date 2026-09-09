import fs from 'node:fs/promises'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { absenderVon } from '../src/lib/absender'
import { BELEGE, belegAblegen, belegLesen } from '../src/lib/belegablage'

/**
 * Die Ablage der fertigen Belege.
 *
 * Ein Beleg ist ein Gegenstand: einmal hergestellt, abgelegt, danach nur noch
 * herausgegeben. Diese Prüfungen decken die drei Stellen ab, an denen das
 * schiefgehen kann — die Datei kommt unverändert zurück, ein manipulierter
 * Name liest nichts Fremdes, und die eingefrorenen Firmenangaben werden nicht
 * heimlich durch die heutigen ersetzt.
 *
 * Ohne Server und ohne Datenbank: Es geht um Dateien und um eine Verzweigung.
 */

const inhalt = Buffer.from('%PDF-1.7 kein echtes PDF, aber ein Gegenstand')

test('ein abgelegter Beleg kommt Byte für Byte zurück', async () => {
  const name = await belegAblegen('RE-2026-0001', inhalt)
  try {
    expect(name.startsWith('RE-2026-0001-')).toBe(true)
    expect(name.endsWith('.pdf')).toBe(true)
    const zurueck = await belegLesen(name)
    expect(zurueck?.equals(inhalt)).toBe(true)
  } finally {
    await fs.unlink(path.join(BELEGE, name)).catch(() => undefined)
  }
})

test('zwei Belege derselben Nummer überschreiben sich nicht', async () => {
  const ersteFassung = Buffer.from('Fassung 1')
  const zweiteFassung = Buffer.from('Fassung 2')
  const a = await belegAblegen('AN-2026-0007', ersteFassung)
  const b = await belegAblegen('AN-2026-0007', zweiteFassung)
  try {
    expect(a).not.toBe(b)
    expect((await belegLesen(a))?.equals(ersteFassung)).toBe(true)
    expect((await belegLesen(b))?.equals(zweiteFassung)).toBe(true)
  } finally {
    await fs.unlink(path.join(BELEGE, a)).catch(() => undefined)
    await fs.unlink(path.join(BELEGE, b)).catch(() => undefined)
  }
})

/*
 * Der Name kommt aus der Datenbank. Stünde dort ein Pfad mit `../`, läse die
 * Auslieferung eine beliebige Datei des Containers und gäbe sie als Rechnung
 * heraus — deshalb wird nur der reine Dateiname genommen.
 */
test('ein Name mit Pfadanteilen liest nichts Fremdes', async () => {
  expect(await belegLesen('../../package.json')).toBeNull()
  expect(await belegLesen('/etc/hostname')).toBeNull()
  expect(await belegLesen('..')).toBeNull()
  expect(await belegLesen('')).toBeNull()
  expect(await belegLesen(null)).toBeNull()
})

test('fehlt die Datei, gibt es null statt eines Fehlers', async () => {
  expect(await belegLesen('gibt-es-nicht-4711.pdf')).toBeNull()
})

/*
 * Der wichtigste Fall: Liegt am Beleg eine Abschrift, wird sie genommen — und
 * die Einstellungen werden gar nicht erst gefragt. Der Payload hier wirft,
 * wenn ihn doch jemand anfasst.
 */
test('eingefrorene Firmenangaben gehen den Einstellungen vor', async () => {
  const nieFragen = {
    findGlobal: () => {
      throw new Error('Die Einstellungen dürfen hier nicht gelesen werden')
    },
  } as never

  const abschrift = { legalName: 'Next-Concept SAS', address: 'Alte Straße 1', iban: 'FR76ALT' }
  await expect(absenderVon(nieFragen, abschrift)).resolves.toEqual(abschrift)
})

test('ohne Abschrift werden die heutigen Angaben geholt', async () => {
  const heute = { legalName: 'Next-Concept SAS', address: 'Neue Straße 2' }
  const payload = { findGlobal: async () => ({ company: heute }) } as never

  await expect(absenderVon(payload, null)).resolves.toMatchObject({
    address: 'Neue Straße 2',
  })
})
