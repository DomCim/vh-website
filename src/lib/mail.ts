type OrderLike = {
  orderNumber: string
  total: number
  subtotal: number
  discount?: number | null
  shippingTotal?: number | null
  deliveryMethod?: string | null
  trackingNumber?: string | null
  trackingUrl?: string | null
  accessToken?: string | null
  expectedReady?: string | null
  promotionTitle?: string | null
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

export type CompanyInfo = {
  name?: string | null
  siret?: string | null
  vatId?: string | null
  vatRate?: number | null
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/** Enthaltene MwSt./TVA aus dem Bruttobetrag herausrechnen */
function vatRow(order: OrderLike, company?: CompanyInfo): string {
  const rate = company?.vatRate ?? 20
  if (!rate) return ''
  const vat = Math.round((order.total - order.total / (1 + rate / 100)) * 100) / 100
  return `<tr><td></td><td style="padding:2px 12px 2px 0;color:#666;font-size:12px">enthaltene MwSt./TVA (${rate} %)</td><td style="text-align:right;color:#666;font-size:12px">${euro(vat)}</td></tr>`
}

/** Pflichtangaben-Fußzeile (SIRET, TVA-Nr.) für Bestell-Mails */
function companyFooter(company?: CompanyInfo): string {
  if (!company) return ''
  const parts = [
    company.name,
    company.siret ? `SIRET: ${company.siret}` : null,
    company.vatId ? `TVA: ${company.vatId}` : null,
  ].filter(Boolean)
  if (parts.length === 0) return ''
  return `<p style="margin-top:28px;border-top:1px solid #eee;padding-top:10px;color:#999;font-size:11px">${parts.join(' · ')}</p>`
}

function orderTable(order: OrderLike, company?: CompanyInfo): string {
  const rows = (order.items ?? [])
    .map((item) => {
      const label = [item.titleSnapshot, item.variantTitle, item.color].filter(Boolean).join(' – ')
      return `<tr>
        <td style="padding:6px 12px 6px 0">${item.quantity}×</td>
        <td style="padding:6px 12px 6px 0">${label}</td>
        <td style="padding:6px 0;text-align:right">${euro(item.unitPrice * item.quantity)}</td>
      </tr>`
    })
    .join('')

  const discountRow =
    order.discount && order.discount > 0
      ? `<tr><td></td><td style="padding:6px 12px 6px 0">Rabatt${order.promotionTitle ? ` (${order.promotionTitle})` : ''}</td><td style="text-align:right">−${euro(order.discount)}</td></tr>`
      : ''

  const shippingRow =
    order.shippingTotal && order.shippingTotal > 0
      ? `<tr><td></td><td style="padding:2px 12px 2px 0">Versand</td><td style="text-align:right">${euro(order.shippingTotal)}</td></tr>`
      : ''

  return `<table style="border-collapse:collapse;font-size:14px">
    ${rows}
    <tr><td colspan="3" style="border-top:1px solid #ddd;padding-top:8px"></td></tr>
    <tr><td></td><td style="padding:2px 12px 2px 0">Zwischensumme</td><td style="text-align:right">${euro(order.subtotal)}</td></tr>
    ${discountRow}
    ${shippingRow}
    <tr><td></td><td style="padding:6px 12px 2px 0;font-weight:bold">Gesamt</td><td style="text-align:right;font-weight:bold">${euro(order.total)}</td></tr>
    ${vatRow(order, company)}
  </table>`
}

function addressBlock(order: OrderLike): string {
  if (order.deliveryMethod === 'pickup') {
    return 'Abholung — Adresse und Termin werden nach der Bestellung abgestimmt.'
  }
  const a = order.shippingAddress
  if (!a) return ''
  return [order.customer?.name, a.line1, a.line2, `${a.postalCode ?? ''} ${a.city ?? ''}`, a.country]
    .filter(Boolean)
    .join('<br>')
}

/** Link auf die Bestellstatus-Seite — dauerhaft gültig, verbraucht nichts */
function statusLink(order: OrderLike): string {
  if (!order.accessToken) return ''
  const basis = process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || ''
  const url = `${basis}/de/bestellung/${order.accessToken}`
  return `<p style="margin-top:20px"><a href="${url}" style="color:#1d1d1f">Stand Ihrer Bestellung ansehen</a></p>`
}

/** Hinweis auf die Einzelfertigung, wenn ein Zeitraum bekannt ist */
function fertigungsHinweis(order: OrderLike, hinweis?: string | null): string {
  const teile = [
    hinweis?.trim()
      ? `<p style="color:#666;font-size:13px">${hinweis.trim()}</p>`
      : '',
    order.expectedReady
      ? `<p><strong>Voraussichtlich fertig:</strong> ${order.expectedReady}</p>`
      : '',
  ].filter(Boolean)
  return teile.join('')
}

export function orderConfirmationEmail(
  order: OrderLike,
  company?: CompanyInfo,
  craftNotice?: string | null,
) {
  return {
    to: order.customer?.email ?? '',
    subject: `Bestellbestätigung ${order.orderNumber} – Vincent Hellmann`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h1 style="font-size:18px;letter-spacing:2px;text-transform:uppercase">Vincent Hellmann</h1>
        <p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>vielen Dank für Ihre Bestellung <strong>${order.orderNumber}</strong>.
        Ihre Zahlung ist bei uns eingegangen. Ihr Stück wird jetzt für Sie gefertigt — wir melden uns,
        sobald es in die Werkstatt geht.</p>
        ${fertigungsHinweis(order, craftNotice)}
        ${orderTable(order, company)}
        <p style="margin-top:20px"><strong>${order.deliveryMethod === 'pickup' ? 'Abholung' : 'Lieferadresse'}</strong><br>${addressBlock(order)}</p>
        ${statusLink(order)}
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>
        ${companyFooter(company)}
      </div>`,
  }
}

export function orderNotificationEmail(order: OrderLike, to: string, company?: CompanyInfo) {
  return {
    to,
    subject: `Neue Bestellung ${order.orderNumber} (${euro(order.total)})`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h2>Neue bezahlte Bestellung ${order.orderNumber}</h2>
        <p>Kunde: ${order.customer?.name ?? ''} (${order.customer?.email ?? ''})</p>
        ${orderTable(order, company)}
        <p style="margin-top:20px"><strong>${order.deliveryMethod === 'pickup' ? 'Abholung' : 'Lieferadresse'}</strong><br>${addressBlock(order)}</p>
        <p>Details im Admin-Panel unter „Bestellungen".</p>
      </div>`,
  }
}

export function orderInProductionEmail(order: OrderLike, craftNotice?: string | null) {
  return {
    to: order.customer?.email ?? '',
    subject: `Ihre Bestellung ${order.orderNumber} ist in Fertigung – Vincent Hellmann`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h1 style="font-size:18px;letter-spacing:2px;text-transform:uppercase">Vincent Hellmann</h1>
        <p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>Ihre Bestellung <strong>${order.orderNumber}</strong> ist in der Werkstatt und wird jetzt
        gefertigt. Sobald sie unterwegs ist, bekommen Sie die Sendungsnummer von uns.</p>
        ${fertigungsHinweis(order, craftNotice)}
        ${statusLink(order)}
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>
      </div>`,
  }
}

export function orderShippedEmail(order: OrderLike) {
  const tracking = order.trackingNumber
    ? `<p><strong>Sendungsverfolgung:</strong> ${
        order.trackingUrl
          ? `<a href="${order.trackingUrl}">${order.trackingNumber}</a>`
          : order.trackingNumber
      }</p>`
    : ''
  return {
    to: order.customer?.email ?? '',
    subject: `Ihre Bestellung ${order.orderNumber} ist unterwegs – Vincent Hellmann`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h1 style="font-size:18px;letter-spacing:2px;text-transform:uppercase">Vincent Hellmann</h1>
        <p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>gute Nachrichten: Ihre Bestellung <strong>${order.orderNumber}</strong> wurde soeben versendet.</p>
        ${tracking}
        <p style="margin-top:20px"><strong>Lieferadresse</strong><br>${addressBlock(order)}</p>
        ${statusLink(order)}
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>
      </div>`,
  }
}

export function contactEmail(
  data: {
    name: string
    email: string
    phone?: string
    message: string
    productTitle?: string
    productUrl?: string
  },
  to: string,
) {
  const isProductInquiry = Boolean(data.productTitle)
  return {
    to,
    replyTo: data.email,
    subject: isProductInquiry
      ? `Produktanfrage: ${data.productTitle} (von ${data.name})`
      : `Kontaktanfrage von ${data.name}`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h2>${isProductInquiry ? 'Neue Produktanfrage über die Website' : 'Neue Kontaktanfrage über die Website'}</h2>
        ${
          isProductInquiry
            ? `<p><strong>Produkt:</strong> ${data.productTitle}${data.productUrl ? ` — <a href="${data.productUrl}">${data.productUrl}</a>` : ''}</p>`
            : ''
        }
        <p><strong>Name:</strong> ${data.name}<br>
        <strong>E-Mail:</strong> ${data.email}<br>
        ${data.phone ? `<strong>Telefon:</strong> ${data.phone}<br>` : ''}</p>
        <p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px">${data.message}</p>
      </div>`,
  }
}
