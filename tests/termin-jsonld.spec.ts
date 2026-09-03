import { expect, test } from '@playwright/test'

import type { OeffentlicherTermin } from '../src/lib/kalender/oeffentlich'
import { termineJsonLd } from '../src/lib/kalender/terminJsonLd'

/**
 * Die Termine als `Event`-Daten für Suchmaschinen.
 *
 * Geprüft wird hier, weil das Ergebnis unsichtbar ist: Ein falscher
 * Zonenversatz oder ein fehlender Pflichtwert fällt beim Ansehen der Seite
 * nicht auf — die Karte steht ja richtig da. Auffallen würde es erst, wenn
 * jemand eine Stunde zu früh vor einem geschlossenen Stand steht oder wenn
 * Google den Termin gar nicht erst aufnimmt.
 */

const BETRIEB = { name: 'Vincent Hellmann' }

const grundgeruest: OeffentlicherTermin = {
  id: 7,
  beginn: '2026-10-18T00:00:00.000Z',
  ende: null,
  ganztaegig: true,
  abgesagt: false,
  titel: 'Ausstellung',
  beschreibungHtml: null,
  beschreibungText: null,
  ort: 'Ettlingen',
  link: null,
  bild: null,
}

const einer = (teil: Partial<OeffentlicherTermin>) => {
  const roh = termineJsonLd([{ ...grundgeruest, ...teil }], 'de', BETRIEB)
  return roh ? (JSON.parse(roh)[0] as Record<string, any>) : null
}

test('ein ganztägiger Termin trägt nur das Datum', () => {
  // So drückt schema.org „den ganzen Tag" aus. Stünde dort „00:00", läse
  // Google einen Termin, der um Mitternacht beginnt.
  const event = einer({})
  expect(event?.startDate).toBe('2026-10-18')
  expect(event?.endDate).toBeUndefined()
})

test('ein ganztägiger Termin über mehrere Tage nennt den letzten', () => {
  const event = einer({
    beginn: '2026-08-30T00:00:00.000Z',
    ende: '2026-09-02T00:00:00.000Z',
  })
  expect(event?.startDate).toBe('2026-08-30')
  expect(event?.endDate).toBe('2026-09-02')
})

test('eine Uhrzeit steht in der Zeit der Werkstatt, mit Versatz', () => {
  /*
   * Der Container läuft nach UTC. Ein `toISOString()` gäbe „08:00:00Z" —
   * daraus würde in der Anzeige eine Stunde früher, im Sommer zwei. Deshalb
   * die Ortszeit von Paris samt Versatz.
   */
  const sommer = einer({
    ganztaegig: false,
    beginn: '2026-07-15T08:00:00.000Z',
    ende: '2026-07-15T16:00:00.000Z',
  })
  expect(sommer?.startDate).toBe('2026-07-15T10:00:00+02:00')
  expect(sommer?.endDate).toBe('2026-07-15T18:00:00+02:00')

  // Und im Winter eine Stunde weniger — ohne dass jemand nachjustiert
  const winter = einer({ ganztaegig: false, beginn: '2026-01-15T08:00:00.000Z' })
  expect(winter?.startDate).toBe('2026-01-15T09:00:00+01:00')
})

test('ein abgesagter Termin wird als abgesagt ausgezeichnet, nicht weggelassen', () => {
  // Weglassen hieße: Google führt ihn weiter als stattfindend.
  const event = einer({ abgesagt: true })
  expect(event?.eventStatus).toBe('https://schema.org/EventCancelled')
  expect(einer({})?.eventStatus).toBe('https://schema.org/EventScheduled')
})

test('ohne Ort gibt es keinen Eintrag', () => {
  // `location` ist Pflicht, und ein geratener Ort wäre schlimmer als keiner:
  // Wer umsonst hinfährt, kommt nicht wieder.
  expect(termineJsonLd([{ ...grundgeruest, ort: null }], 'de', BETRIEB)).toBeNull()
  expect(termineJsonLd([{ ...grundgeruest, ort: '   ' }], 'de', BETRIEB)).toBeNull()
})

test('ein bloßer Ortsname ist der Ort und nicht die Straße', () => {
  // „Ettlingen" als streetAddress wäre schlicht falsch — und Google ordnet
  // den Termin dann keinem Ort zu.
  expect(einer({})?.location).toEqual({
    '@type': 'Place',
    name: 'Ettlingen',
    address: { '@type': 'PostalAddress', addressLocality: 'Ettlingen' },
  })
})

test('steht eine Postleitzahl dabei, wird sie herausgelöst', () => {
  expect(einer({ ort: 'Marktplatz 1, 76275 Ettlingen' })?.location).toEqual({
    '@type': 'Place',
    name: 'Marktplatz 1, 76275 Ettlingen',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Marktplatz 1',
      postalCode: '76275',
      addressLocality: 'Ettlingen',
    },
  })
  // Auch ohne Straße davor
  expect(einer({ ort: '76275 Ettlingen' })?.location.address).toEqual({
    '@type': 'PostalAddress',
    postalCode: '76275',
    addressLocality: 'Ettlingen',
  })
})

test('die Werkstatt steht als Ausstellende dabei', () => {
  expect(einer({})?.performer).toEqual({
    '@type': 'Organization',
    name: 'Vincent Hellmann',
  })
})

test('jeder Termin bekommt seine eigene Adresse', () => {
  // Ohne den Anker zeigten alle Einträge auf dieselbe Seite.
  expect(einer({})?.url).toMatch(/\/de\/termine#termin-7$/)
})

test('die Beschreibung geht ohne Auszeichnung hinein', () => {
  const event = einer({
    beschreibungHtml: 'Mit <strong>Herz</strong>',
    beschreibungText: 'Mit Herz',
  })
  expect(event?.description).toBe('Mit Herz')
  expect(JSON.stringify(event)).not.toContain('<strong>')
})

test('mehrere Termine stehen in einem Feld, jeder mit Kontext', () => {
  const roh = termineJsonLd(
    [grundgeruest, { ...grundgeruest, id: 8, titel: 'Markt', ort: 'Nancy' }],
    'de',
    BETRIEB,
  )
  const liste = JSON.parse(roh!) as Record<string, any>[]
  expect(liste).toHaveLength(2)
  for (const event of liste) {
    expect(event['@context']).toBe('https://schema.org')
    expect(event['@type']).toBe('Event')
    // Die Pflichtangaben von Google — fehlt eine, fällt der Eintrag durch
    expect(event.name).toBeTruthy()
    expect(event.startDate).toBeTruthy()
    expect(event.location).toBeTruthy()
  }
})

test('ein Termin ohne Ort hält die übrigen nicht auf', () => {
  const roh = termineJsonLd(
    [{ ...grundgeruest, ort: null }, { ...grundgeruest, id: 8 }],
    'de',
    BETRIEB,
  )
  expect(JSON.parse(roh!)).toHaveLength(1)
})
