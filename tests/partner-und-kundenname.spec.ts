import { expect, test } from '@playwright/test'

import { angabenAus } from '../src/components/office/KundenAngaben'
import { firmaUndPerson } from '../src/lib/namensteilung'

/**
 * Aus dem Betrieb gemeldet, mit drei Bildern: Der Partner hieß „Armin Keins /
 * Majer GmbH & Co. KG", auf der Rechnung stand daneben „KantWerk GmbH", und
 * gedruckt wurde der zweite. Dazu bat der Kunde per Mail um eine andere
 * Rechnungsanschrift — Vincent trug sie beim Partner nach, und der Entwurf
 * merkte davon nichts.
 */

test.describe('Mensch und Firma in einem Feld', () => {
  test('die Rechtsform verrät, welcher Teil die Firma ist', () => {
    expect(firmaUndPerson('Armin Keins / Majer GmbH & Co. KG')).toEqual({
      firma: 'Majer GmbH & Co. KG',
      person: 'Armin Keins',
    })
    // Auch andersherum getippt
    expect(firmaUndPerson('Next-Concept SAS / Vincent Hellmann')).toEqual({
      firma: 'Next-Concept SAS',
      person: 'Vincent Hellmann',
    })
  })

  test('ohne Rechtsform gewinnt der längere Teil', () => {
    expect(firmaUndPerson('Meier / Schreinerei am Marktplatz')).toEqual({
      firma: 'Schreinerei am Marktplatz',
      person: 'Meier',
    })
  })

  test('was nicht eindeutig zwei Teile sind, wird nicht vorgeschlagen', () => {
    // Ein einzelner Name, ein leerer Teil, drei Teile — überall lieber nichts
    // sagen als falsch raten. Vorgeschlagen wird, gespeichert wird auf Klick.
    expect(firmaUndPerson('KantWerk GmbH')).toBeNull()
    expect(firmaUndPerson('Majer GmbH & Co. KG /')).toBeNull()
    expect(firmaUndPerson('a / b / c')).toBeNull()
    expect(firmaUndPerson('')).toBeNull()
    expect(firmaUndPerson(null)).toBeNull()
  })
})

test.describe('Die Angaben des Kunden kommen vom Partner', () => {
  const partner = {
    id: 1,
    name: 'Majer GmbH & Co. KG',
    ansprechpartner: 'Armin Keins',
    line1: 'Albert-Schweitzer-Str. 59',
    postalCode: '76703',
    city: 'Kraichtal',
    country: 'Deutschland',
    vatId: 'DE276264255',
    siret: null,
  }

  test('Name, Anschrift und Steuernummern, aber nicht der Mensch', () => {
    const a = angabenAus(partner)
    expect(a.customerName).toBe('Majer GmbH & Co. KG')
    expect(a.customerAddress).toBe('Albert-Schweitzer-Str. 59\n76703 Kraichtal\nDeutschland')
    expect(a.customerVatId).toBe('DE276264255')
    // Der Ansprechpartner ist der Weg zur Firma, nicht der Rechnungsempfänger
    expect(JSON.stringify(a)).not.toContain('Armin Keins')
  })
})
