import type { CompanyInfo } from './mail'

/**
 * Factur-X: die elektronische Rechnung, wie Frankreich sie verlangt.
 *
 * Ab September 2026 muss jedes französische Unternehmen elektronische
 * Rechnungen empfangen können, das Ausstellen folgt gestaffelt. Eine
 * elektronische Rechnung ist dabei nicht „ein PDF per Mail", sondern ein
 * strukturierter Datensatz. Factur-X ist der französisch-deutsche Weg dahin:
 * ein ganz normales PDF, in dem die Rechnung zusätzlich als XML steckt. Der
 * Mensch sieht das Blatt wie immer, die Maschine liest die Daten.
 *
 * Erzeugt wird hier das Profil **BASIC** nach EN 16931 — es deckt alles ab,
 * was eine Werkstattrechnung braucht, und wird von den Plattformen
 * verstanden. Die Einbettung ins PDF passiert in invoice.ts.
 *
 * Kein Ersatz für die Anbindung an eine Plateforme Agréée: Die Datei ist
 * korrekt, den Versandweg dorthin muss der Betrieb noch wählen.
 */

export type FacturXPosition = {
  bezeichnung: string
  menge: number
  /** Nettopreis je Einheit */
  einzelpreis: number
  steuersatz: number
  /** UN/ECE-Einheitencode, Standard H87 = Stück */
  einheit?: string
}

export type FacturXDaten = {
  nummer: string
  /** Rechnungsdatum */
  datum: Date
  faelligAm?: Date | null
  /** 380 = Rechnung, 381 = Gutschrift */
  typ?: '380' | '381'
  kunde: {
    name: string
    anschrift?: string[]
    plz?: string | null
    ort?: string | null
    land?: string | null
    /** SIRET (14 Stellen) oder SIREN (9) */
    kennung?: string | null
    umsatzsteuerId?: string | null
  }
  /** Abweichende Lieferanschrift, sonst wird die des Kunden angenommen */
  lieferung?: { name?: string | null; anschrift?: string[]; plz?: string | null; ort?: string | null; land?: string | null } | null
  lieferdatum?: Date | null
  /** Bestellnummer oder Aktenzeichen des Kunden */
  bestellreferenz?: string | null
  positionen: FacturXPosition[]
  /** Nachlass auf die Nettosumme */
  rabatt?: { bezeichnung: string; betrag: number } | null
  /** Sonstige Zeilen wie Versand — netto */
  zusatzzeilen?: { bezeichnung: string; betrag: number; steuersatz: number }[]
  reverseCharge?: boolean
  /** Bereits gezahlt (z.B. Anzahlung oder Shop-Bestellung) */
  bereitsGezahlt?: number | null
  iban?: string | null
  bic?: string | null
  hinweis?: string | null
}

const zwei = (n: number) => (Math.round(n * 100) / 100).toFixed(2)
const vier = (n: number) => (Math.round(n * 10000) / 10000).toFixed(4)

/** Datumsformat 102 der CII: JJJJMMTT */
const tag = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`

/** XML-Sonderzeichen entschärfen — Firmennamen enthalten gern ein & */
function x(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Anschrift zerlegen.
 *
 * In der Verwaltung steht die Anschrift als freier Mehrzeiler — die XML will
 * Straße, PLZ, Ort und Land getrennt. Sind sie nicht gepflegt, wird die
 * übliche deutsche/französische Schreibweise „12345 Ort" gelesen.
 */
export function anschriftZerlegen(zeilen: string[] = []): {
  strasse: string[]
  plz: string | null
  ort: string | null
  land: string | null
} {
  const sauber = zeilen.map((z) => z.trim()).filter(Boolean)
  const laender: Record<string, string> = {
    deutschland: 'DE',
    germany: 'DE',
    allemagne: 'DE',
    frankreich: 'FR',
    france: 'FR',
    schweiz: 'CH',
    suisse: 'CH',
    belgien: 'BE',
    belgique: 'BE',
    luxemburg: 'LU',
    luxembourg: 'LU',
    österreich: 'AT',
    autriche: 'AT',
  }

  let land: string | null = null
  const letzte = sauber[sauber.length - 1]?.toLowerCase()
  if (letzte && laender[letzte]) {
    land = laender[letzte]
    sauber.pop()
  }

  let plz: string | null = null
  let ort: string | null = null
  for (let i = sauber.length - 1; i >= 0; i -= 1) {
    const treffer = /^([A-Z]{1,2}-)?(\d{4,5})\s+(.+)$/.exec(sauber[i]!)
    if (treffer) {
      plz = treffer[2]!
      ort = treffer[3]!
      sauber.splice(i, 1)
      break
    }
  }

  return { strasse: sauber, plz, ort, land }
}

/** Beträge je Steuersatz — die XML verlangt eine Gruppe pro Satz. */
function steuerGruppen(daten: FacturXDaten) {
  const gruppen = new Map<number, number>()
  for (const p of daten.positionen) {
    const netto = p.menge * p.einzelpreis
    gruppen.set(p.steuersatz, (gruppen.get(p.steuersatz) ?? 0) + netto)
  }
  for (const z of daten.zusatzzeilen ?? []) {
    gruppen.set(z.steuersatz, (gruppen.get(z.steuersatz) ?? 0) + z.betrag)
  }

  const summe = [...gruppen.values()].reduce((s, n) => s + n, 0)
  const nachlass = Math.min(Math.max(daten.rabatt?.betrag ?? 0, 0), summe)
  // Der Nachlass verteilt sich anteilig — bei zwei Steuersätzen ist alles
  // andere schlicht falsch gerechnet.
  const anteil = summe > 0 ? (summe - nachlass) / summe : 1

  return [...gruppen.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([satz, netto]) => {
      const grundlage = Math.round(netto * anteil * 100) / 100
      return {
        satz,
        grundlage,
        steuer: Math.round(grundlage * (satz / 100) * 100) / 100,
      }
    })
}

export function facturXSummen(daten: FacturXDaten) {
  const zeilenSumme =
    daten.positionen.reduce((s, p) => s + p.menge * p.einzelpreis, 0) +
    (daten.zusatzzeilen ?? []).reduce((s, z) => s + z.betrag, 0)
  const nachlass = Math.min(Math.max(daten.rabatt?.betrag ?? 0, 0), zeilenSumme)
  const gruppen = steuerGruppen(daten)
  const steuer = daten.reverseCharge ? 0 : gruppen.reduce((s, g) => s + g.steuer, 0)
  const netto = Math.round((zeilenSumme - nachlass) * 100) / 100
  const brutto = Math.round((netto + steuer) * 100) / 100
  const gezahlt = Math.min(Math.max(daten.bereitsGezahlt ?? 0, 0), brutto)

  return {
    zeilenSumme: Math.round(zeilenSumme * 100) / 100,
    nachlass: Math.round(nachlass * 100) / 100,
    netto,
    steuer: Math.round(steuer * 100) / 100,
    brutto,
    gezahlt: Math.round(gezahlt * 100) / 100,
    offen: Math.round((brutto - gezahlt) * 100) / 100,
    gruppen,
  }
}

/** Partei (Verkäufer, Käufer, Lieferanschrift) als XML-Block */
function partei(
  rolle: 'SellerTradeParty' | 'BuyerTradeParty' | 'ShipToTradeParty',
  angaben: {
    name?: string | null
    kennung?: string | null
    strasse?: string[]
    plz?: string | null
    ort?: string | null
    land?: string | null
    umsatzsteuerId?: string | null
  },
): string {
  const teile: string[] = [`      <ram:${rolle}>`]
  teile.push(`        <ram:Name>${x(angaben.name || '—')}</ram:Name>`)

  // Die Kennung des Unternehmens: In Frankreich SIRET (Schema 0009), in
  // Deutschland gibt es keine Entsprechung — dann bleibt der Block weg.
  if (angaben.kennung) {
    const nur = angaben.kennung.replace(/\s/g, '')
    teile.push(
      '        <ram:SpecifiedLegalOrganization>',
      `          <ram:ID schemeID="0009">${x(nur)}</ram:ID>`,
      '        </ram:SpecifiedLegalOrganization>',
    )
  }

  teile.push('        <ram:PostalTradeAddress>')
  if (angaben.plz) teile.push(`          <ram:PostcodeCode>${x(angaben.plz)}</ram:PostcodeCode>`)
  ;(angaben.strasse ?? []).slice(0, 3).forEach((zeile, i) => {
    const feld = ['LineOne', 'LineTwo', 'LineThree'][i]
    teile.push(`          <ram:${feld}>${x(zeile)}</ram:${feld}>`)
  })
  if (angaben.ort) teile.push(`          <ram:CityName>${x(angaben.ort)}</ram:CityName>`)
  teile.push(`          <ram:CountryID>${x(angaben.land || 'FR')}</ram:CountryID>`)
  teile.push('        </ram:PostalTradeAddress>')

  if (angaben.umsatzsteuerId) {
    teile.push(
      '        <ram:SpecifiedTaxRegistration>',
      `          <ram:ID schemeID="VA">${x(angaben.umsatzsteuerId.replace(/\s/g, ''))}</ram:ID>`,
      '        </ram:SpecifiedTaxRegistration>',
    )
  }

  teile.push(`      </ram:${rolle}>`)
  return teile.join('\n')
}

/**
 * Baut die Factur-X-XML (Profil BASIC).
 *
 * Von Hand zusammengesetzt statt über eine Bibliothek: Die Reihenfolge der
 * Elemente ist im Standard fest vorgegeben, und ein selbst geschriebener
 * Erzeuger ist besser nachvollziehbar als eine Abhängigkeit, die einmal im
 * Jahr gepflegt wird.
 */
export function facturXml(daten: FacturXDaten, firma: CompanyInfo | undefined): string {
  const s = facturXSummen(daten)
  const verkaeufer = anschriftZerlegen((firma?.address ?? '').split(/\n|,/).filter(Boolean))
  const kunde = {
    ...anschriftZerlegen(daten.kunde.anschrift ?? []),
  }
  const kundePlz = daten.kunde.plz ?? kunde.plz
  const kundeOrt = daten.kunde.ort ?? kunde.ort
  const kundeLand = daten.kunde.land ?? kunde.land

  const zeilen: string[] = []
  zeilen.push('<?xml version="1.0" encoding="UTF-8"?>')
  zeilen.push(
    '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">',
  )

  // ── Welches Profil ────────────────────────────────────────────────────────
  zeilen.push(
    '  <rsm:ExchangedDocumentContext>',
    '    <ram:GuidelineSpecifiedDocumentContextParameter>',
    '      <ram:ID>urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic</ram:ID>',
    '    </ram:GuidelineSpecifiedDocumentContextParameter>',
    '  </rsm:ExchangedDocumentContext>',
  )

  // ── Kopfdaten ─────────────────────────────────────────────────────────────
  zeilen.push(
    '  <rsm:ExchangedDocument>',
    `    <ram:ID>${x(daten.nummer)}</ram:ID>`,
    `    <ram:TypeCode>${daten.typ ?? '380'}</ram:TypeCode>`,
    '    <ram:IssueDateTime>',
    `      <udt:DateTimeString format="102">${tag(daten.datum)}</udt:DateTimeString>`,
    '    </ram:IssueDateTime>',
  )
  if (daten.hinweis) {
    zeilen.push(
      '    <ram:IncludedNote>',
      `      <ram:Content>${x(daten.hinweis)}</ram:Content>`,
      '    </ram:IncludedNote>',
    )
  }
  if (daten.reverseCharge) {
    zeilen.push(
      '    <ram:IncludedNote>',
      '      <ram:Content>Autoliquidation — Steuerschuldnerschaft des Leistungsempfängers</ram:Content>',
      '    </ram:IncludedNote>',
    )
  }
  zeilen.push('  </rsm:ExchangedDocument>')

  zeilen.push('  <rsm:SupplyChainTradeTransaction>')

  // ── Positionen ────────────────────────────────────────────────────────────
  daten.positionen.forEach((p, i) => {
    zeilen.push(
      '    <ram:IncludedSupplyChainTradeLineItem>',
      '      <ram:AssociatedDocumentLineDocument>',
      `        <ram:LineID>${i + 1}</ram:LineID>`,
      '      </ram:AssociatedDocumentLineDocument>',
      '      <ram:SpecifiedTradeProduct>',
      `        <ram:Name>${x(p.bezeichnung)}</ram:Name>`,
      '      </ram:SpecifiedTradeProduct>',
      '      <ram:SpecifiedLineTradeAgreement>',
      '        <ram:NetPriceProductTradePrice>',
      `          <ram:ChargeAmount>${vier(p.einzelpreis)}</ram:ChargeAmount>`,
      '        </ram:NetPriceProductTradePrice>',
      '      </ram:SpecifiedLineTradeAgreement>',
      '      <ram:SpecifiedLineTradeDelivery>',
      `        <ram:BilledQuantity unitCode="${x(p.einheit || 'H87')}">${vier(p.menge)}</ram:BilledQuantity>`,
      '      </ram:SpecifiedLineTradeDelivery>',
      '      <ram:SpecifiedLineTradeSettlement>',
      '        <ram:ApplicableTradeTax>',
      '          <ram:TypeCode>VAT</ram:TypeCode>',
      `          <ram:CategoryCode>${daten.reverseCharge ? 'AE' : p.steuersatz > 0 ? 'S' : 'Z'}</ram:CategoryCode>`,
      `          <ram:RateApplicablePercent>${zwei(daten.reverseCharge ? 0 : p.steuersatz)}</ram:RateApplicablePercent>`,
      '        </ram:ApplicableTradeTax>',
      '        <ram:SpecifiedTradeSettlementLineMonetarySummation>',
      `          <ram:LineTotalAmount>${zwei(p.menge * p.einzelpreis)}</ram:LineTotalAmount>`,
      '        </ram:SpecifiedTradeSettlementLineMonetarySummation>',
      '      </ram:SpecifiedLineTradeSettlement>',
      '    </ram:IncludedSupplyChainTradeLineItem>',
    )
  })

  // Versand und Ähnliches als eigene Zeilen — sonst stimmt die Summe der
  // Positionen nicht mit dem Gesamtbetrag überein, und genau das prüft jede
  // Empfängerplattform als Erstes.
  ;(daten.zusatzzeilen ?? []).forEach((z, i) => {
    const nummer = daten.positionen.length + i + 1
    zeilen.push(
      '    <ram:IncludedSupplyChainTradeLineItem>',
      '      <ram:AssociatedDocumentLineDocument>',
      `        <ram:LineID>${nummer}</ram:LineID>`,
      '      </ram:AssociatedDocumentLineDocument>',
      '      <ram:SpecifiedTradeProduct>',
      `        <ram:Name>${x(z.bezeichnung)}</ram:Name>`,
      '      </ram:SpecifiedTradeProduct>',
      '      <ram:SpecifiedLineTradeAgreement>',
      '        <ram:NetPriceProductTradePrice>',
      `          <ram:ChargeAmount>${vier(z.betrag)}</ram:ChargeAmount>`,
      '        </ram:NetPriceProductTradePrice>',
      '      </ram:SpecifiedLineTradeAgreement>',
      '      <ram:SpecifiedLineTradeDelivery>',
      '        <ram:BilledQuantity unitCode="H87">1.0000</ram:BilledQuantity>',
      '      </ram:SpecifiedLineTradeDelivery>',
      '      <ram:SpecifiedLineTradeSettlement>',
      '        <ram:ApplicableTradeTax>',
      '          <ram:TypeCode>VAT</ram:TypeCode>',
      `          <ram:CategoryCode>${daten.reverseCharge ? 'AE' : z.steuersatz > 0 ? 'S' : 'Z'}</ram:CategoryCode>`,
      `          <ram:RateApplicablePercent>${zwei(daten.reverseCharge ? 0 : z.steuersatz)}</ram:RateApplicablePercent>`,
      '        </ram:ApplicableTradeTax>',
      '        <ram:SpecifiedTradeSettlementLineMonetarySummation>',
      `          <ram:LineTotalAmount>${zwei(z.betrag)}</ram:LineTotalAmount>`,
      '        </ram:SpecifiedTradeSettlementLineMonetarySummation>',
      '      </ram:SpecifiedLineTradeSettlement>',
      '    </ram:IncludedSupplyChainTradeLineItem>',
    )
  })

  // ── Wer an wen ────────────────────────────────────────────────────────────
  zeilen.push('    <ram:ApplicableHeaderTradeAgreement>')
  if (daten.bestellreferenz) {
    zeilen.push(`      <ram:BuyerReference>${x(daten.bestellreferenz)}</ram:BuyerReference>`)
  }
  zeilen.push(
    partei('SellerTradeParty', {
      name: firma?.legalName || firma?.name,
      kennung: firma?.siret,
      strasse: verkaeufer.strasse,
      plz: verkaeufer.plz,
      ort: verkaeufer.ort,
      land: verkaeufer.land || 'FR',
      umsatzsteuerId: firma?.vatId,
    }),
    partei('BuyerTradeParty', {
      name: daten.kunde.name,
      kennung: daten.kunde.kennung,
      strasse: kunde.strasse,
      plz: kundePlz,
      ort: kundeOrt,
      land: kundeLand || 'FR',
      umsatzsteuerId: daten.kunde.umsatzsteuerId,
    }),
  )
  if (daten.bestellreferenz) {
    zeilen.push(
      '      <ram:BuyerOrderReferencedDocument>',
      `        <ram:IssuerAssignedID>${x(daten.bestellreferenz)}</ram:IssuerAssignedID>`,
      '      </ram:BuyerOrderReferencedDocument>',
    )
  }
  zeilen.push('    </ram:ApplicableHeaderTradeAgreement>')

  // ── Lieferung ─────────────────────────────────────────────────────────────
  zeilen.push('    <ram:ApplicableHeaderTradeDelivery>')
  if (daten.lieferung) {
    const lieferAnschrift = anschriftZerlegen(daten.lieferung.anschrift ?? [])
    zeilen.push(
      partei('ShipToTradeParty', {
        name: daten.lieferung.name || daten.kunde.name,
        strasse: lieferAnschrift.strasse,
        plz: daten.lieferung.plz ?? lieferAnschrift.plz,
        ort: daten.lieferung.ort ?? lieferAnschrift.ort,
        land: daten.lieferung.land ?? lieferAnschrift.land ?? 'FR',
      }),
    )
  }
  if (daten.lieferdatum) {
    zeilen.push(
      '      <ram:ActualDeliverySupplyChainEvent>',
      '        <ram:OccurrenceDateTime>',
      `          <udt:DateTimeString format="102">${tag(daten.lieferdatum)}</udt:DateTimeString>`,
      '        </ram:OccurrenceDateTime>',
      '      </ram:ActualDeliverySupplyChainEvent>',
    )
  }
  zeilen.push('    </ram:ApplicableHeaderTradeDelivery>')

  // ── Geld ──────────────────────────────────────────────────────────────────
  zeilen.push(
    '    <ram:ApplicableHeaderTradeSettlement>',
    '      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>',
  )
  if (daten.iban) {
    zeilen.push(
      '      <ram:SpecifiedTradeSettlementPaymentMeans>',
      // 58 = SEPA-Überweisung
      '        <ram:TypeCode>58</ram:TypeCode>',
      '        <ram:PayeePartyCreditorFinancialAccount>',
      `          <ram:IBANID>${x(daten.iban.replace(/\s/g, ''))}</ram:IBANID>`,
      '        </ram:PayeePartyCreditorFinancialAccount>',
      '      </ram:SpecifiedTradeSettlementPaymentMeans>',
    )
  }

  if (daten.reverseCharge) {
    zeilen.push(
      '      <ram:ApplicableTradeTax>',
      `        <ram:CalculatedAmount>0.00</ram:CalculatedAmount>`,
      '        <ram:TypeCode>VAT</ram:TypeCode>',
      '        <ram:ExemptionReason>Autoliquidation</ram:ExemptionReason>',
      `        <ram:BasisAmount>${zwei(s.netto)}</ram:BasisAmount>`,
      '        <ram:CategoryCode>AE</ram:CategoryCode>',
      '        <ram:RateApplicablePercent>0.00</ram:RateApplicablePercent>',
      '      </ram:ApplicableTradeTax>',
    )
  } else {
    for (const gruppe of s.gruppen) {
      zeilen.push(
        '      <ram:ApplicableTradeTax>',
        `        <ram:CalculatedAmount>${zwei(gruppe.steuer)}</ram:CalculatedAmount>`,
        '        <ram:TypeCode>VAT</ram:TypeCode>',
        `        <ram:BasisAmount>${zwei(gruppe.grundlage)}</ram:BasisAmount>`,
        `        <ram:CategoryCode>${gruppe.satz > 0 ? 'S' : 'Z'}</ram:CategoryCode>`,
        `        <ram:RateApplicablePercent>${zwei(gruppe.satz)}</ram:RateApplicablePercent>`,
        '      </ram:ApplicableTradeTax>',
      )
    }
  }

  if (s.nachlass > 0) {
    zeilen.push(
      '      <ram:SpecifiedTradeAllowanceCharge>',
      '        <ram:ChargeIndicator>',
      '          <udt:Indicator>false</udt:Indicator>',
      '        </ram:ChargeIndicator>',
      `        <ram:ActualAmount>${zwei(s.nachlass)}</ram:ActualAmount>`,
      `        <ram:Reason>${x(daten.rabatt?.bezeichnung || 'Nachlass')}</ram:Reason>`,
      '        <ram:CategoryTradeTax>',
      '          <ram:TypeCode>VAT</ram:TypeCode>',
      `          <ram:CategoryCode>${daten.reverseCharge ? 'AE' : 'S'}</ram:CategoryCode>`,
      `          <ram:RateApplicablePercent>${zwei(daten.reverseCharge ? 0 : (s.gruppen[0]?.satz ?? 0))}</ram:RateApplicablePercent>`,
      '        </ram:CategoryTradeTax>',
      '      </ram:SpecifiedTradeAllowanceCharge>',
    )
  }

  if (daten.faelligAm) {
    zeilen.push(
      '      <ram:SpecifiedTradePaymentTerms>',
      '        <ram:DueDateDateTime>',
      `          <udt:DateTimeString format="102">${tag(daten.faelligAm)}</udt:DateTimeString>`,
      '        </ram:DueDateDateTime>',
      '      </ram:SpecifiedTradePaymentTerms>',
    )
  }

  zeilen.push(
    '      <ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    `        <ram:LineTotalAmount>${zwei(s.zeilenSumme)}</ram:LineTotalAmount>`,
    '        <ram:ChargeTotalAmount>0.00</ram:ChargeTotalAmount>',
    `        <ram:AllowanceTotalAmount>${zwei(s.nachlass)}</ram:AllowanceTotalAmount>`,
    `        <ram:TaxBasisTotalAmount>${zwei(s.netto)}</ram:TaxBasisTotalAmount>`,
    `        <ram:TaxTotalAmount currencyID="EUR">${zwei(s.steuer)}</ram:TaxTotalAmount>`,
    `        <ram:GrandTotalAmount>${zwei(s.brutto)}</ram:GrandTotalAmount>`,
    `        <ram:TotalPrepaidAmount>${zwei(s.gezahlt)}</ram:TotalPrepaidAmount>`,
    `        <ram:DuePayableAmount>${zwei(s.offen)}</ram:DuePayableAmount>`,
    '      </ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
    '    </ram:ApplicableHeaderTradeSettlement>',
    '  </rsm:SupplyChainTradeTransaction>',
    '</rsm:CrossIndustryInvoice>',
  )

  return zeilen.join('\n')
}
