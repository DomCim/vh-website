import PDFDocument from 'pdfkit'

import type { CompanyInfo } from './mail'

type RechnungsBestellung = {
  orderNumber: string
  createdAt?: string | null
  total: number
  subtotal: number
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
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Erzeugt die Rechnung als PDF. Die Preise sind Bruttopreise; die enthaltene
 * MwSt./TVA wird ausgewiesen — dieselbe Rechnung wie in den Bestellmails.
 */
export async function rechnungPdf(
  order: RechnungsBestellung,
  company?: CompanyInfo,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const teile: Buffer[] = []
  doc.on('data', (t: Buffer) => teile.push(t))
  const fertig = new Promise<Buffer>((auf) => doc.on('end', () => auf(Buffer.concat(teile))))

  const datum = order.createdAt ? new Date(order.createdAt) : new Date()

  doc.fontSize(16).text('VINCENT HELLMANN', { characterSpacing: 2 })
  doc.moveDown(0.2)
  doc.fontSize(9).fillColor('#666').text(company?.name ?? '')
  doc.fillColor('#000')

  doc.moveDown(1.5)
  doc.fontSize(14).text('Rechnung')
  doc.fontSize(10)
  doc.text(`Rechnungsnummer: ${order.orderNumber}`)
  doc.text(`Datum: ${datum.toLocaleDateString('de-DE')}`)

  doc.moveDown(1)
  doc.fontSize(10).text('Rechnungsempfänger', { underline: true })
  doc.text(order.customer?.name ?? '')
  if (order.deliveryMethod !== 'pickup' && order.shippingAddress) {
    const a = order.shippingAddress
    for (const zeile of [a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(' '), a.country]) {
      if (zeile) doc.text(zeile)
    }
  }
  if (order.customer?.email) doc.text(order.customer.email)

  doc.moveDown(1.2)
  const links = 50
  const spalteMenge = 330
  const spaltePreis = 400
  const spalteSumme = 480

  doc.fontSize(9).fillColor('#666')
  doc.text('Bezeichnung', links, doc.y, { continued: false })
  const kopfY = doc.y - 11
  doc.text('Menge', spalteMenge, kopfY)
  doc.text('Einzelpreis', spaltePreis, kopfY)
  doc.text('Summe', spalteSumme, kopfY)
  doc.fillColor('#000')
  doc.moveTo(links, doc.y + 2).lineTo(545, doc.y + 2).strokeColor('#ddd').stroke()
  doc.moveDown(0.6)

  for (const p of order.items ?? []) {
    const zusatz = [p.variantTitle, p.color].filter(Boolean).join(', ')
    const y = doc.y
    doc.fontSize(10).text(`${p.titleSnapshot}${zusatz ? ` (${zusatz})` : ''}`, links, y, {
      width: spalteMenge - links - 10,
    })
    const zeilenEnde = doc.y
    doc.text(String(p.quantity), spalteMenge, y)
    doc.text(euro(p.unitPrice), spaltePreis, y)
    doc.text(euro(p.unitPrice * p.quantity), spalteSumme, y)
    doc.y = Math.max(zeilenEnde, y + 14)
    doc.moveDown(0.2)
  }

  doc.moveDown(0.5)
  doc.moveTo(links, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke()
  doc.moveDown(0.5)

  const summe = (beschriftung: string, wert: string, fett = false) => {
    const y = doc.y
    doc.fontSize(fett ? 11 : 10).text(beschriftung, spaltePreis - 120, y, { width: 190, align: 'right' })
    doc.text(wert, spalteSumme, y, { width: 65, align: 'right' })
    doc.moveDown(0.3)
  }

  summe('Zwischensumme', euro(order.subtotal))
  if (order.discount) {
    summe(`Rabatt${order.promotionTitle ? ` (${order.promotionTitle})` : ''}`, `−${euro(order.discount)}`)
  }
  summe(
    order.deliveryMethod === 'pickup' ? 'Abholung' : 'Versand',
    order.shippingTotal ? euro(order.shippingTotal) : '0,00 €',
  )
  summe('Gesamtbetrag', euro(order.total), true)

  const satz = company?.vatRate ?? 20
  if (satz) {
    const mwst = Math.round((order.total - order.total / (1 + satz / 100)) * 100) / 100
    doc.fontSize(9).fillColor('#666')
    summe(`enthaltene MwSt./TVA (${satz} %)`, euro(mwst))
    doc.fillColor('#000')
  }

  doc.moveDown(2)
  doc.fontSize(9).fillColor('#666')
  doc.text(
    'Jedes Stück entsteht einzeln in Handarbeit. Vielen Dank für Ihren Auftrag.',
    links,
    doc.y,
    { width: 495 },
  )
  const fuss = [
    company?.name,
    company?.siret ? `SIRET: ${company.siret}` : null,
    company?.vatId ? `TVA: ${company.vatId}` : null,
  ].filter(Boolean)
  if (fuss.length) {
    doc.moveDown(0.5)
    doc.fontSize(8).text(fuss.join(' · '), links, doc.y, { width: 495 })
  }

  doc.end()
  return fertig
}
