import { expect, test } from '@playwright/test'

import { alsDatev, alsWindows1252, datevDateiname } from '../src/lib/datev'
import type { Steuerbericht, Steuerzeile } from '../src/lib/steuerexport'

/**
 * Der Buchungsstapel für DATEV.
 *
 * Am Format ist nichts verhandelbar: Wer von Kopfzeile, Feldreihenfolge oder
 * Kodierung abweicht, bekommt beim Import eine Fehlermeldung und sonst
 * nichts. Genau deshalb wird hier auf Zeichen geprüft und nicht auf „sieht
 * plausibel aus" — ein Fehler fällt sonst erst in der Kanzlei auf, und dort
 * sucht ihn jemand bei sich.
 */

const ERZEUGT = '20260826120000000'
const ANGABEN = { berater: 123456, mandant: 4711 }

function zeile(teil: Partial<Steuerzeile>): Steuerzeile {
  return {
    art: 'einnahme',
    quelle: 'Projektrechnung',
    datum: '2026-08-19',
    nummer: 'RE-2026-0001',
    partner: 'Stadt Naila',
    bezeichnung: 'Sitzbank Cortenstahl',
    kategorie: 'Leistung',
    netto: 1000,
    steuersatz: 19,
    steuer: 190,
    brutto: 1190,
    beleg: null,
    ...teil,
  }
}

function bericht(zeilen: Steuerzeile[]): Steuerbericht {
  return {
    jahr: 2026,
    zeilen,
    einnahmen: 0,
    ausgaben: 0,
    ergebnis: 0,
    ausgabenNachKategorie: [],
    steuerEinnahmen: 0,
    steuerAusgaben: 0,
    ohneBeleg: 0,
    inventurWert: null,
    inventurStichtag: null,
  }
}

/** Die Datenzeilen ohne den zweizeiligen Kopf. */
const buchungen = (inhalt: string) => inhalt.split('\r\n').filter(Boolean).slice(2)

test.describe('DATEV-Buchungsstapel', () => {
  test('der Kopf trägt Kennung, Version und die zwei Nummern', () => {
    const inhalt = alsDatev(bericht([zeile({})]), ANGABEN, ERZEUGT)
    const [erste, zweite] = inhalt.split('\r\n')
    const f = erste!.split(';')

    expect(f[0], 'Kennung EXTF — daran erkennt DATEV die Datei').toBe('"EXTF"')
    expect(f[2], 'Kategorie 21 = Buchungsstapel').toBe('21')
    expect(f[10], 'Beraternummer').toBe('123456')
    expect(f[11], 'Mandantennummer').toBe('4711')
    expect(f[21], 'Währung').toBe('"EUR"')

    // Die Spaltenzeile muss genau die 14 Felder der Datenzeilen benennen
    expect(zweite!.split(';')).toHaveLength(14)
    expect(zweite).toContain('"Soll/Haben-Kennzeichen"')
  })

  test('eine Einnahme läuft auf Forderung gegen Erlöse, im Soll', () => {
    const inhalt = alsDatev(bericht([zeile({})]), ANGABEN, ERZEUGT)
    const f = buchungen(inhalt)[0]!.split(';')

    expect(f[0], 'Betrag mit Komma').toBe('1190,00')
    expect(f[1], 'Einnahme steht im Soll').toBe('"S"')
    expect(f[6], 'Konto: Forderungen').toBe('1400')
    expect(f[7], 'Gegenkonto: Erlöse 19 %').toBe('8400')
    expect(f[9], 'Belegdatum als TTMM — das Jahr steht im Kopf').toBe('1908')
    expect(f[10], 'Belegfeld 1 trägt die Rechnungsnummer').toBe('"RE-2026-0001"')
  })

  test('eine Ausgabe läuft auf ihr Sachkonto gegen Verbindlichkeiten, im Haben', () => {
    const inhalt = alsDatev(
      bericht([
        zeile({
          art: 'ausgabe',
          schluessel: 'material',
          kategorie: 'Material & Rohstoffe',
          nummer: 'ER-778',
          brutto: 238,
        }),
      ]),
      ANGABEN,
      ERZEUGT,
    )
    const f = buchungen(inhalt)[0]!.split(';')

    expect(f[1], 'Ausgabe steht im Haben').toBe('"H"')
    expect(f[6], 'Material läuft auf 3400').toBe('3400')
    expect(f[7], 'Gegenkonto: Verbindlichkeiten').toBe('1600')
  })

  test('eine unbekannte Kategorie landet auf dem Sammelkonto, nicht im Nichts', () => {
    const inhalt = alsDatev(
      bericht([zeile({ art: 'ausgabe', schluessel: 'gibt-es-nicht', brutto: 50 })]),
      ANGABEN,
      ERZEUGT,
    )
    // Lieber auf 4900 als ohne Konto: Eine Zeile ohne Konto lässt den Import scheitern
    expect(buchungen(inhalt)[0]!.split(';')[6]).toBe('4900')
  })

  /**
   * Reverse Charge: steuerfrei und auf ein eigenes Erlöskonto.
   *
   * Der BU-Schlüssel 0 ist hier der Punkt. Bleibt er leer, nimmt DATEV den
   * Automatikwert des Kontos und rechnet eine Steuer hinzu, die auf dem Papier
   * nicht steht.
   */
  test('Reverse Charge bucht steuerfrei auf 8125', () => {
    const inhalt = alsDatev(
      bericht([zeile({ reverseCharge: true, steuersatz: 0, steuer: 0, brutto: 1000 })]),
      ANGABEN,
      ERZEUGT,
    )
    const f = buchungen(inhalt)[0]!.split(';')

    expect(f[7], 'innergemeinschaftliche Lieferung').toBe('8125')
    expect(f[8], 'BU-Schlüssel 0 — keine Steuer hinzurechnen').toBe('0')
  })

  /**
   * Eine Gutschrift dreht die Richtung, nicht das Vorzeichen.
   *
   * DATEV kennt im Betragsfeld kein Minus. Steht dort eines, bricht der Import
   * ab — die Aussage „zurück" gehört ins Soll/Haben-Kennzeichen.
   */
  test('ein negativer Betrag dreht Soll und Haben, nicht das Vorzeichen', () => {
    const storno = alsDatev(bericht([zeile({ brutto: -1190 })]), ANGABEN, ERZEUGT)
    const f = buchungen(storno)[0]!.split(';')

    expect(f[0], 'Betrag bleibt positiv').toBe('1190,00')
    expect(f[1], 'die Einnahme dreht ins Haben').toBe('"H"')
    expect(f[0]).not.toContain('-')
  })

  test('jede Buchungszeile hat genau vierzehn Felder', () => {
    const inhalt = alsDatev(
      bericht([
        zeile({}),
        zeile({ art: 'ausgabe', schluessel: 'fahrzeug', brutto: 90 }),
        zeile({ brutto: -50 }),
      ]),
      ANGABEN,
      ERZEUGT,
    )
    for (const z of buchungen(inhalt)) expect(z.split(';')).toHaveLength(14)
  })

  test('Zeilen ohne Datum oder Betrag fallen heraus', () => {
    const inhalt = alsDatev(
      bericht([zeile({}), zeile({ datum: '' }), zeile({ brutto: 0 })]),
      ANGABEN,
      ERZEUGT,
    )
    // Eine Buchung ohne Datum kann DATEV nicht zuordnen, eine über null Euro
    // ist keine Buchung — beide gehören nicht in den Stapel.
    expect(buchungen(inhalt)).toHaveLength(1)
  })

  /**
   * Windows-1252, und warum es der Punkt ist, an dem es sonst scheitert.
   *
   * In UTF-8 wird „Müller" zu „MÃ¼ller". Je nach DATEV-Fassung bricht der
   * Import ab oder trägt den Unsinn ein — und dann steht ein falscher Name in
   * der Buchhaltung.
   */
  test('Umlaute stehen als Windows-1252 in der Datei', () => {
    const inhalt = alsDatev(
      bericht([zeile({ partner: 'Müller & Söhne GbR', bezeichnung: 'Geländer außen' })]),
      ANGABEN,
      ERZEUGT,
    )
    const bytes = alsWindows1252(inhalt)

    expect(bytes.includes(0xfc), 'ü als einzelnes Byte 0xFC').toBe(true)
    expect(bytes.includes(0xf6), 'ö als 0xF6').toBe(true)
    expect(bytes.includes(0xdf), 'ß als 0xDF').toBe(true)
    // 0xC3 ist das erste Byte einer UTF-8-Umlautfolge — es darf nicht vorkommen
    expect(bytes.includes(0xc3), 'keine UTF-8-Trümmer').toBe(false)
  })

  test('Zeichen ohne Entsprechung werden ersetzt, nicht verstümmelt', () => {
    const inhalt = alsDatev(
      bericht([zeile({ bezeichnung: 'Sitzbank – 2,00 m … „nach Zeichnung"' })]),
      ANGABEN,
      ERZEUGT,
    )
    const text = alsWindows1252(inhalt).toString('latin1')

    // Gedankenstrich und Auslassungspunkte haben in Windows-1252 keine
    // Entsprechung: Sie werden zu Bindestrich und drei Punkten, statt als
    // Fragezeichen zu verschwinden.
    expect(text).toContain('Sitzbank - 2,00 m ...')
    expect(text).not.toContain('?')
  })

  test('der Dateiname beginnt mit EXTF_, mit und ohne Monat', () => {
    // Ohne das Präfix erkennt der Import die Datei nicht als Buchungsstapel
    expect(datevDateiname(2026)).toBe('EXTF_Buchungsstapel_2026.csv')
    expect(datevDateiname(2026, 8)).toBe('EXTF_Buchungsstapel_2026-08.csv')
  })
})
