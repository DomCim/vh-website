import { expect, test } from '@playwright/test'

import { belegAusFacturX, belegAusPdf, xmlAusPdf } from '../src/lib/facturxLesen'
import { rechnungPdf } from '../src/lib/invoice'

/**
 * Der Rundlauf: Was diese Werkstatt als elektronische Rechnung verschickt,
 * muss sie auch wieder einlesen können. Genau das passiert im Alltag, wenn
 * ein Lieferant eine Factur-X-Rechnung schickt — dann ist Raten unnötig.
 */

const firma = {
  legalName: 'Stahlhandel Ost GmbH',
  address: 'Industriestraße 4\n04103 Leipzig\nDeutschland',
  siret: '12345678900012',
  vatId: 'DE123456789',
  vatRate: 20,
}

const rechnung = {
  nummer: 'ER-2026-4711',
  datum: new Date('2026-08-04T09:00:00Z'),
  faelligAm: new Date('2026-09-03T09:00:00Z'),
  kunde: {
    name: 'Vincent Hellmann SAS',
    anschrift: ['12 rue des Forges', '67000 Strasbourg', 'Frankreich'],
    kennung: '98765432100019',
  },
  positionen: [
    { bezeichnung: 'Flachstahl S235JR 40×8, 6 m', menge: 12, einzelpreis: 38.5, steuersatz: 20 },
    { bezeichnung: 'Rundrohr 42,4×2,6', menge: 4, einzelpreis: 22, steuersatz: 20 },
  ],
  iban: 'DE02120300000000202051',
}

async function beispielPdf() {
  return rechnungPdf(
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
}

test('XML wird aus dem PDF herausgeholt', async () => {
  const xml = xmlAusPdf(await beispielPdf())
  expect(xml, 'keine XML im PDF gefunden').toBeTruthy()
  expect(xml!).toContain('CrossIndustryInvoice')
  expect(xml!).toContain('ER-2026-4711')
})

test('Beleg füllt sich vollständig aus der elektronischen Rechnung', async () => {
  const beleg = belegAusPdf(await beispielPdf())
  expect(beleg).toBeTruthy()

  expect(beleg!.rechnungsnummer).toBe('ER-2026-4711')
  expect(beleg!.rechnungsdatum).toBe('2026-08-04')
  expect(beleg!.faelligkeit).toBe('2026-09-03')
  expect(beleg!.lieferant).toBe('Stahlhandel Ost GmbH')

  // 12 × 38,50 + 4 × 22,00 = 550,00 netto
  expect(beleg!.netto).toBe(550)
  expect(beleg!.steuersatz).toBe(20)
  expect(beleg!.steuer).toBe(110)
  expect(beleg!.brutto).toBe(660)

  // Kommt aus der Norm, nicht aus einer Schätzung
  expect(beleg!.sicherheit).toBe(100)
  expect(beleg!.hinweis).toContain('nicht geschätzt')
})

test('Ein PDF ohne eingebettete Rechnung liefert nichts — dann übernimmt Claude', async () => {
  const ohne = await rechnungPdf(
    {
      nummer: 'RE-ohne-XML',
      preiseSind: 'netto',
      empfaenger: { name: 'Jemand' },
      positionen: [{ bezeichnung: 'Etwas', menge: 1, einzelpreis: 10, steuersatz: 20 }],
    },
    firma,
  )
  expect(xmlAusPdf(ohne)).toBeNull()
  expect(belegAusPdf(ohne)).toBeNull()
})

test('Auch die ältere ZUGFeRD-Schreibweise wird gelesen', () => {
  const alt = `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryDocument xmlns:rsm="urn:ferd:CrossIndustryDocument:invoice:1p0" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:12" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:15">
  <rsm:HeaderExchangedDocument>
    <ram:ID>RG-2026-9</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime><udt:DateTimeString format="102">20260715</udt:DateTimeString></ram:IssueDateTime>
  </rsm:HeaderExchangedDocument>
  <rsm:SpecifiedSupplyChainTradeTransaction>
    <ram:ApplicableSupplyChainTradeAgreement>
      <ram:SellerTradeParty><ram:Name>Verzinkerei Müller &amp; Sohn</ram:Name></ram:SellerTradeParty>
    </ram:ApplicableSupplyChainTradeAgreement>
    <ram:ApplicableSupplyChainTradeSettlement>
      <ram:ApplicableTradeTax><ram:RateApplicablePercent>19.00</ram:RateApplicablePercent></ram:ApplicableTradeTax>
      <ram:SpecifiedTradeSettlementMonetarySummation>
        <ram:TaxBasisTotalAmount>200.00</ram:TaxBasisTotalAmount>
        <ram:TaxTotalAmount currencyID="EUR">38.00</ram:TaxTotalAmount>
        <ram:GrandTotalAmount>238.00</ram:GrandTotalAmount>
      </ram:SpecifiedTradeSettlementMonetarySummation>
    </ram:ApplicableSupplyChainTradeSettlement>
  </rsm:SpecifiedSupplyChainTradeTransaction>
</rsm:CrossIndustryDocument>`

  const beleg = belegAusFacturX(alt)
  expect(beleg?.rechnungsnummer).toBe('RG-2026-9')
  expect(beleg?.rechnungsdatum).toBe('2026-07-15')
  // Das kaufmännische Und darf nicht als Entität stehen bleiben
  expect(beleg?.lieferant).toBe('Verzinkerei Müller & Sohn')
  expect(beleg?.brutto).toBe(238)
  expect(beleg?.steuersatz).toBe(19)
})

test('Eine Gutschrift wird als solche gekennzeichnet', () => {
  const xml = `<rsm:CrossIndustryInvoice xmlns:rsm="x" xmlns:ram="y" xmlns:udt="z">
  <rsm:ExchangedDocument><ram:ID>GS-1</ram:ID><ram:TypeCode>381</ram:TypeCode></rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction><ram:ApplicableHeaderTradeSettlement>
    <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:GrandTotalAmount>50.00</ram:GrandTotalAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
  </ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`
  expect(belegAusFacturX(xml)?.hinweis).toContain('Gutschrift')
})
