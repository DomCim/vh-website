import { expect, test } from '@playwright/test'

import { betraege } from '../src/lib/betraege'

/**
 * Rechenwege mit Geld — hier fällt ein Fehler erst beim Steuerberater auf,
 * deshalb sind sie einzeln festgenagelt. Reine Funktionen, kein Browser, kein
 * Server: läuft in Millisekunden und bricht, sobald jemand an der Verteilung
 * des Nachlasses dreht.
 */

test('Netto, Steuer und Brutto einer einfachen Rechnung', () => {
  const r = betraege([{ quantity: 2, unitPrice: 100, vatRate: 20 }])
  expect(r.subtotal).toBe(200)
  expect(r.discountTotal).toBe(0)
  expect(r.vatTotal).toBe(40)
  expect(r.total).toBe(240)
})

test('Prozentualer Nachlass mindert auch die Steuer', () => {
  const r = betraege([{ quantity: 1, unitPrice: 1000, vatRate: 20 }], {
    discountKind: 'prozent',
    discountValue: 10,
  })
  expect(r.discountTotal).toBe(100)
  expect(r.netTotal).toBe(900)
  // 20 % auf 900, nicht auf 1000 — sonst zahlt die Werkstatt Steuer auf Geld,
  // das sie nie bekommen hat
  expect(r.vatTotal).toBe(180)
  expect(r.total).toBe(1080)
})

test('Fester Nachlass verteilt sich anteilig auf beide Steuersätze', () => {
  const r = betraege(
    [
      { quantity: 1, unitPrice: 800, vatRate: 20 },
      { quantity: 1, unitPrice: 200, vatRate: 10 },
    ],
    { discountKind: 'betrag', discountValue: 100 },
  )
  expect(r.subtotal).toBe(1000)
  expect(r.netTotal).toBe(900)
  // 90 % von 800 zu 20 % (144) plus 90 % von 200 zu 10 % (18)
  expect(r.vatTotal).toBe(162)
  expect(r.total).toBe(1062)
})

test('Nachlass wird nie größer als der Auftragswert', () => {
  const r = betraege([{ quantity: 1, unitPrice: 500, vatRate: 20 }], {
    discountKind: 'betrag',
    discountValue: 900,
  })
  expect(r.discountTotal).toBe(500)
  expect(r.netTotal).toBe(0)
  expect(r.vatTotal).toBe(0)
  expect(r.total).toBe(0)
})

test('Leere Rechnung bleibt bei null statt NaN', () => {
  const r = betraege([], { discountKind: 'prozent', discountValue: 10 })
  expect(r.subtotal).toBe(0)
  expect(r.total).toBe(0)
})

/*
 * Die Stornorechnung ist das Spiegelbild ihres Originals: dieselben
 * Positionen, derselbe Nachlass, alles mit umgedrehtem Vorzeichen. Ohne
 * Rücksicht darauf begrenzte die Nachlass-Zeile den Abzug auf „höchstens die
 * Nettosumme" — bei einer negativen Summe wurde daraus „mindestens die ganze
 * Summe", und das Storno stand mit netto null da. Es hätte also nichts
 * aufgehoben.
 */
test.describe('Negative Beträge — die Stornorechnung', () => {
  test('spiegelt eine einfache Rechnung genau', () => {
    const rechnung = betraege([{ quantity: 2, unitPrice: 100, vatRate: 20 }])
    const storno = betraege([{ quantity: 2, unitPrice: -100, vatRate: 20 }])
    expect(storno.netTotal).toBe(-rechnung.netTotal)
    expect(storno.vatTotal).toBe(-rechnung.vatTotal)
    expect(storno.total).toBe(-rechnung.total)
  })

  test('spiegelt auch den prozentualen Nachlass', () => {
    const rabatt = { discountKind: 'prozent', discountValue: 10 }
    const rechnung = betraege([{ quantity: 1, unitPrice: 1000, vatRate: 20 }], rabatt)
    const storno = betraege([{ quantity: 1, unitPrice: -1000, vatRate: 20 }], rabatt)
    expect(storno.discountTotal).toBe(-rechnung.discountTotal)
    expect(storno.netTotal).toBe(-rechnung.netTotal)
    expect(storno.total).toBe(-rechnung.total)
  })

  test('ein fester Nachlassbetrag folgt der Richtung der Rechnung', () => {
    const rabatt = { discountKind: 'betrag', discountValue: 150 }
    const rechnung = betraege([{ quantity: 1, unitPrice: 1000, vatRate: 20 }], rabatt)
    const storno = betraege([{ quantity: 1, unitPrice: -1000, vatRate: 20 }], rabatt)
    expect(rechnung.netTotal).toBe(850)
    expect(storno.netTotal).toBe(-850)
    expect(storno.total).toBe(-rechnung.total)
  })

  test('mehr Nachlass als Rechnungswert bleibt auch negativ begrenzt', () => {
    const storno = betraege([{ quantity: 1, unitPrice: -100, vatRate: 20 }], {
      discountKind: 'betrag',
      discountValue: 500,
    })
    expect(storno.discountTotal).toBe(-100)
    expect(storno.netTotal).toBe(0)
  })

  /**
   * Reverse Charge: keine Steuer, obwohl an den Positionen ein Satz steht.
   *
   * Der Fall, an dem es auseinanderlief: Formular, PDF und Factur-X rechneten
   * die Steuer längst heraus, der Haken am Datenmodell nicht — er rief
   * `betraege` ohne den Hinweis. In der Datenbank stand deshalb eine Steuer,
   * die auf keinem Papier auftauchte, und der Steuer-Export nahm sie von dort
   * mit zum Steuerberater. Aufgefallen beim Bauen des DATEV-Exports.
   *
   * Der Steuersatz bleibt an den Positionen stehen: Wird der Haken wieder
   * entfernt, stimmt die Rechnung ohne Nacharbeit.
   */
  test('bei Reverse Charge fällt keine Steuer an', () => {
    const posten = [{ quantity: 1, unitPrice: 1658.33, vatRate: 20 }]
    const normal = betraege(posten)
    const rc = betraege(posten, { reverseCharge: true })

    expect(normal.vatTotal).toBeGreaterThan(0)
    expect(rc.vatTotal).toBe(0)
    // Netto bleibt gleich, und der Bruttobetrag ist genau das Netto
    expect(rc.netTotal).toBe(normal.netTotal)
    expect(rc.total).toBe(rc.netTotal)
  })

  test('Reverse Charge und Nachlass zusammen', () => {
    const r = betraege([{ quantity: 1, unitPrice: 1000, vatRate: 20 }], {
      discountKind: 'prozent',
      discountValue: 10,
      reverseCharge: true,
    })
    expect(r.discountTotal).toBe(100)
    expect(r.netTotal).toBe(900)
    expect(r.vatTotal).toBe(0)
    expect(r.total).toBe(900)
  })
})
