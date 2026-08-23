import { expect, test } from '@playwright/test'

import { felderLesen } from '../src/lib/felderLesen'
import {
  hatUebersetzbares,
  nurUebersetzbares,
  uebersetzbarerTeil,
} from '../src/lib/sprachfelder'
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

/**
 * Die Sprachwahl steht am Feld, nicht über der Seite.
 *
 * Vorher hing sie ganz oben und schaltete die ganze Liste um. Weil es nur
 * einmal gibt, was es nur einmal gibt, verschwand dabei die halbe Seite —
 * Anschrift, Bankverbindung, Zugangsdaten. Über dem Pinterest-Code stand
 * damit eine Sprachwahl, die ihn nichts angeht, und wer eine Übersetzung
 * pflegte, fand den Rest nicht mehr.
 *
 * Diese Prüfungen halten die Regeln fest, nach denen jetzt entschieden wird.
 */
test('die Sprachwahl erscheint nur an Einträgen, die etwas zu übersetzen haben', () => {
  expect(hatUebersetzbares(finde('tagline')!), 'Slogan').toBe(true)
  expect(hatUebersetzbares(finde('faq')!), 'häufige Fragen').toBe(true)
  // Die Gruppe selbst ist nicht übersetzbar, ihre Meta-Texte darin schon.
  expect(hatUebersetzbares(finde('seo')!), 'SEO-Standardwerte').toBe(true)
  expect(hatUebersetzbares(finde('craft')!), 'Handarbeit & Fertigung').toBe(true)

  expect(hatUebersetzbares(finde('siteName')!), 'Website-Name').toBe(false)
  expect(hatUebersetzbares(finde('contact')!), 'Kontaktdaten').toBe(false)
  expect(hatUebersetzbares(finde('company')!), 'Firmenangaben').toBe(false)
  expect(hatUebersetzbares(finde('pinterestVerification')!), 'Pinterest-Code').toBe(false)
})

test('der Sprachstand zählt nur die übersetzbaren Teile', () => {
  const craft = finde('craft')!

  // Nur ein nicht übersetzbares Feld gefüllt: Für den Sprachstand ist hier
  // nichts gepflegt. Sonst stünde die Zeile in allen drei Sprachen auf grün,
  // obwohl kein einziger Text übersetzt ist.
  expect(uebersetzbarerTeil(craft, { madeToOrder: true })).toBeUndefined()

  // Ein übersetzbares Feld gefüllt: genau das zählt.
  expect(uebersetzbarerTeil(craft, { notice: 'Alles von Hand.', madeToOrder: true })).toEqual({
    notice: 'Alles von Hand.',
  })

  // Ein einfaches übersetzbares Feld reicht seinen Wert unverändert durch.
  expect(uebersetzbarerTeil(finde('tagline')!, 'Stahl aus einer Hand')).toBe(
    'Stahl aus einer Hand',
  )
})

/**
 * Die Sicherung beim Schreiben: Was hier durchfällt, kann eine fremde
 * Sprachfassung nicht kaputt machen.
 */
test('in eine fremde Sprachfassung geht nur, was es je Sprache gibt', () => {
  const gefiltert = nurUebersetzbares(felder, {
    tagline: 'Acier sur mesure',
    siteName: 'Vincent Hellmann',
    company: { iban: 'FR76…', legalName: 'Next-Concept SAS' },
    seo: { metaTitle: 'Titre', metaDescription: 'Description' },
  })

  expect(gefiltert.tagline).toBe('Acier sur mesure')
  expect(gefiltert.seo).toEqual({ metaTitle: 'Titre', metaDescription: 'Description' })

  // Der Website-Name und die Firmenangaben dürfen nicht mitgehen: Eine
  // französische IBAN gibt es nicht, und ein Speichern hier überschriebe die
  // einzige, die es gibt.
  expect(gefiltert.siteName).toBeUndefined()
  expect(gefiltert.company).toBeUndefined()
})
