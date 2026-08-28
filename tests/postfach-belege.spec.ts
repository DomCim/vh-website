import { expect, test } from '@playwright/test'

import { belegEntwurf } from '../src/lib/belegEntwurf'

/**
 * Was aus einer Postfach-Mail ein Beleg-Entwurf wird — und was nicht.
 *
 * Die Regel mit Folgen ist der Betrag: Auf info@ kommen auch Zeichnungen und
 * Werbe-PDFs an, und die KI liest pflichtgemäß aus, was sie sieht. Ohne
 * Brutto kein Entwurf — lieber eine Rechnung übersehen (die Mail bleibt ja
 * ungelesen liegen) als das Büro mit Müll fluten.
 *
 * Reine Funktion, kein IMAP, keine KI.
 */

const QUELLE = {
  von: 'Amazon Business',
  vonAdresse: 'rechnung@amazon.de',
  betreff: 'Ihre Rechnung zu Bestellung 302-99',
  datum: '2026-08-27T09:15:00.000Z',
  kennung: '<abc@amazon>#rechnung.pdf',
}

const DATEN = {
  lieferant: 'Amazon EU S.à r.l.',
  rechnungsnummer: 'INV-DE-2026-771',
  rechnungsdatum: '2026-08-26',
  faelligkeit: '2026-09-25',
  netto: 100,
  steuersatz: 20,
  steuer: 20,
  brutto: 120,
  kategorie: 'werkzeug',
  bezeichnung: 'Schleifscheiben 125 mm',
  sicherheit: 92,
  hinweis: null,
}

test('eine Rechnung wird ein vollständiger Entwurf', () => {
  const e = belegEntwurf(DATEN, QUELLE, '2026-08-28')
  expect(e).not.toBeNull()
  expect(e!.supplierName).toBe('Amazon EU S.à r.l.')
  expect(e!.grossAmount).toBe(120)
  expect(e!.invoiceDate).toBe('2026-08-26')
  expect(e!.dueDate).toBe('2026-09-25')
  expect(e!.category).toBe('werkzeug')
  // Der Riegel: erst nach Bestätigung ein echter Beleg
  expect(e!.extraction.status).toBe('ungeprueft')
  expect(e!.paid).toBe(false)
  expect(e!.quelleMail).toBe(QUELLE.kennung)
  // Die Herkunft steht dran — wer prüft, sieht sofort, woher das kam
  expect(e!.extraction.note).toContain('Amazon Business')
  expect(e!.extraction.note).toContain('302-99')
})

test('ohne Bruttobetrag kein Entwurf', () => {
  // Eine Kundenzeichnung als PDF: Die KI liefert brav Felder, aber keinen Betrag
  expect(belegEntwurf({ ...DATEN, brutto: null }, QUELLE, '2026-08-28')).toBeNull()
  expect(belegEntwurf({ ...DATEN, brutto: 0 }, QUELLE, '2026-08-28')).toBeNull()
  expect(belegEntwurf(null, QUELLE, '2026-08-28')).toBeNull()
})

test('ohne Rechnungsdatum springt das Mail-Datum ein, notfalls heute', () => {
  // invoiceDate ist Pflicht am Beleg — irgendein wahres Datum muss stehen
  const ausMail = belegEntwurf({ ...DATEN, rechnungsdatum: null }, QUELLE, '2026-08-28')
  expect(ausMail!.invoiceDate).toBe('2026-08-27')
  const ohneAlles = belegEntwurf(
    { ...DATEN, rechnungsdatum: null },
    { ...QUELLE, datum: null },
    '2026-08-28',
  )
  expect(ohneAlles!.invoiceDate).toBe('2026-08-28')
})

test('eine unbekannte Kategorie fällt auf Sonstiges statt auf einen Fehler', () => {
  const e = belegEntwurf({ ...DATEN, kategorie: 'kryptowaehrung' }, QUELLE, '2026-08-28')
  expect(e!.category).toBe('sonstiges')
})

test('fehlt der Lieferant, trägt der Absender den Entwurf', () => {
  const e = belegEntwurf(
    { ...DATEN, lieferant: null, bezeichnung: null },
    QUELLE,
    '2026-08-28',
  )
  expect(e!.supplierName).toBe('Amazon Business')
  expect(e!.title).toBe('Ihre Rechnung zu Bestellung 302-99')
})
