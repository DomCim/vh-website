import { expect, test } from '@playwright/test'

import { adresseAus, adressenAllerSprachen, adresseSaeubern } from '../src/lib/adressen'

/**
 * Adressen je Sprache.
 *
 * Geprüft wird die Stelle, an der es lautlos schiefgehen würde: Payload gibt
 * beim Lesen einer Sprachfassung den deutschen Wert zurück, wenn die eigene
 * leer ist. Für einen Text ist das richtig, für eine Adresse falsch — dann
 * stünde unter `/fr/` ein deutscher Pfad, den dort niemand findet.
 */

test('ohne eigene Adresse gilt der Slug', () => {
  expect(adresseAus({ slug: 'outdoor-sofa-os', adresse: null }, 'fr')).toBe('outdoor-sofa-os')
  expect(adresseAus({ slug: 'outdoor-sofa-os' }, 'de')).toBe('outdoor-sofa-os')
})

test('eine leere Adresse zählt nicht als Adresse', () => {
  expect(adresseAus({ slug: 'feuer-brasero', adresse: '   ' }, 'fr')).toBe('feuer-brasero')
})

test('mit eigener Adresse gilt diese', () => {
  const doc = { slug: 'outdoor-sofa-os', adresse: { de: null, fr: 'canape-os', en: null } }
  expect(adresseAus(doc, 'fr')).toBe('canape-os')
  // Und die anderen Sprachen bleiben beim Slug — kein Rückfall auf das
  // Französische, das wäre die Falle
  expect(adresseAus(doc, 'de')).toBe('outdoor-sofa-os')
  expect(adresseAus(doc, 'en')).toBe('outdoor-sofa-os')
})

test('alle drei Sprachen auf einmal', () => {
  const doc = { slug: 'feuer-brasero', adresse: { de: null, fr: 'brasero-corten', en: 'fire-bowl' } }
  expect(adressenAllerSprachen(doc)).toEqual({
    de: 'feuer-brasero',
    fr: 'brasero-corten',
    en: 'fire-bowl',
  })
})

/*
 * Was jemand eintippt, wird nicht abgelehnt, sondern zurechtgelegt — aber es
 * darf nichts entstehen, das in einer Adresse nichts zu suchen hat.
 */
test('die Eingabe wird zu einer brauchbaren Adresse', () => {
  expect(adresseSaeubern('Canapé OS')).toBe('canape-os')
  expect(adresseSaeubern('  Möbel für Draußen  ')).toBe('moebel-fuer-draussen')
  expect(adresseSaeubern('Tisch/Bank & Co.')).toBe('tisch-bank-co')
  expect(adresseSaeubern('---')).toBe('')
  expect(adresseSaeubern('Grüße aus Straßburg')).toBe('gruesse-aus-strassburg')
})
