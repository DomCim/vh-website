import zlib from 'zlib'

import type { BelegDaten } from './ki'

/**
 * Factur-X **lesen** statt raten.
 *
 * Eine elektronische Rechnung trägt ihre Daten selbst mit sich: Im PDF steckt
 * eine XML-Datei mit Nummer, Datum, Beträgen und Steuersätzen. Wenn ein Beleg
 * so ankommt, muss niemand ihn mehr abtippen — und auch keine KI ihn ansehen.
 * Was in der XML steht, ist exakt; was ein Modell aus einem Foto liest, ist
 * eine gute Schätzung. Erst wenn keine XML dabei ist, geht der Beleg an Claude.
 *
 * Nebenbei erfüllt das den Teil der französischen Pflicht, der ab September
 * 2026 für alle gilt: elektronische Rechnungen **empfangen** und verarbeiten
 * zu können.
 *
 * Unterstützt Factur-X/ZUGFeRD ab 1.0 sowie XRechnung im CII-Format; die
 * Anhänge heißen je nach Erzeuger anders, deshalb wird nach dem Inhalt
 * gesucht und nicht nach dem Dateinamen.
 */

/** Alle Datenströme eines PDFs durchgehen und den mit der Rechnungs-XML finden. */
export function xmlAusPdf(pdf: Buffer): string | null {
  const roh = pdf.toString('latin1')
  const start = /stream\r?\n/g
  let treffer: RegExpExecArray | null

  while ((treffer = start.exec(roh)) !== null) {
    const von = treffer.index + treffer[0].length
    const bis = roh.indexOf('endstream', von)
    if (bis < 0) continue

    const inhalt = pdf.subarray(von, bis)

    // Erst unkomprimiert versuchen, dann entpacken — welcher Filter im
    // Wörterbuch steht, ist uns egal, das Ergebnis zählt.
    for (const kandidat of [() => inhalt, () => zlib.inflateSync(inhalt), () => zlib.inflateRawSync(inhalt)]) {
      let text: string
      try {
        text = kandidat().toString('utf8')
      } catch {
        continue
      }
      if (/<(?:\w+:)?CrossIndustry(?:Invoice|Document)[\s>]/.test(text)) return text
    }
  }

  return null
}

/**
 * Inhalt eines Elements, unabhängig vom Namensraum-Kürzel.
 *
 * Das `(?=[\\s/>])` ist wichtiger, als es aussieht: Ohne diese Bedingung
 * findet die Suche nach `ExchangedDocument` auch `ExchangedDocumentContext` —
 * und damit stünde die Kennung des Profils in der Rechnungsnummer.
 */
function block(xml: string, name: string): string | null {
  const treffer = new RegExp(
    `<(?:\\w+:)?${name}(?=[\\s/>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
  ).exec(xml)
  return treffer ? treffer[1]! : null
}

function wert(xml: string | null, name: string): string | null {
  if (!xml) return null
  const treffer = new RegExp(
    `<(?:\\w+:)?${name}(?=[\\s/>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`,
  ).exec(xml)
  if (!treffer) return null
  return treffer[1]!
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

function zahl(xml: string | null, name: string): number | null {
  const roh = wert(xml, name)
  if (roh === null || roh === '') return null
  const n = Number(roh.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

/** Datum im CII-Format 102 (JJJJMMTT) → JJJJ-MM-TT */
function datum(xml: string | null): string | null {
  const roh = wert(xml, 'DateTimeString')
  if (!roh) return null
  const treffer = /^(\d{4})(\d{2})(\d{2})/.exec(roh.trim())
  return treffer ? `${treffer[1]}-${treffer[2]}-${treffer[3]}` : null
}

/**
 * Die Felder eines Belegs aus der Rechnungs-XML.
 *
 * Bewusst dieselbe Form wie das Ergebnis der KI-Auslesung: Das Formular im
 * Büro füllt sich danach genauso, egal woher die Werte kommen.
 */
export function belegAusFacturX(xml: string): BelegDaten | null {
  // ZUGFeRD 1.0 nennt die Abschnitte anders als Factur-X — beide bedienen.
  const kopf = block(xml, 'ExchangedDocument') ?? block(xml, 'HeaderExchangedDocument')
  const geschaeft =
    block(xml, 'SupplyChainTradeTransaction') ??
    block(xml, 'SpecifiedSupplyChainTradeTransaction') ??
    xml
  const vereinbarung =
    block(geschaeft, 'ApplicableHeaderTradeAgreement') ??
    block(geschaeft, 'ApplicableSupplyChainTradeAgreement')
  const abrechnung =
    block(geschaeft, 'ApplicableHeaderTradeSettlement') ??
    block(geschaeft, 'ApplicableSupplyChainTradeSettlement')

  const nummer = wert(kopf, 'ID')
  const summen =
    block(abrechnung ?? '', 'SpecifiedTradeSettlementHeaderMonetarySummation') ??
    block(abrechnung ?? '', 'SpecifiedTradeSettlementMonetarySummation')

  const brutto = zahl(summen, 'GrandTotalAmount')
  // Ohne Nummer und ohne Betrag ist es keine verwertbare Rechnung
  if (!nummer && brutto === null) return null

  const verkaeufer = block(vereinbarung ?? '', 'SellerTradeParty')
  const steuer = block(abrechnung ?? '', 'ApplicableTradeTax')
  const zahlungsziel =
    block(abrechnung ?? '', 'SpecifiedTradePaymentTerms') ??
    block(abrechnung ?? '', 'SpecifiedTradePaymentTerms')

  const erstePosition =
    block(geschaeft, 'IncludedSupplyChainTradeLineItem') ??
    block(geschaeft, 'IncludedSupplyChainTradeLineItem')
  const bezeichnung = wert(block(erstePosition ?? '', 'SpecifiedTradeProduct'), 'Name')

  const gutschrift = (wert(kopf, 'TypeCode') ?? '380') === '381'
  const anzahlPositionen = (
    xml.match(/<(?:\w+:)?IncludedSupplyChainTradeLineItem[\s>]/g) ?? []
  ).length

  const hinweise = [
    'Aus der eingebetteten E-Rechnung übernommen — nicht geschätzt.',
    gutschrift ? 'Achtung: Das Dokument ist eine Gutschrift (Typ 381).' : null,
    anzahlPositionen > 1 ? `${anzahlPositionen} Positionen, übernommen ist die erste.` : null,
  ].filter(Boolean)

  return {
    lieferant: wert(verkaeufer, 'Name'),
    rechnungsnummer: nummer,
    rechnungsdatum: datum(block(kopf ?? '', 'IssueDateTime')),
    faelligkeit: datum(block(zahlungsziel ?? '', 'DueDateDateTime')),
    netto: zahl(summen, 'TaxBasisTotalAmount'),
    steuersatz: zahl(steuer, 'RateApplicablePercent'),
    steuer: zahl(summen, 'TaxTotalAmount'),
    brutto,
    // Wofür die Ausgabe war, steht in keiner Norm — das bleibt eine Frage an
    // den Menschen, der den Beleg einsortiert.
    kategorie: 'sonstiges',
    bezeichnung: bezeichnung ?? (anzahlPositionen ? `${anzahlPositionen} Positionen` : null),
    sicherheit: 100,
    hinweis: hinweise.join(' '),
  }
}

/** Kurzweg: PDF rein, Belegdaten raus — oder null, wenn keine XML drinsteckt. */
export function belegAusPdf(pdf: Buffer): BelegDaten | null {
  const xml = xmlAusPdf(pdf)
  if (!xml) return null
  try {
    return belegAusFacturX(xml)
  } catch {
    return null
  }
}
