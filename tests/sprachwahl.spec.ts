import { expect, test } from '@playwright/test'

import {
  mitSprache,
  pfadNenntSprache,
  spracheAusKopf,
  spracheWaehlen,
} from '../src/lib/sprachwahl'

/**
 * Welche Sprache ein Besucher zu sehen bekommt.
 *
 * Der erste Eindruck einer Werkstatt, die auf beiden Seiten der Grenze
 * arbeitet — und eine Entscheidung, die man nicht erst am laufenden Server
 * bemerken will.
 */

test.describe('Der Wunsch des Browsers', () => {
  test('das Gewicht entscheidet, nicht die Reihenfolge', () => {
    // Manche Browser schicken die Wünsche durcheinander; `q` ist maßgeblich
    expect(spracheAusKopf('en;q=0.5, fr;q=0.9')).toBe('fr')
    expect(spracheAusKopf('fr-CH,fr;q=0.9,en;q=0.8,de;q=0.7')).toBe('fr')
    expect(spracheAusKopf('de-AT')).toBe('de')
  })

  test('was wir nicht sprechen, wird übergangen', () => {
    // Italienisch können wir nicht — Englisch schon, also Englisch
    expect(spracheAusKopf('it-IT,it;q=0.9,en;q=0.4')).toBe('en')
    expect(spracheAusKopf('it,es')).toBe(null)
    expect(spracheAusKopf('')).toBe(null)
    expect(spracheAusKopf(null)).toBe(null)
    // `q=0` heißt ausdrücklich „diese nicht"
    expect(spracheAusKopf('fr;q=0, de;q=0.3')).toBe('de')
  })
})

test.describe('Die Wahl', () => {
  test('der eigene Klick schlägt den Browser', () => {
    // Sonst wäre der Klick von gestern bei jedem Besuch wieder weg
    expect(spracheWaehlen({ gemerkt: 'fr', kopf: 'de-DE,de;q=0.9' })).toBe('fr')
  })

  test('ohne Klick zählt der Browser', () => {
    expect(spracheWaehlen({ kopf: 'fr-FR,fr;q=0.9' })).toBe('fr')
    expect(spracheWaehlen({ gemerkt: 'klingonisch', kopf: 'fr' })).toBe('fr')
  })

  test('eine fremde Sprache führt zu Englisch, nicht zu Deutsch', () => {
    // Wer Italienisch eingestellt hat, ist mit Deutsch nicht besser bedient
    expect(spracheWaehlen({ kopf: 'it-IT,it;q=0.9' })).toBe('en')
    expect(spracheWaehlen({ kopf: 'es,pt;q=0.8' })).toBe('en')
  })

  test('ohne jeden Wunsch die Sprache des Hauses', () => {
    // Kein Kopf heißt kein Mensch mit Vorliebe, sondern ein Programm — und für
    // das gilt dasselbe wie für `x-default`
    expect(spracheWaehlen({})).toBe('de')
    expect(spracheWaehlen({ gemerkt: null, kopf: '' })).toBe('de')
    expect(spracheWaehlen({ kopf: '   ' })).toBe('de')
  })
})

test.describe('Der Pfad', () => {
  test('eine Adresse mit Sprache bleibt unangetastet', () => {
    // Wer einen Link weitergibt, gibt die Sprache mit
    expect(pfadNenntSprache('/fr/kontakt')).toBe(true)
    expect(pfadNenntSprache('/de')).toBe(true)
    expect(pfadNenntSprache('/kontakt')).toBe(false)
    expect(pfadNenntSprache('/')).toBe(false)
  })

  test('das Kürzel kommt davor, ohne doppelten Strich', () => {
    expect(mitSprache('/', 'fr')).toBe('/fr')
    expect(mitSprache('/kontakt', 'fr')).toBe('/fr/kontakt')
  })
})
