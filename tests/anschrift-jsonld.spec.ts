import { expect, test } from '@playwright/test'

import { postalAddress } from '../src/lib/seo'

/**
 * Die Anschrift des Betriebs in den strukturierten Daten.
 *
 * Sie stand als ein Klumpen im Feld `streetAddress` — „24, avenue Clemenceau
 * 67630 Lauterbourg Frankreich". Googles Prüfung meldete daraufhin
 * Postleitzahl, Ort und Land als fehlend, und das sind genau die Angaben, an
 * denen die örtliche Suche einen Betrieb einem Ort zuordnet.
 *
 * Geprüft wird vor allem das Gegenteil des Erfolgs: dass nichts falsch
 * einsortiert wird. Eine erfundene Postleitzahl schickte jemanden in den
 * falschen Ort — da ist der Klumpen von vorher das kleinere Übel.
 */

test('die Anschrift der Werkstatt wird vollständig zerlegt', () => {
  expect(postalAddress('24, avenue Clemenceau \n67630 Lauterbourg\nFrankreich')).toEqual({
    '@type': 'PostalAddress',
    streetAddress: '24, avenue Clemenceau',
    postalCode: '67630',
    addressLocality: 'Lauterbourg',
    addressCountry: 'FR',
  })
})

test('das Land geht als Kürzel hinaus, in jeder Schreibweise', () => {
  // schema.org erwartet das Kürzel; „Frankreich" verstünde Google nicht.
  for (const land of ['Frankreich', 'France', 'FRANCE']) {
    expect(postalAddress(`Weg 1\n67630 Lauterbourg\n${land}`)?.addressCountry).toBe('FR')
  }
  expect(postalAddress('Goldammerweg 25\n95119 Naila\nDeutschland')).toEqual({
    '@type': 'PostalAddress',
    streetAddress: 'Goldammerweg 25',
    postalCode: '95119',
    addressLocality: 'Naila',
    addressCountry: 'DE',
  })
})

test('mehrzeilige Straßen bleiben zusammen', () => {
  expect(postalAddress('Zone Artisanale\nBâtiment C\n67630 Lauterbourg\nFrankreich')).toEqual({
    '@type': 'PostalAddress',
    streetAddress: 'Zone Artisanale, Bâtiment C',
    postalCode: '67630',
    addressLocality: 'Lauterbourg',
    addressCountry: 'FR',
  })
})

test('was nicht ins Muster passt, bleibt Straße statt falsch einsortiert', () => {
  // Kein Land erkannt, keine Postleitzahl erkannt: dann lieber alles in
  // `streetAddress` — das ist der Zustand von vorher und niemals falsch.
  expect(postalAddress('Irgendwo am Waldrand\nbeim alten Sägewerk')).toEqual({
    '@type': 'PostalAddress',
    streetAddress: 'Irgendwo am Waldrand, beim alten Sägewerk',
  })
  // Eine einzelne Zeile wird nicht auseinandergenommen — dafür fehlt der Rest
  expect(postalAddress('67630 Lauterbourg')).toEqual({
    '@type': 'PostalAddress',
    streetAddress: '67630 Lauterbourg',
  })
})

test('ohne Anschrift gibt es kein Feld', () => {
  // Ein leeres PostalAddress wäre eine Angabe, die nichts sagt.
  expect(postalAddress(null)).toBeUndefined()
  expect(postalAddress('')).toBeUndefined()
  expect(postalAddress('  \n \n ')).toBeUndefined()
})
