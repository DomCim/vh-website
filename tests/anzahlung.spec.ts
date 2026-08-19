import { expect, test } from '@playwright/test'

import { abzugsZeilen, inStufen, stufenBerechnen } from '../src/lib/anzahlung'
import { alsDateiname, stufenNummer } from '../src/lib/nummernkreis'

/**
 * Zahlung in Stufen — die Rechenwege, an denen Geld hängt.
 *
 * Hier geht es um Cents, und zwar um die Art von Cent, die niemand findet:
 * Drei einzeln gerundete Beträge ergeben nicht immer die Summe, aus der sie
 * stammen. Auf der Schlussrechnung steht dann eine Differenz, die sich nicht
 * erklären lässt — und der Kunde fragt zu Recht nach.
 */

test.describe('Zahlung in Stufen', () => {
  test('die drei Beträge ergeben immer genau die Summe', () => {
    /*
     * Der Fall, für den die Schlussrechnung als Rest gerechnet wird: 1000 zu
     * dritteln geht nicht auf. Dreimal 333,33 wären 999,99 — ein Cent, der
     * verschwindet, und zwar zuverlässig bei jedem solchen Auftrag.
     */
    const knifflig = [
      { gesamt: 1000, anzahlungProzent: 33.33, zwischenProzent: 33.33 },
      { gesamt: 1990, anzahlungProzent: 30, zwischenProzent: 40 },
      { gesamt: 0.03, anzahlungProzent: 33, zwischenProzent: 33 },
      { gesamt: 12345.67, anzahlungProzent: 17, zwischenProzent: 23 },
      { gesamt: 999.99, anzahlungProzent: 50, zwischenProzent: 25 },
    ]

    for (const fall of knifflig) {
      const s = stufenBerechnen(fall.gesamt, fall)
      const summe = Math.round((s.anzahlung + s.zwischen + s.schluss) * 100) / 100
      expect(summe, `${fall.gesamt} bei ${fall.anzahlungProzent}/${fall.zwischenProzent}`).toBe(
        fall.gesamt,
      )
    }
  })

  test('rechnet die einfachen Fälle so, wie man es erwartet', () => {
    const s = stufenBerechnen(2000, { anzahlungProzent: 30, zwischenProzent: 40 })
    expect(s.anzahlung).toBe(600)
    expect(s.zwischen).toBe(800)
    expect(s.schluss).toBe(600)
  })

  test('ohne Prozentsätze bleibt alles bei der Schlussrechnung', () => {
    const s = stufenBerechnen(1500, {})
    expect(s.anzahlung).toBe(0)
    expect(s.zwischen).toBe(0)
    expect(s.schluss).toBe(1500)
    expect(inStufen({}), 'und es ist gar keine gestufte Zahlung').toBe(false)
  })

  /*
   * Ein Tippfehler soll keine Rechnung verhindern, sondern zu etwas
   * Vernünftigem führen. Wer 150 % einträgt, meint „alles im Voraus".
   */
  test('unsinnige Prozentsätze werden geklemmt statt abgelehnt', () => {
    const zuViel = stufenBerechnen(1000, { anzahlungProzent: 150, zwischenProzent: 50 })
    expect(zuViel.anzahlung, 'höchstens die ganze Summe').toBe(1000)
    expect(zuViel.zwischen, 'und danach ist nichts mehr übrig').toBe(0)
    expect(zuViel.schluss).toBe(0)

    const negativ = stufenBerechnen(1000, { anzahlungProzent: -20, zwischenProzent: 30 })
    expect(negativ.anzahlung).toBe(0)
    expect(negativ.zwischen).toBe(300)

    // Zusammen über hundert: die Anzahlung stand zuerst da und bleibt
    const zusammen = stufenBerechnen(1000, { anzahlungProzent: 70, zwischenProzent: 60 })
    expect(zusammen.anzahlung).toBe(700)
    expect(zusammen.zwischen).toBe(300)
    expect(zusammen.schluss).toBe(0)
  })

  test('bei fehlender oder unsinniger Summe passiert nichts', () => {
    for (const gesamt of [0, -100, Number.NaN]) {
      const s = stufenBerechnen(gesamt, { anzahlungProzent: 30 })
      expect(s, String(gesamt)).toEqual({ anzahlung: 0, zwischen: 0, schluss: 0 })
    }
  })

  /*
   * Der rechtlich heikelste Teil: Die Schlussrechnung muss die Vorstufen
   * benennen und abziehen. Fehlt das, ist dieselbe Umsatzsteuer zweimal
   * erklärt — und beim Finanzamt zählt die höhere.
   */
  test('die Schlussrechnung zieht jede Vorstufe einzeln und benannt ab', () => {
    const zeilen = abzugsZeilen([
      { stufe: 'anzahlung', nummer: 'RE-2026-0041', datum: '2026-03-02', netto: 600 },
      { stufe: 'zwischen', nummer: 'RE-2026-0055', datum: '2026-05-14', netto: 800 },
    ])

    expect(zeilen).toHaveLength(2)
    expect(zeilen[0].bezeichnung).toBe('Anzahlung Nr. RE-2026-0041 vom 02.03.2026')
    expect(zeilen[0].betrag, 'abgezogen, also negativ').toBe(-600)
    expect(zeilen[1].bezeichnung).toBe('Zwischenrechnung Nr. RE-2026-0055 vom 14.05.2026')
    expect(zeilen[1].betrag).toBe(-800)
  })

  test('Vorstufen ohne Betrag stehen nicht auf dem Blatt', () => {
    expect(abzugsZeilen([{ stufe: 'anzahlung', netto: 0 }])).toHaveLength(0)
  })
})

test.describe('Rechnungsnummern in Stufen', () => {
  test('teilen sich die Nummer und zählen nur den Zusatz hoch', () => {
    const basis = 'RE-2026-0042'
    expect(stufenNummer(basis, 1, 3)).toBe('RE-2026-0042-1/3')
    expect(stufenNummer(basis, 2, 3)).toBe('RE-2026-0042-2/3')
    expect(stufenNummer(basis, 3, 3)).toBe('RE-2026-0042-3/3')
  })

  test('bei nur zwei Stufen stimmt auch der Nenner', () => {
    expect(stufenNummer('RE-2026-0007', 2, 2)).toBe('RE-2026-0007-2/2')
  })

  /*
   * Der Schrägstrich gehört auf das Blatt und nicht in einen Dateinamen —
   * dort trennt er Verzeichnisse. Aus `RE-2026-0042-1/3.pdf` würde der
   * Versuch, in ein Verzeichnis zu schreiben, das es nicht gibt.
   */
  test('als Dateiname ohne Schrägstrich', () => {
    expect(alsDateiname('RE-2026-0042-1/3')).toBe('RE-2026-0042-1-von-3')
    expect(alsDateiname('RE-2026-0042-1/3')).not.toContain('/')
    expect(alsDateiname('RE-2026-0007'), 'normale Nummern bleiben, wie sie sind').toBe(
      'RE-2026-0007',
    )
  })
})
