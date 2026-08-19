import { expect, test } from '@playwright/test'

import {
  eingegangen,
  offenerBetrag,
  terminVerschiebung,
  zahlungsstand,
} from '../src/lib/zahlungsstand'

/**
 * Wird nicht gezahlt, wird nicht gearbeitet — und die Lieferung verschiebt
 * sich. Das ist keine Strafe, sondern Arithmetik.
 *
 * Der Test hält vor allem eine Entscheidung fest: Gewartet wird auf die
 * *älteste* offene Stufe. Hängt die Anzahlung, wird erinnert und nicht
 * gemahnt — es ist noch nichts geleistet, und wer nur noch überlegt, bekommt
 * keine Mahngebühr.
 */

const HEUTE = new Date('2026-06-01T12:00:00Z')
const vorTagen = (n: number) => new Date(HEUTE.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
const inTagen = (n: number) => new Date(HEUTE.getTime() + n * 24 * 60 * 60 * 1000).toISOString()

test.describe('Zahlungsstand eines Auftrags', () => {
  test('alles bezahlt heißt: nichts wartet', () => {
    const stand = zahlungsstand(
      [
        { stufe: 'anzahlung', status: 'bezahlt', dueDate: vorTagen(30), netto: 600 },
        { stufe: 'zwischen', status: 'gestellt', dueDate: inTagen(5), netto: 800 },
      ],
      21,
      HEUTE,
    )
    expect(stand.wartet).toBe(false)
    expect(terminVerschiebung(stand)).toBe(0)
  })

  test('eine überfällige Stufe hält die Fertigung an', () => {
    const stand = zahlungsstand(
      [{ stufe: 'zwischen', status: 'gestellt', dueDate: vorTagen(9), netto: 800 }],
      21,
      HEUTE,
    )
    expect(stand.wartet).toBe(true)
    expect(stand.tageUeberfaellig).toBe(9)
    expect(stand.offeneStufe).toBe('zwischen')
    expect(terminVerschiebung(stand), 'ein Tag ohne Geld ist ein Tag ohne Arbeit').toBe(9)
  })

  test('bei zwei offenen Stufen hängt es an der älteren', () => {
    const stand = zahlungsstand(
      [
        { stufe: 'zwischen', status: 'gestellt', dueDate: vorTagen(3), netto: 800 },
        { stufe: 'anzahlung', status: 'gestellt', dueDate: vorTagen(20), netto: 600 },
      ],
      21,
      HEUTE,
    )
    expect(stand.offeneStufe).toBe('anzahlung')
    expect(stand.tageUeberfaellig).toBe(20)
  })

  test('bei der Anzahlung wird erinnert, nicht gemahnt', () => {
    const anzahlung = zahlungsstand(
      [{ stufe: 'anzahlung', status: 'gestellt', dueDate: vorTagen(10), netto: 600 }],
      21,
      HEUTE,
    )
    expect(anzahlung.nurErinnern, 'noch nichts geleistet — keine Mahngebühr').toBe(true)

    const schluss = zahlungsstand(
      [{ stufe: 'schluss', status: 'gestellt', dueDate: vorTagen(10), netto: 600 }],
      21,
      HEUTE,
    )
    expect(schluss.nurErinnern, 'hier ist gearbeitet worden — hier wird gemahnt').toBe(false)
  })

  /*
   * Irgendwann muss die Entscheidung fallen. Ein Auftrag, den es vielleicht
   * gar nicht gibt, blockiert sonst dauerhaft einen Platz in der Reihe.
   */
  test('nach der Frist fragt das Büro nach dem Werkstattplatz', () => {
    const knapp = zahlungsstand(
      [{ stufe: 'anzahlung', status: 'gestellt', dueDate: vorTagen(20), netto: 600 }],
      21,
      HEUTE,
    )
    expect(knapp.platzFrage, 'einen Tag zu früh').toBe(false)

    const soweit = zahlungsstand(
      [{ stufe: 'anzahlung', status: 'gestellt', dueDate: vorTagen(21), netto: 600 }],
      21,
      HEUTE,
    )
    expect(soweit.platzFrage).toBe(true)
  })

  test('noch nicht fällig ist nicht überfällig', () => {
    const stand = zahlungsstand(
      [{ stufe: 'anzahlung', status: 'gestellt', dueDate: inTagen(4), netto: 600 }],
      21,
      HEUTE,
    )
    expect(stand.wartet).toBe(false)
  })

  test('Entwürfe zählen nicht — die liegen ja noch hier', () => {
    const stand = zahlungsstand(
      [{ stufe: 'anzahlung', status: 'entwurf', dueDate: vorTagen(30), netto: 600 }],
      21,
      HEUTE,
    )
    expect(stand.wartet).toBe(false)
  })
})

test.describe('Was schon da ist', () => {
  test('zählt nur, was bezahlt ist — nicht, was gestellt ist', () => {
    const rechnungen = [
      { stufe: 'anzahlung', status: 'bezahlt', netto: 600 },
      { stufe: 'zwischen', status: 'gestellt', netto: 800 },
    ]
    expect(eingegangen(rechnungen), 'eine Rechnung im Briefkasten ist kein Geld auf dem Konto').toBe(
      600,
    )
    expect(offenerBetrag({ anzahlung: 600, zwischen: 800, schluss: 600 }, rechnungen)).toBe(1400)
  })
})
