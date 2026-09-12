import { expect, test } from '@playwright/test'

import { merkerBauen } from '../src/lib/mcp/termine'
import { merkmaleLesen } from '../src/lib/kalender/merkmale'

/**
 * Was der Assistent schreibt, muss die Website auch lesen.
 *
 * Ein öffentlicher Termin entsteht durch Merker in der Notiz — `#öffentlich`,
 * `#beschreibung:`, `#ort:`. Geschrieben werden sie jetzt von
 * `merkerBauen()`, gelesen seit jeher von `merkmaleLesen()`. Zwei Funktionen,
 * eine Schreibweise: Geht sie auseinander, steht der Termin still­schweigend
 * nicht auf der Website — kein Fehler, keine Meldung, nur eine leere Seite.
 *
 * Deshalb prüft diese Datei beide gegeneinander, statt die eine für sich.
 */

test.describe('Merker schreiben und wieder lesen', () => {
  test('ein öffentlicher Termin kommt vollständig zurück', () => {
    const notiz = merkerBauen({
      oeffentlich: true,
      beschreibung: { de: 'Hier stelle ich meine Werke aus.', fr: "J'expose mes œuvres." },
      ort: 'Parc des Expositions, Nancy',
      link: 'https://example.org/markt',
    })
    const m = merkmaleLesen(notiz)

    expect(m.oeffentlich, 'ohne dieses Flag steht nichts im Netz').toBe(true)
    expect(m.beschreibung.de).toBe('Hier stelle ich meine Werke aus.')
    expect(m.beschreibung.fr).toBe("J'expose mes œuvres.")
    expect(m.ort.de).toBe('Parc des Expositions, Nancy')
    expect(m.link).toBe('https://example.org/markt')
  })

  test('ohne das Flag bleibt der Termin privat', () => {
    const m = merkmaleLesen(merkerBauen({ beschreibung: { de: 'Nur intern' } }))
    expect(m.oeffentlich).toBe(false)
  })

  /*
   * Die Vorgabe ist privat, und das muss auch für den Leerfall gelten: Wer
   * gar nichts angibt, dessen Werkstatttermin gehört niemanden etwas an.
   */
  test('gar keine Angaben ergeben gar keine Merker', () => {
    expect(merkerBauen({})).toBe('')
    expect(merkmaleLesen('').oeffentlich).toBe(false)
  })

  test('eine Absage wird als solche erkannt', () => {
    expect(merkmaleLesen(merkerBauen({ oeffentlich: true, abgesagt: true })).abgesagt).toBe(true)
  })

  /*
   * Mehrzeilige Beschreibungen sind ausdrücklich erlaubt — gelesen wird bis
   * zur nächsten Zeile, die mit `#` beginnt. Ein Absatz mitten im Text darf
   * den Ort dahinter also nicht verschlucken.
   */
  test('ein Absatz in der Beschreibung verschluckt den Ort nicht', () => {
    const notiz = merkerBauen({
      oeffentlich: true,
      beschreibung: { de: 'Erste Zeile.\nZweite Zeile.' },
      ort: 'Hof der Werkstatt',
    })
    const m = merkmaleLesen(notiz)
    expect(m.beschreibung.de).toContain('Zweite Zeile.')
    expect(m.ort.de).toBe('Hof der Werkstatt')
  })

  test('deutsch trägt kein Sprachkürzel, die anderen schon', () => {
    const notiz = merkerBauen({ beschreibung: { de: 'Deutsch', en: 'English' } })
    expect(notiz).toContain('#beschreibung: Deutsch')
    expect(notiz).toContain('#beschreibung:en: English')
  })
})
