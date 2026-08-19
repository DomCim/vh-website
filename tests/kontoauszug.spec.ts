import { expect, test } from '@playwright/test'

import {
  betragLesen,
  camtLesen,
  csvLesen,
  fingerabdruck,
  tagLesen,
  zuordnungsVorschlag,
  type Bewegung,
} from '../src/lib/kontoauszug'

/**
 * Der Zahlungsabgleich entscheidet, ob eine Rechnung als bezahlt gilt — und
 * damit, ob gefertigt wird und ob gemahnt wird. Beides falsch zu tun kostet
 * mehr als jede andere Fehlbuchung im Haus: Eine irrtümlich abgehakte Rechnung
 * fällt erst auf, wenn das Geld ausbleibt, eine übersehene Zahlung führt zur
 * Mahnung an jemanden, der längst bezahlt hat.
 */

test.describe('Beträge, wie Banken sie schreiben', () => {
  test('deutsches und englisches Format meinen dasselbe', () => {
    expect(betragLesen('1.234,56')).toBe(1234.56)
    expect(betragLesen('1,234.56')).toBe(1234.56)
    expect(betragLesen('1234,56')).toBe(1234.56)
    expect(betragLesen('1234.56')).toBe(1234.56)
  })

  /*
   * „1.234" ist der Fall, an dem sich alles entscheidet: eintausend­zwei­-
   * hundertvierunddreißig Euro, nicht eins Komma zwei. Wer hier falsch liegt,
   * hakt eine Rechnung über 1234 € mit einer Zahlung über 1,23 € ab.
   */
  test('ein einzelner Punkt vor drei Ziffern ist ein Tausenderpunkt', () => {
    expect(betragLesen('1.234')).toBe(1234)
    expect(betragLesen('1.234.567')).toBe(1234567)
    expect(betragLesen('1,234')).toBe(1234)
  })

  test('Vorzeichen in allen Schreibweisen', () => {
    expect(betragLesen('-49,90')).toBe(-49.9)
    expect(betragLesen('49,90-')).toBe(-49.9)
    expect(betragLesen('(49,90)')).toBe(-49.9)
    expect(betragLesen('+49,90')).toBe(49.9)
    expect(betragLesen('1.990,00 €')).toBe(1990)
  })

  test('was keine Zahl ist, ist keine Zahl', () => {
    expect(betragLesen('')).toBeNull()
    expect(betragLesen('Summe')).toBeNull()
  })
})

test.describe('Datumsangaben', () => {
  test('deutsch, international und zweistellig', () => {
    expect(tagLesen('19.08.2026')).toBe('2026-08-19')
    expect(tagLesen('9.8.2026')).toBe('2026-08-09')
    expect(tagLesen('2026-08-19')).toBe('2026-08-19')
    expect(tagLesen('19.08.26')).toBe('2026-08-19')
  })
})

test.describe('CSV einer Bank', () => {
  /*
   * Zwei Zeilen Kontobezeichnung vor der Kopfzeile, Semikolon als Trenner,
   * deutsche Zahlen — so kommt es aus dem Sparkassen-Export. Die Spalten
   * werden über ihre Überschrift gefunden, nicht über ihre Stelle: Jede Bank
   * ordnet sie anders an.
   */
  const SPARKASSE = [
    'Girokonto;DE02120300000000202051',
    'Zeitraum;01.08.2026 - 31.08.2026',
    'Buchungstag;Wertstellung;Buchungstext;Auftraggeber/Empfänger;Verwendungszweck;Betrag;Währung',
    '19.08.2026;19.08.2026;Überweisung;Stadt Naila;Rechnung RE-2026-0042-1/3;1.990,00;EUR',
    '18.08.2026;18.08.2026;Lastschrift;Stromwerke;Abschlag August;-129,50;EUR',
  ].join('\n')

  test('findet die Kopfzeile, auch wenn sie nicht oben steht', () => {
    const b = csvLesen(SPARKASSE)
    expect(b).toHaveLength(2)
    expect(b[0]).toMatchObject({
      tag: '2026-08-19',
      betrag: 1990,
      gegenpartei: 'Stadt Naila',
      zweck: 'Rechnung RE-2026-0042-1/3',
    })
  })

  test('Abbuchungen behalten ihr Minus', () => {
    expect(csvLesen(SPARKASSE)[1].betrag).toBe(-129.5)
  })

  test('kommt auch mit Komma-Trenner und Anführungszeichen zurecht', () => {
    const csv = [
      'Datum,Name,Verwendungszweck,Betrag',
      '"19.08.2026","Müller, Anna","Rechnung RE-2026-0043","1990.00"',
    ].join('\n')
    const b = csvLesen(csv)
    expect(b).toHaveLength(1)
    expect(b[0].gegenpartei).toBe('Müller, Anna')
    expect(b[0].betrag).toBe(1990)
  })

  test('Summenzeilen am Fuß sind keine Buchungen', () => {
    const csv = [
      'Buchungstag;Verwendungszweck;Betrag',
      '19.08.2026;Rechnung RE-2026-0042;1.990,00',
      ';Kontostand;12.345,67',
    ].join('\n')
    expect(csvLesen(csv)).toHaveLength(1)
  })
})

test.describe('CAMT.053', () => {
  const CAMT = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt><Stmt>
    <Ntry>
      <Amt Ccy="EUR">1990.00</Amt>
      <CdtDbtInd>CRDT</CdtDbtInd>
      <BookgDt><Dt>2026-08-19</Dt></BookgDt>
      <NtryDtls><TxDtls>
        <RltdPties>
          <Dbtr><Nm>Stadt Naila</Nm></Dbtr>
          <DbtrAcct><Id><IBAN>DE02120300000000202051</IBAN></Id></DbtrAcct>
        </RltdPties>
        <RmtInf><Ustrd>Rechnung RE-2026-</Ustrd><Ustrd>0042-1/3</Ustrd></RmtInf>
      </TxDtls></NtryDtls>
    </Ntry>
    <Ntry>
      <Amt Ccy="EUR">129.50</Amt>
      <CdtDbtInd>DBIT</CdtDbtInd>
      <BookgDt><Dt>2026-08-18</Dt></BookgDt>
      <NtryDtls><TxDtls>
        <RltdPties><Cdtr><Nm>Stromwerke</Nm></Cdtr></RltdPties>
        <RmtInf><Ustrd>Abschlag August</Ustrd></RmtInf>
      </TxDtls></NtryDtls>
    </Ntry>
  </Stmt></BkToCstmrStmt>
</Document>`

  /*
   * Der Betrag steht in CAMT immer positiv da; ob Geld kam oder ging, sagt
   * allein `CdtDbtInd`. Wer das übersieht, hält jede Abbuchung für einen
   * Zahlungseingang und hakt damit fremde Rechnungen ab.
   */
  test('CRDT ist herein, DBIT ist heraus', () => {
    const b = camtLesen(CAMT)
    expect(b).toHaveLength(2)
    expect(b[0].betrag).toBe(1990)
    expect(b[1].betrag).toBe(-129.5)
  })

  test('setzt einen zerteilten Verwendungszweck wieder zusammen', () => {
    // Sonst stünde die Rechnungsnummer halb im einen und halb im nächsten Stück
    expect(camtLesen(CAMT)[0].zweck).toBe('Rechnung RE-2026- 0042-1/3')
  })

  test('nimmt bei einem Eingang den Zahler, bei einer Abbuchung den Empfänger', () => {
    const b = camtLesen(CAMT)
    expect(b[0].gegenpartei).toBe('Stadt Naila')
    expect(b[1].gegenpartei).toBe('Stromwerke')
  })
})

test.describe('Fingerabdruck', () => {
  const b: Bewegung = {
    tag: '2026-08-19',
    betrag: 1990,
    gegenpartei: 'Stadt Naila',
    zweck: 'Rechnung RE-2026-0042',
  }

  test('gleiche Buchung, gleicher Abdruck — auch bei anderer Schreibweise', () => {
    expect(fingerabdruck(b)).toBe(fingerabdruck({ ...b, zweck: 'Rechnung  RE 2026 0042' }))
  })

  test('anderer Betrag, anderer Abdruck', () => {
    expect(fingerabdruck(b)).not.toBe(fingerabdruck({ ...b, betrag: 1990.01 }))
  })
})

test.describe('Welche Rechnung eine Zahlung bezahlt', () => {
  const RECHNUNGEN = [
    { id: 1, invoiceNumber: 'RE-2026-0042-1/3', customerName: 'Stadt Naila', total: 1990 },
    { id: 2, invoiceNumber: 'RE-2026-0043', customerName: 'Anna Müller', total: 640 },
    { id: 3, invoiceNumber: 'RE-2026-0044', customerName: 'Bäckerei Wagner', total: 640 },
  ]

  const zahlung = (teil: Partial<Bewegung>): Bewegung => ({
    tag: '2026-08-19',
    betrag: 1990,
    gegenpartei: 'Stadt Naila',
    zweck: '',
    ...teil,
  })

  test('die Nummer im Verwendungszweck ist der sichere Fall', () => {
    const v = zuordnungsVorschlag(zahlung({ zweck: 'Rechnung RE-2026-0042-1/3' }), RECHNUNGEN)
    expect(v?.rechnung).toBe(1)
    expect(v?.sicherheit).toBe('sicher')
  })

  test('sie zählt auch ohne Bindestriche und mit Zusatztext', () => {
    const v = zuordnungsVorschlag(
      zahlung({ zweck: 'Ueberweisung RE 2026 0042 1/3 Pflanzkuebel' }),
      RECHNUNGEN,
    )
    expect(v?.rechnung).toBe(1)
  })

  /*
   * Steht die Nummer da, der Betrag stimmt aber nicht, wird trotzdem
   * vorgeschlagen — Teilzahlungen kommen vor. Aber eben nicht als „sicher":
   * Der Unterschied steht neben dem Knopf, damit ihn jemand liest.
   */
  test('abweichender Betrag bei passender Nummer ist ein Hinweis, kein Ausschluss', () => {
    const v = zuordnungsVorschlag(
      zahlung({ zweck: 'Rechnung RE-2026-0042-1/3', betrag: 1000 }),
      RECHNUNGEN,
    )
    expect(v?.rechnung).toBe(1)
    expect(v?.sicherheit).toBe('wahrscheinlich')
    expect(v?.grund).toContain('1990.00')
  })

  test('ohne Nummer entscheiden Betrag und Name', () => {
    const v = zuordnungsVorschlag(
      zahlung({ betrag: 640, gegenpartei: 'Anna Müller', zweck: 'Ihre Lieferung' }),
      RECHNUNGEN,
    )
    expect(v?.rechnung).toBe(2)
    expect(v?.sicherheit).toBe('wahrscheinlich')
  })

  /*
   * Zwei offene Rechnungen über denselben Betrag und kein Name, der passt:
   * Jede Wahl wäre geraten, also gibt es keinen Vorschlag. Lieber einmal von
   * Hand zuordnen als einmal die falsche Rechnung abhaken.
   */
  test('bei zwei gleichen Beträgen wird nicht geraten', () => {
    const v = zuordnungsVorschlag(zahlung({ betrag: 640, gegenpartei: 'Sparkasse', zweck: '' }), RECHNUNGEN)
    expect(v).toBeNull()
  })

  test('ist es der einzige Treffer, reicht der Betrag', () => {
    const v = zuordnungsVorschlag(zahlung({ betrag: 1990, gegenpartei: 'unbekannt' }), RECHNUNGEN)
    expect(v?.rechnung).toBe(1)
    expect(v?.sicherheit).toBe('moeglich')
  })

  test('Abbuchungen bekommen nie einen Vorschlag', () => {
    expect(zuordnungsVorschlag(zahlung({ betrag: -1990 }), RECHNUNGEN)).toBeNull()
  })

  test('ohne offene Rechnungen gibt es nichts vorzuschlagen', () => {
    expect(zuordnungsVorschlag(zahlung({}), [])).toBeNull()
  })
})
