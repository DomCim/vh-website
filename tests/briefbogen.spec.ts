import { expect, test } from '@playwright/test'

import { firmenzeile, logoAnhang, pflichtangaben } from '../src/lib/mail'
import { mailHtmlSaeubern } from '../src/lib/mailhtml'

/**
 * Wie eine Mail beim Empfänger steht.
 *
 * Alle drei Fälle hier sind einmal wirklich passiert und keiner fiel beim
 * Schreiben auf — man sieht sie erst im fremden Postfach, und dann ist die
 * Mail weg.
 */

test('Absätze stehen so eng wie im Schreibfeld', () => {
  const html = mailHtmlSaeubern('<p>Zeile 1</p><p>Zeile 2</p>')
  /*
   * Ohne eigenen Abstand setzt das Mailprogramm seinen eigenen — rund eine
   * Leerzeile je Absatz. Aus vier getippten Zeilen wird dann eine Seite mit
   * Lücken.
   */
  expect(html).toContain('<p style="margin:0;">Zeile 1</p>')
  expect(html).toContain('<p style="margin:0;">Zeile 2</p>')
})

test('eine getippte Leerzeile bleibt eine Leerzeile', () => {
  // Quill schreibt sie als leeren Absatz; mit `margin:0` fiele der auf null
  // Höhe zusammen, und die Zeile vor der Grußformel wäre weg
  const html = mailHtmlSaeubern('<p>Zeile 4</p><p></p><p>Mit freundlichen Grüßen</p>')
  expect(html).toContain('<br>')
  expect(html.indexOf('<br>')).toBeGreaterThan(html.indexOf('Zeile 4'))
  expect(html.indexOf('<br>')).toBeLessThan(html.indexOf('Mit freundlichen'))
})

test('die eigene Gestaltung behält das letzte Wort', () => {
  // Der Abstand steht vorn, die Wahl des Schreibenden dahinter
  const html = mailHtmlSaeubern('<p style="text-align: center">Mitte</p>')
  expect(html).toContain('margin:0;')
  expect(html).toContain('text-align')
  expect(html.indexOf('margin:0;')).toBeLessThan(html.indexOf('text-align'))
})

test('der Strich aus der Leiste bekommt seine Maße für die Mail', () => {
  // Im gespeicherten Text steht nur die Spielart; die Maße kommen erst hier
  // dazu, weil eine Mail kein Stylesheet mitbringt
  const fein = mailHtmlSaeubern('<p>Text</p><hr data-strich="fein">')
  expect(fein).toContain('height:1px')
  expect(fein).toContain('width:60px')
  expect(fein).toContain('#a5622d')

  expect(mailHtmlSaeubern('<hr data-strich="kraeftig">')).toContain('width:140px')
  // Quer über die Breite: eine Kante, kein Ausrufezeichen
  expect(mailHtmlSaeubern('<hr data-strich="quer">')).toContain('width:100%')

  // Ein fremdes <hr> aus einer zitierten Mail sieht danach aus wie unseres
  expect(mailHtmlSaeubern('<hr>')).toContain('width:84px')
  expect(mailHtmlSaeubern('<hr style="border:5px solid red">')).not.toContain('red')
})

test('Überschriften tragen ihren Corten-Strich von selbst', () => {
  const html = mailHtmlSaeubern('<h1>Große Überschrift</h1><h2>Kleine</h2><p>Text</p>')
  // Dieselbe Regel wie auf der Website und auf dem Angebot: 112 × 3 unter der
  // großen, 40 × 2 unter der kleinen
  expect(html).toContain('width:112px')
  expect(html).toContain('width:40px')
  expect(html.indexOf('width:112px')).toBeGreaterThan(html.indexOf('Große Überschrift'))
  expect(html.indexOf('width:112px')).toBeLessThan(html.indexOf('Kleine'))

  // Ein Absatz bekommt keinen — sonst stünde unter jeder Zeile ein Strich
  expect(mailHtmlSaeubern('<p>Nur Text</p>')).not.toContain('width:40px')
})

test('das Logo reist nur mit, wenn es im Text vorkommt', () => {
  const mit = logoAnhang('<img src="cid:vh-logo" />')
  expect(mit).toHaveLength(1)
  // Die weiße Fassung: Sie trägt ihren hellen Grund im Bild und bleibt damit
  // auch in einem dunkel gestellten Mailprogramm lesbar
  expect(mit[0].filename).toBe('logo-mail.png')
  expect(mit[0].cid).toBe('vh-logo')

  expect(logoAnhang('<p>Ohne Kopf</p>')).toHaveLength(0)
})

test('die Rechtsform steht einmal in der Fußzeile, nicht zweimal', () => {
  // Wer den Firmennamen einträgt, schreibt die Rechtsform mit — die Vorlage
  // hängte sie trotzdem noch einmal an: „Next-Concept SAS SAS"
  expect(firmenzeile({ legalName: 'Next-Concept SAS', legalForm: 'SAS' })).toBe('Next-Concept SAS')
  expect(firmenzeile({ legalName: 'Next-Concept', legalForm: 'SAS' })).toBe('Next-Concept SAS')
  // Ein Name, der nur zufällig so endet, verliert nichts
  expect(firmenzeile({ legalName: 'Sassenberg', legalForm: 'SAS' })).toBe('Sassenberg SAS')

  // Dasselbe beim Handelsregister
  const angaben = pflichtangaben({ rcsNumber: '987550159', rcsCity: 'RCS Strasbourg' })
  expect(angaben).toContain('RCS Strasbourg 987550159')
  expect(pflichtangaben({ rcsNumber: '987550159', rcsCity: 'Strasbourg' })).toContain(
    'RCS Strasbourg 987550159',
  )
})
