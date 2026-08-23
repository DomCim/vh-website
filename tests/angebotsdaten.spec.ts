import { expect, test } from '@playwright/test'

import { LIEFERLAENDER, versandUndRueckgabe, WIDERRUFSTAGE } from '../src/lib/seo'

/**
 * Was am Angebot steht, ist eine Zusage — keine Kosmetik.
 *
 * Der Anlass war der Test für strukturierte Daten: Er bemängelte fehlende
 * Versandkosten und Rückgabebedingungen, beide als „optional" gekennzeichnet.
 * Optional sind sie für die Prüfung; für die Anzeige unter dem Suchtreffer
 * sind sie es nicht — und im Merchant Center gilt eine fehlende
 * Rückgabebedingung als Mangel am Konto.
 *
 * Geprüft wird deshalb nicht, *dass* etwas dasteht, sondern **was**: Die Zahl
 * muss die des Artikels sein (eine Abweichung zwischen Auszeichnung und Seite
 * kostet das ganze Suchergebnis samt Preis), und digitale Ware darf keine
 * 14-Tage-Frist versprechen — dort erlischt das Widerrufsrecht mit der
 * Lieferung.
 */

test('die Versandkosten sind die des Artikels', () => {
  const { shippingDetails } = versandUndRueckgabe({ shippingCost: 150 })
  expect(shippingDetails.shippingRate.value).toBe(150)
  expect(shippingDetails.shippingRate.currency).toBe('EUR')
})

test('ohne eingetragene Versandkosten ist es versandkostenfrei, nicht unbekannt', () => {
  // Leeres Feld heißt im Formular ausdrücklich „versandkostenfrei". Stünde
  // hier `undefined`, verwürfe Google die ganze Angabe.
  expect(versandUndRueckgabe({}).shippingDetails.shippingRate.value).toBe(0)
})

test('geliefert wird in die vier Länder, die Dominik genannt hat', () => {
  const ziele = versandUndRueckgabe({}).shippingDetails.shippingDestination
  expect(ziele.map((z) => z.addressCountry)).toEqual([...LIEFERLAENDER])
})

test('auf gewöhnliche Ware gibt es vierzehn Tage — und der Kunde zahlt die Rücksendung', () => {
  const daten = versandUndRueckgabe({ shippingCost: 150 })
  expect(daten.hasMerchantReturnPolicy?.merchantReturnDays).toBe(WIDERRUFSTAGE)
  expect(WIDERRUFSTAGE).toBe(14)
  // Muss zur Widerrufsbelehrung passen (lib/rechtstexte.ts): „Die
  // unmittelbaren Kosten der Rücksendung tragen Sie."
  expect(daten.hasMerchantReturnPolicy?.returnFees).toBe('https://schema.org/ReturnShippingFees')
  expect(daten.hasMerchantReturnPolicy?.applicableCountry).toEqual([...LIEFERLAENDER])
})

test('digitale Ware bekommt keine Rückgabefrist versprochen', () => {
  const daten = versandUndRueckgabe({ digital: true, shippingCost: 150 })
  expect(daten.hasMerchantReturnPolicy).toBeUndefined()
  // Und keinen Versand: Eine Datei wird nicht verschickt.
  expect(daten.shippingDetails.shippingRate.value).toBe(0)
})
