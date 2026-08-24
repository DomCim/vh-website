import { expect, test } from '@playwright/test'

import { versandUndRueckgabe, WIDERRUFSTAGE, type Versandangabe } from '../src/lib/seo'
import { STANDARD_ZONEN } from '../src/lib/versand'

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
 * muss die sein, die die Kasse für dieses Land berechnet (eine Abweichung
 * zwischen Auszeichnung und Seite kostet das ganze Suchergebnis samt Preis),
 * und digitale Ware darf keine 14-Tage-Frist versprechen — dort erlischt das
 * Widerrufsrecht mit der Lieferung.
 *
 * Seit 08/2026 kommen die Länder aus den Versandzonen. Vorher stand hier eine
 * eigene Liste und im Produktfeed eine zweite, andere — die eine nannte die
 * Schweiz, die andere nicht, und die Kasse wusste von keiner.
 */

/**
 * Die Angabe zur ersten (oder einzigen) Zone.
 *
 * `shippingDetails` ist entweder eine Angabe oder eine Liste — Schema.org
 * lässt beides zu, und bei nur einer Zone wäre eine Liste mit einem Element
 * unnötig umständlich. Der Helfer nimmt der Prüfung diese Unterscheidung ab,
 * wo sie nichts zur Sache tut.
 */
function ersteZone(d: { shippingDetails?: Versandangabe | Versandangabe[] }): Versandangabe {
  const v = d.shippingDetails
  if (!v) throw new Error('keine Versandangabe')
  return Array.isArray(v) ? v[0] : v
}

const EINE_ZONE = [{ laender: ['FR', 'DE', 'AT'], aufschlag: 0 }]
const ZWEI_ZONEN = [
  { laender: ['FR', 'DE', 'AT'], aufschlag: 0 },
  { laender: ['CH'], aufschlag: 80 },
]

test('die Versandkosten sind die des Artikels', () => {
  const versand = ersteZone(versandUndRueckgabe({ shippingCost: 150 }, EINE_ZONE))
  expect(versand.shippingRate.value).toBe(150)
  expect(versand.shippingRate.currency).toBe('EUR')
})

test('ohne eingetragene Versandkosten ist es versandkostenfrei, nicht unbekannt', () => {
  // Leeres Feld heißt im Formular ausdrücklich „versandkostenfrei". Stünde
  // hier `undefined`, verwürfe Google die ganze Angabe.
  expect(ersteZone(versandUndRueckgabe({}, EINE_ZONE)).shippingRate.value).toBe(0)
})

test('geliefert wird dorthin, wohin die Zonen reichen — und sonst nirgends', () => {
  const versand = ersteZone(versandUndRueckgabe({}, EINE_ZONE))
  expect(versand.shippingDestination.map((z) => z.addressCountry)).toEqual(['FR', 'DE', 'AT'])
})

test('eine teurere Zone bekommt eine eigene Angabe, keinen Mischpreis', () => {
  /*
   * Der eigentliche Punkt: Eine gemeinsame Zahl für alle Länder wäre für die
   * einen zu hoch und für die anderen eine falsche Zusage. Schema.org lässt
   * mehrere Angaben nebeneinander zu — genau dafür.
   */
  const versand = versandUndRueckgabe({ shippingCost: 150 }, ZWEI_ZONEN).shippingDetails
  expect(Array.isArray(versand)).toBe(true)
  const liste = versand as Versandangabe[]
  expect(liste[0].shippingRate.value).toBe(150)
  expect(liste[1].shippingRate.value).toBe(230)
  expect(liste[1].shippingDestination[0].addressCountry).toBe('CH')
})

test('auf gewöhnliche Ware gibt es vierzehn Tage — und der Kunde zahlt die Rücksendung', () => {
  const daten = versandUndRueckgabe({ shippingCost: 150 }, ZWEI_ZONEN)
  expect(daten.hasMerchantReturnPolicy?.merchantReturnDays).toBe(WIDERRUFSTAGE)
  expect(WIDERRUFSTAGE).toBe(14)
  // Muss zur Widerrufsbelehrung passen (lib/rechtstexte.ts): „Die
  // unmittelbaren Kosten der Rücksendung tragen Sie."
  expect(daten.hasMerchantReturnPolicy?.returnFees).toBe('https://schema.org/ReturnShippingFees')
  // Die Frist gilt in allen belieferten Ländern, quer über die Zonen
  expect(daten.hasMerchantReturnPolicy?.applicableCountry).toEqual(['FR', 'DE', 'AT', 'CH'])
})

test('digitale Ware bekommt keine Rückgabefrist versprochen', () => {
  const daten = versandUndRueckgabe({ digital: true, shippingCost: 150 }, EINE_ZONE)
  expect(daten.hasMerchantReturnPolicy).toBeUndefined()
  // Und keinen Versand: Eine Datei wird nicht verschickt.
  expect(ersteZone(daten).shippingRate.value).toBe(0)
})

test('der Standard entspricht dem Zustand von vorher', () => {
  /*
   * Wichtiger, als es aussieht: Eine leere Einstellung darf den Shop nicht
   * anhalten und auch nicht heimlich teurer machen. Wer nichts pflegt,
   * bekommt genau das, was vorher galt.
   */
  expect(STANDARD_ZONEN).toHaveLength(1)
  expect(STANDARD_ZONEN[0].laender).toEqual(['FR', 'DE', 'AT'])
  expect(STANDARD_ZONEN[0].aufschlag).toBe(0)
})
