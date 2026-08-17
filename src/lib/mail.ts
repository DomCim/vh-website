type OrderLike = {
  orderNumber: string
  total: number
  subtotal: number
  discount?: number | null
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

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

function orderTable(order: OrderLike): string {
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

  return `<table style="border-collapse:collapse;font-size:14px">
    ${rows}
    <tr><td colspan="3" style="border-top:1px solid #ddd;padding-top:8px"></td></tr>
    <tr><td></td><td style="padding:2px 12px 2px 0">Zwischensumme</td><td style="text-align:right">${euro(order.subtotal)}</td></tr>
    ${discountRow}
    <tr><td></td><td style="padding:6px 12px 2px 0;font-weight:bold">Gesamt</td><td style="text-align:right;font-weight:bold">${euro(order.total)}</td></tr>
  </table>`
}

function addressBlock(order: OrderLike): string {
  const a = order.shippingAddress
  if (!a) return ''
  return [order.customer?.name, a.line1, a.line2, `${a.postalCode ?? ''} ${a.city ?? ''}`, a.country]
    .filter(Boolean)
    .join('<br>')
}

export function orderConfirmationEmail(order: OrderLike) {
  return {
    to: order.customer?.email ?? '',
    subject: `Bestellbestätigung ${order.orderNumber} – Vincent Hellmann`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h1 style="font-size:18px;letter-spacing:2px;text-transform:uppercase">Vincent Hellmann</h1>
        <p>Guten Tag ${order.customer?.name ?? ''},</p>
        <p>vielen Dank für Ihre Bestellung <strong>${order.orderNumber}</strong>.
        Ihre Zahlung ist bei uns eingegangen. Wir melden uns in Kürze mit den Details zur Lieferung.</p>
        ${orderTable(order)}
        <p style="margin-top:20px"><strong>Lieferadresse</strong><br>${addressBlock(order)}</p>
        <p style="margin-top:24px">Mit freundlichen Grüßen<br>Vincent Hellmann</p>
      </div>`,
  }
}

export function orderNotificationEmail(order: OrderLike, to: string) {
  return {
    to,
    subject: `Neue Bestellung ${order.orderNumber} (${euro(order.total)})`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h2>Neue bezahlte Bestellung ${order.orderNumber}</h2>
        <p>Kunde: ${order.customer?.name ?? ''} (${order.customer?.email ?? ''})</p>
        ${orderTable(order)}
        <p style="margin-top:20px"><strong>Lieferadresse</strong><br>${addressBlock(order)}</p>
        <p>Details im Admin-Panel unter „Bestellungen".</p>
      </div>`,
  }
}

export function contactEmail(
  data: { name: string; email: string; phone?: string; message: string },
  to: string,
) {
  return {
    to,
    replyTo: data.email,
    subject: `Kontaktanfrage von ${data.name}`,
    html: `
      <div style="font-family:Helvetica,Arial,sans-serif;color:#1d1d1f;max-width:560px">
        <h2>Neue Kontaktanfrage über die Website</h2>
        <p><strong>Name:</strong> ${data.name}<br>
        <strong>E-Mail:</strong> ${data.email}<br>
        ${data.phone ? `<strong>Telefon:</strong> ${data.phone}<br>` : ''}</p>
        <p style="white-space:pre-line;border-left:3px solid #ddd;padding-left:12px">${data.message}</p>
      </div>`,
  }
}
