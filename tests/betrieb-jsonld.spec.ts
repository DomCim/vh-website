import { expect, test } from '@playwright/test'

import { localBusinessJsonLd, type BetriebsAngaben } from '../src/lib/seo'

/**
 * Der Betrieb in den Daten für Suchmaschinen.
 *
 * Aufgefallen ist es beim Blick in Googles Prüfung: Dort stand eine Werkstatt
 * mit Anschrift, Telefon und Namen — und nirgends die Next-Concept SAS. Für
 * eine Suchmaschine war das ein Betrieb ohne Träger, ein Name an einer
 * Anschrift, ohne Verbindung zu dem eingetragenen Unternehmen, das dort sitzt.
 *
 * Beides gehört hin, und zwar in getrennte Felder: Die Marke steht in `name`,
 * weil danach gesucht wird; der Betrieb steht in `legalName`, weil er der
 * Betrieb ist. Wer das eines Tages zusammenzieht, macht aus zwei richtigen
 * Angaben eine falsche.
 */

const EINSTELLUNGEN: NonNullable<BetriebsAngaben> = {
  siteName: 'Vincent Hellmann',
  tagline: 'Lösungen in Stahl',
  contact: {
    phone: '+49 173 309 4034',
    email: 'info@vincent-hellmann.com',
    address: '24, avenue Clemenceau \n67630 Lauterbourg\nFrankreich',
  },
  company: {
    legalName: 'Next-Concept SAS',
    vatId: 'FR53987550159',
    siret: '98755015900014',
  },
  social: {
    facebook: 'https://www.facebook.com/vincent.hellmann',
    instagram: 'https://www.instagram.com/vincenthellmann',
    youtube: '',
  },
}

const daten = (teil: Partial<typeof EINSTELLUNGEN> = {}) =>
  JSON.parse(localBusinessJsonLd({ ...EINSTELLUNGEN, ...teil })) as Record<string, any>

test('die Marke steht im Namen, der Betrieb daneben', () => {
  const d = daten()
  expect(d.name).toBe('Vincent Hellmann')
  expect(d.legalName).toBe('Next-Concept SAS')
})

test('Umsatzsteuer-Nummer und SIRET machen den Betrieb eindeutig', () => {
  const d = daten()
  expect(d.vatID).toBe('FR53987550159')
  expect(d.identifier).toEqual({
    '@type': 'PropertyValue',
    propertyID: 'SIRET',
    value: '98755015900014',
  })
})

test('die Anschrift steht zerlegt da', () => {
  // Der Grund, aus dem das entstanden ist: Googles Prüfung meldete
  // Postleitzahl, Ort und Land als fehlend.
  expect(daten().address).toEqual({
    '@type': 'PostalAddress',
    streetAddress: '24, avenue Clemenceau',
    postalCode: '67630',
    addressLocality: 'Lauterbourg',
    addressCountry: 'FR',
  })
})

test('was nicht gepflegt ist, steht auch nicht da', () => {
  // Ein leeres Feld wäre eine Angabe, die nichts sagt — und bei einer
  // Steuernummer eine, die falsch ist.
  const d = daten({ company: { legalName: null, vatId: null, siret: null } })
  expect('legalName' in d).toBe(false)
  expect('vatID' in d).toBe(false)
  expect('identifier' in d).toBe(false)
  // Der Name trägt trotzdem, sonst stünde dort gar nichts
  expect(d.name).toBe('Vincent Hellmann')
})

test('leere soziale Netze fallen aus der Liste', () => {
  // YouTube ist nicht gepflegt; eine leere Zeichenkette in `sameAs` wäre ein
  // Verweis ins Nichts.
  expect(daten().sameAs).toEqual([
    'https://www.facebook.com/vincent.hellmann',
    'https://www.instagram.com/vincenthellmann',
  ])
})

test('Logo und Bild stehen beide da', () => {
  // Google verlangt `logo` und vermisst `image`, wenn nur eines dasteht.
  const d = daten()
  expect(d.logo).toBeTruthy()
  expect(d.image).toBe(d.logo)
})
