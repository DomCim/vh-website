import { expect, test } from '@playwright/test'

import { felderLesen } from '../src/lib/felderLesen'
import { SiteSettings } from '../src/globals/SiteSettings'
import { Integrations } from '../src/globals/Integrations'

/**
 * Das Büro schrieb bisher immer die deutsche Fassung — auch dann, wenn jemand
 * die häufigen Fragen auf Französisch pflegen wollte. Gemerkt hat man es
 * nicht: Das Formular sah gleich aus, und der französische Text landete
 * stillschweigend im deutschen Feld.
 *
 * Diese Prüfung hält fest, dass die Feldbeschreibung sagt, was es je Sprache
 * gibt. Fällt die Angabe irgendwann weg, steht das Blatt wieder ohne
 * Sprachwahl da — und zwar unbemerkt, denn kaputt sieht dann nichts aus.
 */
const felder = felderLesen(SiteSettings.fields)
const finde = (name: string) => felder.find((f) => f.name === name)

test('Übersetzbare Einstellungen sind als solche erkennbar', () => {
  expect(finde('tagline')?.uebersetzt, 'tagline ist übersetzbar').toBe(true)
  expect(finde('faq')?.uebersetzt, 'die häufigen Fragen sind übersetzbar').toBe(true)
})

test('Was es nur einmal gibt, ist nicht als übersetzbar ausgewiesen', () => {
  // Firmenstammdaten samt IBAN und der Stundensatz gelten sprachübergreifend.
  // Stünden sie in der französischen Ansicht, überschriebe ein Speichern dort
  // die einzige Fassung, die es gibt.
  expect(finde('company')?.uebersetzt).toBeUndefined()
  expect(finde('craft')?.uebersetzt).toBeUndefined()
})

test('In einer Gruppe zählt, was darin übersetzbar ist', () => {
  const seo = finde('seo')
  expect(seo?.art).toBe('gruppe')
  expect(seo?.uebersetzt, 'die Gruppe selbst ist es nicht').toBeUndefined()
  const innen = (seo?.felder ?? []).filter((f) => f.uebersetzt).map((f) => f.name)
  expect(innen).toContain('metaTitle')
  expect(innen).toContain('metaDescription')
})

test('Bei den Integrationen gibt es nichts zu übersetzen', () => {
  // Zugangsdaten, Schlüssel und Server — dort wäre eine Sprachwahl eine
  // Einladung zu einem Missverständnis. Das Blatt blendet sie deshalb aus.
  const tief = (liste: ReturnType<typeof felderLesen>): boolean =>
    liste.some((f) => f.uebersetzt || (f.felder ? tief(f.felder) : false))
  expect(tief(felderLesen(Integrations.fields))).toBe(false)
})
