import fs from 'fs'
import path from 'path'

import { expect, test } from '@playwright/test'

import { unberuehrt, vorschlaegeAus } from '../src/lib/buero/ablaufvorschlaege'
import { werteAusVorlage } from '../src/lib/buero/auftragVorlage'
import { anschriftAus } from '../src/lib/kundenabschrift'
import {
  eingegangen,
  giltNoch,
  GILT_NOCH_WHERE,
  offenerBetrag,
} from '../src/lib/zahlungsstand'

/**
 * Auftrag duplizieren, Ablaufschritte vorschlagen — und der Storno dazwischen.
 *
 * Alle drei hängen an einem Vorgang aus dem Betrieb: Vincent hatte einen
 * Auftrag, schrieb die Rechnung, musste sie stornieren — und kam an keine
 * neue mehr heran, weil der Knopf dafür verschwunden war. Der Ausweg war ein
 * nachgebauter Auftrag, und der zählt zweimal.
 */

test.describe('Was noch gilt', () => {
  test('ein Storno lässt keine gültige Rechnung zurück', () => {
    const original = { status: 'storniert', stornoVon: null }
    const gegenrechnung = { status: 'gestellt', stornoVon: 7 }

    expect(giltNoch(original), 'die stornierte Rechnung gilt nicht mehr').toBe(false)
    expect(giltNoch(gegenrechnung), 'die Gegenrechnung ist keine Forderung').toBe(false)

    // Genau daran hing der Fehler: Beide zusammen ergaben „schon abgerechnet".
    expect([original, gegenrechnung].filter(giltNoch)).toHaveLength(0)
  })

  test('eine gewöhnliche Rechnung gilt weiter', () => {
    expect(giltNoch({ status: 'gestellt' })).toBe(true)
    expect(giltNoch({ status: 'bezahlt' })).toBe(true)
    expect(giltNoch({ status: 'entwurf' })).toBe(true)
  })

  test('die Bedingung der Datenbank sagt dasselbe', () => {
    /*
     * Die Schnittstelle fragt die Datenbank, die Zahlungsleiste fragt den
     * Bestand im Gerät. Laufen die beiden auseinander, verschwindet der Knopf
     * für den einen und bleibt für den anderen — deshalb hier festgehalten,
     * dass die Bedingung dieselben zwei Fälle ausschließt.
     */
    const felder = GILT_NOCH_WHERE.map((b) => Object.keys(b)[0])
    expect(felder).toEqual(['status', 'stornoVon'])
    expect(GILT_NOCH_WHERE[0].status.not_equals).toBe('storniert')
    expect(GILT_NOCH_WHERE[1].stornoVon.exists).toBe(false)
  })
})

test.describe('Auftrag als Vorlage', () => {
  const vorlage = {
    positions: [
      { description: 'Sitzbank 2 m', quantity: 2, price: 890, product: { id: 5 }, farbe: 'RAL 7016' },
      { description: '   ', quantity: 1 },
    ],
    material: [
      { item: { id: 12 }, quantity: 4 },
      { item: 13, quantity: 1, beigestellt: true },
      { item: null, quantity: 9 },
    ],
    arbeitsplan: [
      { was: 'Zuschnitt', art: 'eigen' as const, minuten: 90, stand: 'erledigt' as const, erledigtAm: '2026-08-01' },
      { was: 'Verzinken', art: 'fremd' as const, dienstleister: 4, kosten: 120, vorlaufTage: 5, stand: 'laeuft' as const, rausAm: '2026-08-03' },
      { was: '  ' },
    ],
    plannedMinutes: 480,
    zahlplan: { anzahlungProzent: 30, zwischenProzent: 20 },
    meilenstein: { bezeichnung: 'Rohbau steht' },
    notes: 'Kunde holt selbst ab',
  }

  test('der Arbeitsinhalt kommt mit, das Geschehene nicht', () => {
    const w = werteAusVorlage(vorlage)

    // Leere Zeilen fallen weg — sie waren im alten Auftrag schon Ballast
    expect(w.positions).toHaveLength(1)
    expect(w.positions?.[0]).toMatchObject({ description: 'Sitzbank 2 m', quantity: 2, price: 890 })
    expect(w.positions?.[0]?.product, 'der Artikelbezug kommt als Kennung mit').toBe(5)

    expect(w.material, 'Material ohne Posten ist keine Angabe').toHaveLength(2)
    expect(w.material?.[0]).toEqual({ item: 12, quantity: 4 })
    expect(w.material?.[1]).toEqual({ item: 13, quantity: 1, beigestellt: true })

    expect(w.arbeitsplan).toHaveLength(2)
    for (const schritt of w.arbeitsplan ?? []) {
      expect(schritt.stand, 'der Ablauf kommt als Plan, nicht als Verlauf').toBe('offen')
      expect(schritt).not.toHaveProperty('erledigtAm')
      expect(schritt).not.toHaveProperty('rausAm')
    }
    // Was der Betrieb kostet, bleibt am Schritt hängen
    expect(w.arbeitsplan?.[1]).toMatchObject({ dienstleister: 4, kosten: 120, vorlaufTage: 5 })

    expect(w.plannedMinutes).toBe(480)
    expect(w.anzahlungProzent).toBe(30)
    expect(w.zwischenProzent).toBe(20)
    expect(w.meilensteinBezeichnung).toBe('Rohbau steht')
  })

  test('Kunde und Bezeichnung bleiben leer', () => {
    // Absicht: Ein Duplikat entsteht meist für jemand anderen, und ein
    // stehengebliebener fremder Name auf einem Lieferschein ist teuer.
    const w = werteAusVorlage({ ...vorlage })
    expect(w.title ?? '').toBe('')
    expect(w.customerName ?? '').toBe('')
    expect(w.contact ?? '').toBe('')
    expect(w.jobNumber ?? '').toBe('')
  })

  test('das Material des Duplikats gilt als nicht abgebucht', () => {
    // Käme das Häkchen mit, würde nie abgebucht — und der Bestand zeigte
    // Ware, die längst verbaut ist.
    expect(werteAusVorlage({ ...vorlage }).materialGebucht).toBe(false)
  })
})

test.describe('Ablaufschritte vorschlagen', () => {
  test('jeder Schritt einmal, der jüngste Gebrauch gewinnt', () => {
    const vorschlaege = vorschlaegeAus([
      {
        updatedAt: '2026-01-01T00:00:00.000Z',
        arbeitsplan: [{ was: 'Verzinken', art: 'fremd', kosten: 100, dienstleister: 1 }],
      },
      {
        updatedAt: '2026-09-01T00:00:00.000Z',
        arbeitsplan: [
          { was: 'verzinken', art: 'fremd', kosten: 140, dienstleister: 2 },
          { was: 'PC - Konstruktion', art: 'eigen', minuten: 120 },
        ],
      },
    ])

    expect(vorschlaege.map((v) => v.was), 'alphabetisch, damit die Liste stillhält').toEqual([
      'PC - Konstruktion',
      'verzinken',
    ])
    const verzinken = vorschlaege.find((v) => v.was === 'verzinken')
    expect(verzinken?.kosten, 'der neuere Preis gewinnt').toBe(140)
    expect(verzinken?.dienstleister).toBe(2)
  })

  test('leere Schritte sind kein Vorschlag', () => {
    expect(vorschlaegeAus([{ arbeitsplan: [{ was: '   ' }, { was: null }] }])).toHaveLength(0)
  })

  test('ein angefangener Schritt wird nicht überschrieben', () => {
    // Wer schon Minuten eingetragen hat und danach den Namen
    // vervollständigt, behält seine Zahlen — sonst ist die Vorlage
    // schlimmer als keine.
    expect(unberuehrt({ was: 'PC' })).toBe(true)
    expect(unberuehrt({ was: 'PC', minuten: 30 })).toBe(false)
    expect(unberuehrt({ was: 'PC', dienstleister: 3 })).toBe(false)
    expect(unberuehrt({ was: 'PC', notiz: 'nur Werktags' })).toBe(false)
  })
})

test.describe('Die Angaben des Kunden auf der Rechnung', () => {
  /*
   * Der Anlass aus dem Betrieb: Eine Rechnung ging ohne die USt-IdNr des
   * Kunden hinaus, weil sie beim Anlegen noch nicht am Geschäftspartner
   * stand. Eine gestellte Rechnung lässt sich nicht ändern — sie musste
   * storniert und neu geschrieben werden.
   */
  test('die Anschrift setzt sich zusammen aus dem, was da ist', () => {
    expect(
      anschriftAus({ line1: '3 rue des Forges', postalCode: '67630', city: 'Lauterbourg', country: 'Frankreich' }),
    ).toBe('3 rue des Forges\n67630 Lauterbourg\nFrankreich')

    // Nur was da ist — eine leere Zeile im Adressfeld sieht aus wie ein Fehler
    expect(anschriftAus({ city: 'Lauterbourg', country: 'Frankreich' })).toBe(
      'Lauterbourg\nFrankreich',
    )
    expect(anschriftAus({})).toBe('')
  })
})

test.describe('Die Zahlen nach einem Storno', () => {
  /*
   * Aus dem Büro gemeldet, mit Bild: Ein Auftrag über 180 € meldete
   * „-180,00 € eingegangen · 360,00 € stehen noch aus". Die Gegenrechnung
   * trägt „bezahlt" und einen negativen Betrag; das stornierte Original steht
   * auf „storniert" und zählte nie mit. Übrig blieb die halbe Rechnung mit
   * umgedrehtem Vorzeichen.
   */
  const stufen = { anzahlung: 0, zwischen: 0, schluss: 180 }
  const storniertesPaar = [
    { status: 'storniert', netto: 180 },
    { status: 'bezahlt', netto: -180, stornoVon: 2 },
  ]

  test('ein Storno hebt sich auf, statt die Summe zu verdrehen', () => {
    expect(eingegangen(storniertesPaar), 'nichts eingegangen, nichts abgeflossen').toBe(0)
    expect(offenerBetrag(stufen, storniertesPaar), 'der volle Auftragswert steht aus').toBe(180)
  })

  test('eine bezahlte Rechnung zählt weiter', () => {
    const bezahlt = [{ status: 'bezahlt', netto: 180 }]
    expect(eingegangen(bezahlt)).toBe(180)
    expect(offenerBetrag(stufen, bezahlt)).toBe(0)
  })

  test('neben dem stornierten Paar zählt die neue Rechnung', () => {
    // Der Normalfall nach der Behebung: storniert, neu geschrieben, bezahlt.
    const alles = [...storniertesPaar, { status: 'bezahlt', netto: 180 }]
    expect(eingegangen(alles)).toBe(180)
    expect(offenerBetrag(stufen, alles)).toBe(0)
  })
})

test.describe('Die Steuernummern des Kunden auf dem Papier', () => {
  /*
   * Bei Reverse Charge ist die USt-IdNr des Empfängers Pflicht. Sie stand
   * bisher ausschließlich im maschinenlesbaren Anhang der Factur-X-Datei —
   * dort liest sie kein Mensch, der ein Papier in der Hand hält, und kein
   * Kunde, der seinen Vorsteuerabzug belegen will.
   */
  test('der Empfängerblock des PDF kennt USt-IdNr und SIRET', () => {
    const quelle = fs.readFileSync(path.join(process.cwd(), 'src/lib/invoice.ts'), 'utf8')
    expect(quelle, 'die USt-IdNr wird gedruckt').toContain('USt-IdNr.:')
    expect(quelle, 'der SIRET wird gedruckt').toContain('SIRET:')
  })

  test('die Rechnung reicht beide Angaben an den Druck weiter', () => {
    const quelle = fs.readFileSync(path.join(process.cwd(), 'src/lib/dokumente.ts'), 'utf8')
    // Ohne diese Zeilen bliebe der Block leer, so richtig der Druck auch wäre
    expect(quelle).toMatch(/umsatzsteuerId:\s*r\.customerVatId/)
    expect(quelle).toMatch(/kennung:\s*r\.customerSiret/)
  })
})
