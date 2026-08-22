import { expect, test } from '@playwright/test'

import { htmlAlsText, htmlHatInhalt, mailHtmlSaeubern } from '../src/lib/mailhtml'

/**
 * Was aus dem Schreibfeld in eine Mail darf — und was aus ihr wird.
 *
 * Zwei Dinge werden hier festgehalten, und beide würden still schiefgehen:
 *
 * Die **Säuberung** ist die Stelle, an der fremdes HTML in eine Mail übergeht.
 * Fällt sie aus, merkt es niemand — bis eine Mail bei jemandem etwas tut,
 * statt nur dazustehen.
 *
 * Die **Textfassung** sieht kein Mensch, solange alles gut geht. Sie zählt
 * genau dann, wenn ein Mailprogramm kein HTML anzeigt oder ein Spamfilter
 * nachsieht, ob überhaupt Text da ist.
 */

test('Skripte fliegen samt Inhalt raus', () => {
  const gesaeubert = mailHtmlSaeubern('<p>Hallo</p><script>alert(1)</script>')
  expect(gesaeubert).toContain('Hallo')
  expect(gesaeubert).not.toContain('alert')
  expect(gesaeubert).not.toContain('script')
})

test('Ereignis-Attribute überleben nicht', () => {
  const gesaeubert = mailHtmlSaeubern('<p onclick="alert(1)" onmouseover="x()">Text</p>')
  expect(gesaeubert).toContain('Text')
  expect(gesaeubert).not.toContain('onclick')
  expect(gesaeubert).not.toContain('onmouseover')
})

test('Links nur dorthin, wo man hinkommt', () => {
  // Gewöhnliche Ziele bleiben
  expect(mailHtmlSaeubern('<a href="https://vincent-hellmann.com">Shop</a>')).toContain(
    'https://vincent-hellmann.com',
  )
  expect(mailHtmlSaeubern('<a href="mailto:info@example.com">Mail</a>')).toContain('mailto:')

  // `javascript:` und `data:` nicht — ein data-Link kann eine ganze Seite
  // enthalten, die aussieht, als käme sie von uns
  expect(mailHtmlSaeubern('<a href="javascript:alert(1)">X</a>')).not.toContain('javascript')
  expect(mailHtmlSaeubern('<a href="data:text/html,<h1>x</h1>">X</a>')).not.toContain('data:')
})

test('erlaubte Gestaltung bleibt stehen', () => {
  const quillTypisch =
    '<p style="text-align: center"><strong>Angebot</strong></p>' +
    '<p><span style="color: rgb(230, 126, 34)">Sonderpreis</span></p>' +
    '<ul><li>Pflanzkübel</li><li>Sockel</li></ul>'
  const gesaeubert = mailHtmlSaeubern(quillTypisch)
  expect(gesaeubert).toContain('<strong>')
  expect(gesaeubert).toContain('text-align')
  expect(gesaeubert).toContain('color')
  expect(gesaeubert).toContain('<li>')
})

test('Kleingedrucktes kommt beim Empfänger klein an', () => {
  // Das „Klein" aus dem Schreibfeld — als Vielfaches, damit es mitwächst, wenn
  // jemand seine Schrift größer stellt
  const gesaeubert = mailHtmlSaeubern('<p><span style="font-size: 0.85em;">Kleingedrucktes</span></p>')
  expect(gesaeubert).toContain('font-size')
  expect(gesaeubert).toContain('0.85em')

  // Eine Größe, die eine Adresse mitbringt, bleibt trotzdem draußen
  expect(mailHtmlSaeubern('<p style="font-size: url(http://x)">T</p>')).not.toContain('url(')
})

test('Stile, die nachladen oder rechnen, fliegen raus', () => {
  // Ein Hintergrundbild aus der Mail heraus wäre ein Zählpixel
  expect(mailHtmlSaeubern('<p style="background-image: url(http://x/y.png)">T</p>')).not.toContain(
    'url(',
  )
  // Position und Größe gehören einem Mailprogramm, nicht uns
  expect(mailHtmlSaeubern('<p style="position: fixed; top: 0">T</p>')).not.toContain('position')
})

test('die Textfassung nennt die Adresse eines Links', () => {
  const text = htmlAlsText('<p>Mehr dazu <a href="https://vincent-hellmann.com/de">hier</a></p>')
  // „hier" allein wäre in einer Textfassung wertlos
  expect(text).toContain('https://vincent-hellmann.com/de')
})

test('die Textfassung macht aus Listen Aufzählungen', () => {
  const text = htmlAlsText('<ul><li>Erstens</li><li>Zweitens</li></ul>')
  expect(text).toContain('· Erstens')
  expect(text).toContain('· Zweitens')
})

test('leere Absätze zählen nicht als Inhalt', () => {
  // Genau das hinterlässt Quill, wenn man alles löscht
  expect(htmlHatInhalt('<p><br></p>')).toBe(false)
  expect(htmlHatInhalt('<p>  </p><p><br></p>')).toBe(false)
  expect(htmlHatInhalt('<p>Guten Tag</p>')).toBe(true)
})

test('Umlaute und Sonderzeichen überstehen beide Wege', () => {
  const gesaeubert = mailHtmlSaeubern('<p>Größe: 40 × 40 cm — Grüße</p>')
  expect(gesaeubert).toContain('Größe')
  expect(htmlAlsText(gesaeubert)).toContain('Größe: 40 × 40 cm — Grüße')
})

test('geschützte Leerzeichen werden wieder zu gewöhnlichen', () => {
  /*
   * Quill schreibt jedes Leerzeichen als `&nbsp;`. In einer Mail bricht daran
   * keine Zeile um — ein Absatz würde zu einer einzigen Zeile, die am Telefon
   * seitwärts aus dem Bild läuft.
   */
  const quillTypisch = '<p>Ihr&nbsp;Angebot&nbsp;liegt&nbsp;bei&nbsp;und&nbsp;gilt&nbsp;vier&nbsp;Wochen.</p>'
  const gesaeubert = mailHtmlSaeubern(quillTypisch)
  expect(gesaeubert).not.toContain('&nbsp;')
  expect(gesaeubert).toContain('Ihr Angebot liegt bei und gilt vier Wochen.')
})
