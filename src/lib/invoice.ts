import PDFDocument from 'pdfkit'

import { facturXml, type FacturXDaten } from './facturx'
import { giroBild } from './girocode'
import type { CompanyInfo } from './mail'
import { briefkopf, fusszeile, LINKS, RECHTS, schriftenDa, schriftenSetzen } from './pdfkopf'

/**
 * Rechnungs-PDF.
 *
 * Frankreich verlangt je Position den Nettopreis, den Steuersatz und die
 * Steuer getrennt ausgewiesen — die Bruttosumme allein reicht nicht. Deshalb
 * rechnet diese Datei aus den Bruttopreisen des Shops die Nettobeträge zurück
 * und stellt beides nebeneinander.
 */

export type RechnungsPosition = {
  bezeichnung: string
  zusatz?: string | null
  menge: number
  /** Einzelpreis — je nach `preiseSind` brutto oder netto */
  einzelpreis: number
  steuersatz: number
  /**
   * Pfad zu einem kleinen Bild des Artikels — optional.
   *
   * Wer die Rechnung liest, sieht dann, worum es geht, ohne die Zeile zu
   * entziffern; in der Werkstatt erspart das die Rückfrage, welches Teil
   * gemeint ist. Fehlt es, sieht die Zeile aus wie immer.
   */
  bild?: string | null
}

export type RechnungsDaten = {
  /** Angebot, Rechnung und Storno teilen sich dasselbe Layout */
  art?: 'rechnung' | 'angebot' | 'storno'
  nummer: string
  datum?: string | null
  faelligAm?: string | null
  preiseSind: 'brutto' | 'netto'
  empfaenger: { name?: string | null; anschrift?: string[]; email?: string | null }
  positionen: RechnungsPosition[]
  /** Zusätzliche Zeilen wie Versand oder Rabatt (brutto bzw. netto wie oben) */
  zusatzzeilen?: { bezeichnung: string; betrag: number; steuersatz: number }[]
  hinweis?: string | null
  reverseCharge?: boolean
  /** Gewährter Nachlass auf die Nettosumme — anteilig auf alle Steuersätze */
  rabatt?: { bezeichnung: string; betrag: number } | null
  /**
   * Welche Rechnung hier storniert wird — nur bei `art: 'storno'`.
   *
   * Der Verweis gehört aufs Blatt und nicht nur in die Akte: Eine
   * Gegenrechnung ohne Bezug ist für die Buchhaltung ein zweiter Vorgang mit
   * negativen Zahlen, und niemand weiß, welchen sie aufhebt.
   */
  storniert?: { nummer: string; datum?: string | null } | null
  /** nur bei Angeboten */
  gueltigBis?: string | null
  fertigungszeit?: string | null
  /** Fassung eines nachverhandelten Angebots (1 = Erstfassung) */
  fassung?: number | null
  /**
   * Angaben für die elektronische Rechnung. Sind sie da, entsteht ein
   * Factur-X-PDF: dasselbe Blatt, zusätzlich mit eingebetteter XML.
   */
  facturx?: FacturXDaten | null
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Die eingebauten PDF-Schriften kennen nur den WinAnsi-Zeichenvorrat.
 * Ein schmales geschütztes Leerzeichen (aus der französischen
 * Zahlenformatierung) wurde dadurch als „/" gezeichnet, ein echtes
 * Minuszeichen als Anführungszeichen. Deshalb hier einmal geradeziehen.
 */
const pdfText = (s: string): string =>
  s
    .replace(/[\u00a0\u202f\u2009\u2007]/g, ' ')
    .replace(/\u2212/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d\u201e]/g, '"')

const runden = (v: number) => Math.round(v * 100) / 100

/** Netto und Steuer einer Zeile — je nachdem, ob der Preis brutto oder netto ist */
function zerlege(betrag: number, satz: number, preiseSind: 'brutto' | 'netto') {
  if (preiseSind === 'netto') {
    const netto = runden(betrag)
    return { netto, steuer: runden(netto * (satz / 100)) }
  }
  const netto = runden(betrag / (1 + satz / 100))
  return { netto, steuer: runden(betrag - netto) }
}

/**
 * XMP-Kennzeichnung, an der ein Empfänger die eingebettete Rechnung erkennt.
 * Ohne diesen Abschnitt ist die XML nur ein Anhang wie jeder andere.
 */
function facturxMetadaten(profil = 'BASIC'): string {
  return `
        <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
          <pdfaExtension:schemas>
            <rdf:Bag>
              <rdf:li rdf:parseType="Resource">
                <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
                <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
                <pdfaSchema:prefix>fx</pdfaSchema:prefix>
                <pdfaSchema:property>
                  <rdf:Seq>
                    <rdf:li rdf:parseType="Resource">
                      <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                      <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                      <pdfaProperty:category>external</pdfaProperty:category>
                      <pdfaProperty:description>Name des eingebetteten XML-Dokuments</pdfaProperty:description>
                    </rdf:li>
                    <rdf:li rdf:parseType="Resource">
                      <pdfaProperty:name>DocumentType</pdfaProperty:name>
                      <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                      <pdfaProperty:category>external</pdfaProperty:category>
                      <pdfaProperty:description>INVOICE</pdfaProperty:description>
                    </rdf:li>
                    <rdf:li rdf:parseType="Resource">
                      <pdfaProperty:name>Version</pdfaProperty:name>
                      <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                      <pdfaProperty:category>external</pdfaProperty:category>
                      <pdfaProperty:description>Fassung des Factur-X-Standards</pdfaProperty:description>
                    </rdf:li>
                    <rdf:li rdf:parseType="Resource">
                      <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                      <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                      <pdfaProperty:category>external</pdfaProperty:category>
                      <pdfaProperty:description>Profil des eingebetteten Datensatzes</pdfaProperty:description>
                    </rdf:li>
                  </rdf:Seq>
                </pdfaSchema:property>
              </rdf:li>
            </rdf:Bag>
          </pdfaExtension:schemas>
        </rdf:Description>
        <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
          <fx:DocumentType>INVOICE</fx:DocumentType>
          <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
          <fx:Version>1.0</fx:Version>
          <fx:ConformanceLevel>${profil}</fx:ConformanceLevel>
        </rdf:Description>`
}

export async function rechnungPdf(daten: RechnungsDaten, company?: CompanyInfo): Promise<Buffer> {
  // Eine elektronische Rechnung ist ein PDF/A-3 mit eingebetteter XML. Das
  // geht nur mit echten Schriftdateien — fehlen sie, entsteht wie bisher ein
  // gewöhnliches PDF, statt dass die Rechnung gar nicht erst herauskommt.
  const elektronisch = Boolean(daten.facturx) && schriftenDa()

  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    ...(elektronisch
      ? {
          subset: 'PDF/A-3b' as const,
          pdfVersion: '1.7' as const,
          tagged: true,
          displayTitle: true,
          info: {
            Title: `Rechnung ${daten.nummer}`,
            Author: company?.legalName || company?.name || 'Vincent Hellmann',
            Subject: `Rechnung ${daten.nummer}`,
            Keywords: 'Factur-X, EN 16931, Rechnung',
            Creator: 'vincent-hellmann.com',
            Producer: 'vincent-hellmann.com',
          },
        }
      : {}),
  })

  schriftenSetzen(doc)

  // Einmal an der Quelle geradeziehen statt an jeder der dreißig Textstellen
  const textRoh = doc.text.bind(doc)
  ;(doc as unknown as { text: (...a: unknown[]) => unknown }).text = (...a: unknown[]) =>
    (textRoh as (...b: unknown[]) => unknown)(
      typeof a[0] === 'string' ? pdfText(a[0]) : a[0],
      ...a.slice(1),
    )

  const teile: Buffer[] = []
  doc.on('data', (t: Buffer) => teile.push(t))
  const fertig = new Promise<Buffer>((auf) => doc.on('end', () => auf(Buffer.concat(teile))))

  const links = LINKS
  const rechts = RECHTS
  const datum = daten.datum ? new Date(daten.datum) : new Date()

  const fussZeichnen = fusszeile(doc, company)

  const cortenStrich = briefkopf(doc, company)

  const istAngebot = daten.art === 'angebot'
  const istStorno = daten.art === 'storno'
  doc.moveDown(1.5)
  doc.fontSize(14).text(istAngebot ? 'Angebot' : istStorno ? 'Stornorechnung' : 'Rechnung')
  cortenStrich()
  doc.fontSize(10)
  doc.text(`${istAngebot ? 'Angebotsnummer' : 'Rechnungsnummer'}: ${daten.nummer}`)
  doc.text(`${istAngebot ? 'Angebotsdatum' : 'Rechnungsdatum'}: ${datum.toLocaleDateString('de-DE')}`)
  /*
   * Der Bezug aufs Original, gleich unter der Nummer.
   *
   * Ohne ihn stünde ein Blatt mit negativen Beträgen im Ordner, und beim
   * Prüfen wäre unklar, welche Rechnung es aufhebt.
   */
  if (istStorno && daten.storniert) {
    doc.text(
      `Storniert Rechnung ${daten.storniert.nummer}${
        daten.storniert.datum
          ? ` vom ${new Date(daten.storniert.datum).toLocaleDateString('de-DE')}`
          : ''
      }`,
    )
  }
  if (istAngebot) {
    if ((daten.fassung ?? 1) > 1) {
      doc.text(`Fassung ${daten.fassung} — ersetzt die vorherige Fassung`)
    }
    if (daten.gueltigBis) {
      doc.text(`Gültig bis: ${new Date(daten.gueltigBis).toLocaleDateString('de-DE')}`)
    }
    if (daten.fertigungszeit) doc.text(`Fertigungszeit: ${daten.fertigungszeit}`)
  } else if (istStorno) {
    // Kein Zahlungsziel: Eine Stornorechnung will kein Geld, sie nimmt eine
    // Forderung zurück. Ein „Fällig am" darauf wäre eine Aufforderung.
    doc.text('Diese Rechnung hebt die oben genannte auf. Es ist nichts zu zahlen.')
  } else if (daten.faelligAm) {
    doc.text(`Fällig am: ${new Date(daten.faelligAm).toLocaleDateString('de-DE')}`)
  } else if (company?.paymentTerms) {
    doc.text(`Zahlungsziel: ${company.paymentTerms}`)
  }

  // ── Empfänger ─────────────────────────────────────────────────────────────
  doc.moveDown(1)
  doc.fontSize(10).text(istAngebot ? 'Angebot für' : 'Rechnungsempfänger')
  cortenStrich()
  if (daten.empfaenger.name) doc.text(daten.empfaenger.name)
  for (const zeile of daten.empfaenger.anschrift ?? []) if (zeile) doc.text(zeile)
  if (daten.empfaenger.email) doc.text(daten.empfaenger.email)

  // ── Positionen ────────────────────────────────────────────────────────────
  doc.moveDown(1.2)
  const spalten = { menge: 300, einzel: 345, satz: 420, netto: 465 }

  doc.fontSize(8).fillColor('#666')
  const kopfY = doc.y
  doc.text('Bezeichnung', links, kopfY, { width: spalten.menge - links - 8 })
  doc.text('Menge', spalten.menge, kopfY, { width: 40, align: 'right' })
  doc.text('Netto/Einh.', spalten.einzel, kopfY, { width: 68, align: 'right' })
  doc.text('MwSt.', spalten.satz, kopfY, { width: 38, align: 'right' })
  doc.text('Netto', spalten.netto, kopfY, { width: rechts - spalten.netto, align: 'right' })
  doc.fillColor('#000')
  doc.moveDown(0.4)
  doc.moveTo(links, doc.y).lineTo(rechts, doc.y).strokeColor('#ddd').stroke()
  doc.moveDown(0.5)

  const nachSatz = new Map<number, { netto: number; steuer: number }>()
  const buche = (satz: number, netto: number, steuer: number) => {
    const bisher = nachSatz.get(satz) ?? { netto: 0, steuer: 0 }
    nachSatz.set(satz, { netto: runden(bisher.netto + netto), steuer: runden(bisher.steuer + steuer) })
  }

  /** Kantenlänge des Vorschaubildes in Punkten — knapp zwei Zeilen hoch */
  const BILD = 30

  const zeile = (
    bezeichnung: string,
    menge: number | null,
    einzelNetto: number | null,
    satz: number,
    netto: number,
    bild?: string | null,
  ) => {
    const y = doc.y
    let textLinks = links
    if (bild) {
      try {
        doc.image(bild, links, y, { fit: [BILD, BILD] })
        textLinks = links + BILD + 8
      } catch (err) {
        // Ein fehlendes oder kaputtes Bild darf keine Rechnung aufhalten —
        // aber stillschweigend verschwinden soll es auch nicht.
        console.warn('Artikelbild nicht eingebettet:', err)
      }
    }
    doc.fontSize(9).text(bezeichnung, textLinks, y, { width: spalten.menge - textLinks - 8 })
    const ende = bild ? Math.max(doc.y, y + BILD) : doc.y
    if (menge !== null) doc.text(String(menge), spalten.menge, y, { width: 40, align: 'right' })
    if (einzelNetto !== null) {
      doc.text(euro(einzelNetto), spalten.einzel, y, { width: 68, align: 'right' })
    }
    doc.text(`${satz} %`, spalten.satz, y, { width: 38, align: 'right' })
    doc.text(euro(netto), spalten.netto, y, { width: rechts - spalten.netto, align: 'right' })
    doc.y = Math.max(ende, y + 12)
    doc.moveDown(0.25)
  }

  for (const p of daten.positionen) {
    const satz = daten.reverseCharge ? 0 : p.steuersatz
    const gesamt = p.einzelpreis * p.menge
    const { netto, steuer } = zerlege(gesamt, satz, daten.preiseSind)
    const einzel = zerlege(p.einzelpreis, satz, daten.preiseSind).netto
    buche(satz, netto, steuer)
    zeile(
      p.zusatz ? `${p.bezeichnung} (${p.zusatz})` : p.bezeichnung,
      p.menge,
      einzel,
      satz,
      netto,
      p.bild,
    )
  }

  for (const z of daten.zusatzzeilen ?? []) {
    const satz = daten.reverseCharge ? 0 : z.steuersatz
    const { netto, steuer } = zerlege(z.betrag, satz, daten.preiseSind)
    buche(satz, netto, steuer)
    zeile(z.bezeichnung, null, null, satz, netto)
  }

  // ── Summen ────────────────────────────────────────────────────────────────
  doc.moveDown(0.4)
  doc.moveTo(links, doc.y).lineTo(rechts, doc.y).strokeColor('#ddd').stroke()
  doc.moveDown(0.5)

  const summenzeile = (beschriftung: string, wert: string, fett = false) => {
    const y = doc.y
    doc.fontSize(fett ? 11 : 9)
    doc.text(beschriftung, spalten.einzel - 150, y, { width: 260, align: 'right' })
    doc.text(wert, spalten.netto, y, { width: rechts - spalten.netto, align: 'right' })
    doc.moveDown(0.35)
  }

  const vorRabatt = runden([...nachSatz.values()].reduce((s, w) => s + w.netto, 0))
  summenzeile('Summe netto', euro(vorRabatt))

  // Ein Nachlass wird anteilig auf alle Steuersätze verteilt — nur so stimmt
  // die ausgewiesene Steuer, wenn zwei Sätze im Beleg stehen. Und ausgewiesen
  // werden muss er: ein stillschweigend eingerechneter Rabatt ist auf einer
  // französischen Rechnung nicht zulässig.
  const nachlass = Math.min(Math.max(daten.rabatt?.betrag ?? 0, 0), vorRabatt)
  if (nachlass > 0) {
    summenzeile(daten.rabatt?.bezeichnung || 'Nachlass', `− ${euro(nachlass)}`)
    const anteil = vorRabatt > 0 ? (vorRabatt - nachlass) / vorRabatt : 1
    for (const [satz, werte] of nachSatz.entries()) {
      nachSatz.set(satz, {
        netto: runden(werte.netto * anteil),
        steuer: runden(werte.steuer * anteil),
      })
    }
  }

  const nettoGesamt = runden([...nachSatz.values()].reduce((s, w) => s + w.netto, 0))
  const steuerGesamt = runden([...nachSatz.values()].reduce((s, w) => s + w.steuer, 0))

  if (nachlass > 0) summenzeile('Netto nach Nachlass', euro(nettoGesamt))
  for (const [satz, werte] of [...nachSatz.entries()].sort((a, b) => a[0] - b[0])) {
    if (satz === 0 && werte.steuer === 0) continue
    summenzeile(`MwSt./TVA ${satz} % auf ${euro(werte.netto)}`, euro(werte.steuer))
  }
  summenzeile('Gesamtbetrag brutto', euro(runden(nettoGesamt + steuerGesamt)), true)

  // ── Hinweise ──────────────────────────────────────────────────────────────
  doc.moveDown(1.2)
  doc.fontSize(9).fillColor('#444')
  if (daten.reverseCharge) {
    doc.text(
      'Steuerschuldnerschaft des Leistungsempfängers — Autoliquidation, art. 283-2 du CGI.',
      links,
      doc.y,
      { width: rechts - links },
    )
    doc.moveDown(0.4)
  }
  if (daten.hinweis) {
    doc.text(daten.hinweis, links, doc.y, { width: rechts - links })
    doc.moveDown(0.4)
  }
  doc.text(
    istAngebot
      ? 'Jedes Stück entsteht einzeln in Handarbeit. Wir freuen uns auf Ihre Rückmeldung.'
      : 'Jedes Stück entsteht einzeln in Handarbeit. Vielen Dank für Ihren Auftrag.',
    links,
    doc.y,
    { width: rechts - links },
  )
  if (!istAngebot && company?.iban) {
    doc.moveDown(0.4)
    doc.text(
      `Bankverbindung: IBAN ${company.iban}${company.bic ? ` · BIC ${company.bic}` : ''}`,
      links,
      doc.y,
      { width: rechts - links },
    )

    /*
     * Der GiroCode neben der Bankverbindung.
     *
     * Eine IBAN auf Papier heißt für die Kundschaft: 22 Zeichen abtippen, und
     * jede falsche Ziffer wird zu einer Rückfrage bei uns. Derselbe Betrag als
     * QR-Code heißt: Kamera drauf, bestätigen. Bei einer Anzahlung, die vor
     * dem Fertigungsbeginn eingehen soll, ist das der Unterschied zwischen
     * „heute Abend" und „nächste Woche".
     *
     * Fehlt eine Angabe oder passt der Betrag nicht ins Format, liefert
     * `giroBild` nichts — dann steht hier eben nur die Bankverbindung. Ein
     * QR-Code mit falschem Betrag wäre schlimmer als keiner: Er sieht
     * vertrauenswürdig aus und führt zu einer Zahlung, die niemand erwartet.
     */
    const bild = await giroBild({
      empfaenger: company.legalName || company.name || 'Vincent Hellmann',
      iban: company.iban,
      bic: company.bic,
      betrag: runden(nettoGesamt + steuerGesamt),
      zweck: `Rechnung ${daten.nummer}`,
    })

    if (bild) {
      doc.moveDown(0.6)
      const oben = doc.y
      const kante = 96
      doc.image(bild, links, oben, { width: kante, height: kante })
      doc
        .fontSize(8)
        .fillColor('#444')
        .text(
          'Zahlen ohne Abtippen: Diesen Code mit der Banking-App abfotografieren — Empfänger, Betrag und Verwendungszweck stehen dann fertig da.',
          links + kante + 12,
          oben + 4,
          { width: rechts - links - kante - 12 },
        )
      doc.fontSize(9)
      // Unter dem Bild weiterschreiben, nicht neben ihm
      doc.y = Math.max(doc.y, oben + kante)
    }
  }
  // Wer zur Besteuerung nach vereinbarten Entgelten optiert hat, muss das auf
  // jeder Rechnung vermerken — sonst fehlt eine Pflichtangabe.
  if (!istAngebot && company?.vatOnDebits) {
    doc.moveDown(0.4)
    doc.fontSize(8).text("TVA acquittée d'après les débits.", links, doc.y, {
      width: rechts - links,
    })
    doc.fontSize(9)
  }
  if (!istAngebot && company?.latePaymentNote) {
    doc.moveDown(0.4)
    doc.fontSize(8).text(company.latePaymentNote, links, doc.y, { width: rechts - links })
  }

  fussZeichnen()

  if (elektronisch && daten.facturx) {
    const xml = facturXml(daten.facturx, company)
    const zeitpunkt = daten.datum ? new Date(daten.datum) : new Date()
    doc.file(Buffer.from(xml, 'utf8'), {
      name: 'factur-x.xml',
      type: 'text/xml',
      description: 'Rechnungsdaten nach EN 16931 (Factur-X BASIC)',
      creationDate: zeitpunkt,
      modifiedDate: zeitpunkt,
      // „Alternative": Die XML ist dieselbe Rechnung in maschinenlesbarer
      // Form, kein zusätzliches Beiwerk — genau das schreibt Factur-X vor.
      // PDFKit kann das, nur die mitgelieferten Typen kennen das Feld nicht.
      relationship: 'Alternative',
    } as PDFKit.Mixins.PDFAttachmentOptions & { relationship: string })
    doc.appendXML(facturxMetadaten('BASIC'))
  }

  doc.end()
  return fertig
}

/** Bestellung aus dem Shop als Rechnung — dort sind die Preise brutto. */
export async function bestellungAlsRechnung(
  order: {
    orderNumber: string
    createdAt?: string | null
    discount?: number | null
    shippingTotal?: number | null
    promotionTitle?: string | null
    deliveryMethod?: string | null
    items?:
      | {
          titleSnapshot: string
          variantTitle?: string | null
          color?: string | null
          quantity: number
          unitPrice: number
        }[]
      | null
    customer?: { name?: string | null; email?: string | null } | null
    shippingAddress?: {
      line1?: string | null
      line2?: string | null
      postalCode?: string | null
      city?: string | null
      country?: string | null
    } | null
  },
  company?: CompanyInfo,
): Promise<Buffer> {
  const satz = company?.vatRate ?? 20
  const a = order.shippingAddress
  const zusatz: { bezeichnung: string; betrag: number; steuersatz: number }[] = []
  if (order.discount) {
    zusatz.push({
      bezeichnung: `Rabatt${order.promotionTitle ? ` (${order.promotionTitle})` : ''}`,
      betrag: -order.discount,
      steuersatz: satz,
    })
  }
  if (order.shippingTotal) {
    zusatz.push({ bezeichnung: 'Versand', betrag: order.shippingTotal, steuersatz: satz })
  }

  return rechnungPdf(
    {
      nummer: order.orderNumber,
      datum: order.createdAt,
      preiseSind: 'brutto',
      empfaenger: {
        name: order.customer?.name,
        email: order.customer?.email,
        anschrift:
          order.deliveryMethod === 'pickup'
            ? []
            : [
                a?.line1 ?? '',
                a?.line2 ?? '',
                [a?.postalCode, a?.city].filter(Boolean).join(' '),
                a?.country ?? '',
              ].filter(Boolean),
      },
      positionen: (order.items ?? []).map((p) => ({
        bezeichnung: p.titleSnapshot,
        zusatz: [p.variantTitle, p.color].filter(Boolean).join(', ') || null,
        menge: p.quantity,
        einzelpreis: p.unitPrice,
        steuersatz: satz,
      })),
      zusatzzeilen: zusatz,
    },
    company,
  )
}
