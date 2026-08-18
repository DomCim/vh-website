import { expect, test } from '@playwright/test'

import { anschriftZerlegen, facturXml, facturXSummen } from '../src/lib/facturx'
import { rechnungPdf } from '../src/lib/invoice'

/**
 * Die elektronische Rechnung wird von einer Maschine gelesen — ein Fehler
 * darin fällt nicht auf, er führt nur dazu, dass die Rechnung abgewiesen wird.
 * Deshalb hier festgenagelt.
 */

const firma = {
  legalName: 'Vincent Hellmann SAS',
  address: '12 rue des Forges\n67000 Strasbourg\nFrankreich',
  siret: '123 456 789 00012',
  vatId: 'FR12345678901',
  vatRate: 20,
}

const rechnung = {
  nummer: 'RE-2026-0007',
  datum: new Date('2026-08-18T10:00:00Z'),
  faelligAm: new Date('2026-09-17T10:00:00Z'),
  kunde: {
    name: 'Mairie de Beispielhausen',
    anschrift: ['1 place de la Mairie', '67100 Strasbourg', 'Frankreich'],
    kennung: '98765432100019',
    umsatzsteuerId: 'FR98765432100',
  },
  bestellreferenz: 'BC-2026-042',
  positionen: [
    { bezeichnung: 'Sitzbank Stahl, pulverbeschichtet', menge: 2, einzelpreis: 1200, steuersatz: 20 },
    { bezeichnung: 'Montage vor Ort', menge: 1, einzelpreis: 400, steuersatz: 20 },
  ],
  iban: 'FR7630006000011234567890189',
}

test('Anschrift wird in Straße, PLZ, Ort und Land zerlegt', () => {
  const a = anschriftZerlegen(['1 place de la Mairie', '67100 Strasbourg', 'Frankreich'])
  expect(a.strasse).toEqual(['1 place de la Mairie'])
  expect(a.plz).toBe('67100')
  expect(a.ort).toBe('Strasbourg')
  expect(a.land).toBe('FR')
})

test('Summen der elektronischen Rechnung stimmen mit dem Blatt überein', () => {
  const s = facturXSummen(rechnung)
  expect(s.zeilenSumme).toBe(2800)
  expect(s.netto).toBe(2800)
  expect(s.steuer).toBe(560)
  expect(s.brutto).toBe(3360)
  expect(s.offen).toBe(3360)
})

test('Nachlass wandert in die Steuergrundlage, nicht ans Ende', () => {
  const s = facturXSummen({
    ...rechnung,
    rabatt: { bezeichnung: 'Nachlass', betrag: 280 },
  })
  expect(s.nachlass).toBe(280)
  expect(s.netto).toBe(2520)
  expect(s.steuer).toBe(504)
  expect(s.brutto).toBe(3024)
})

test('XML trägt Profil, Nummer, beide Parteien und die Summen', () => {
  const xml = facturXml(rechnung, firma)

  expect(xml).toContain('urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic')
  expect(xml).toContain('<ram:ID>RE-2026-0007</ram:ID>')
  expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>')
  expect(xml).toContain('<udt:DateTimeString format="102">20260818</udt:DateTimeString>')

  // Verkäufer mit SIRET (Schema 0009) und TVA-Nummer
  expect(xml).toContain('<ram:ID schemeID="0009">12345678900012</ram:ID>')
  expect(xml).toContain('<ram:ID schemeID="VA">FR12345678901</ram:ID>')
  // Käufer mit eigener Kennung — ohne die weist die Plattform ab
  expect(xml).toContain('<ram:ID schemeID="0009">98765432100019</ram:ID>')
  expect(xml).toContain('<ram:BuyerReference>BC-2026-042</ram:BuyerReference>')

  expect(xml).toContain('<ram:GrandTotalAmount>3360.00</ram:GrandTotalAmount>')
  expect(xml).toContain('<ram:TaxTotalAmount currencyID="EUR">560.00</ram:TaxTotalAmount>')
  expect(xml).toContain('<ram:IBANID>FR7630006000011234567890189</ram:IBANID>')

  // Zwei Positionen, fortlaufend nummeriert
  expect(xml).toContain('<ram:LineID>1</ram:LineID>')
  expect(xml).toContain('<ram:LineID>2</ram:LineID>')
})

test('Kaufmännisches Und im Firmennamen bricht die XML nicht', () => {
  const xml = facturXml(
    { ...rechnung, kunde: { ...rechnung.kunde, name: 'Meier & Sohn' } },
    firma,
  )
  expect(xml).toContain('<ram:Name>Meier &amp; Sohn</ram:Name>')
  expect(xml).not.toContain('<ram:Name>Meier & Sohn</ram:Name>')
})

test('Das Rechnungs-PDF trägt die XML wirklich in sich', async () => {
  const pdf = await rechnungPdf(
    {
      nummer: rechnung.nummer,
      datum: rechnung.datum.toISOString(),
      faelligAm: rechnung.faelligAm.toISOString(),
      preiseSind: 'netto',
      empfaenger: { name: rechnung.kunde.name, anschrift: rechnung.kunde.anschrift },
      positionen: rechnung.positionen.map((p) => ({
        bezeichnung: p.bezeichnung,
        menge: p.menge,
        einzelpreis: p.einzelpreis,
        steuersatz: p.steuersatz,
      })),
      facturx: rechnung,
    },
    firma,
  )

  const roh = pdf.toString('latin1')
  expect(roh.slice(0, 8)).toContain('%PDF-1.7')
  expect(roh).toContain('factur-x.xml')
  // Kennzeichnung als PDF/A-3 und als Factur-X — daran erkennt der Empfänger,
  // dass hier Daten und nicht nur ein Bild liegen
  expect(roh).toContain('<pdfaid:part>3</pdfaid:part>')
  expect(roh).toContain('fx:ConformanceLevel')
  expect(roh).toContain('/AFRelationship /Alternative')
})
