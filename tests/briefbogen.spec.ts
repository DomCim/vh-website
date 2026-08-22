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
