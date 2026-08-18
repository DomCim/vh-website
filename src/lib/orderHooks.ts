import type { CollectionAfterChangeHook, Payload } from 'payload'

import { bestellungAlsRechnung } from './invoice'
import {
  orderConfirmationEmail,
  orderInProductionEmail,
  orderNotificationEmail,
  orderShippedEmail,
} from './mail'
import { bedarfFuerBestellung } from './material'
import { benachrichtige } from './push'
import { sendMail } from './sendMail'
import { firmenAngaben, getIntegrations } from './settings'

/**
 * Markiert eine Bestellung als bezahlt und verschickt Bestätigungs- und
 * Benachrichtigungs-Mail. Gemeinsam genutzt von Stripe-Webhook und
 * PayPal-Capture; idempotent (nur pending-Bestellungen werden umgestellt).
 */
export async function markOrderPaid(
  payload: Payload,
  orderId: number | string,
  data: { stripePaymentIntentId?: string; paypalCaptureId?: string } = {},
): Promise<void> {
  const order = await payload.findByID({
    collection: 'orders',
    id: orderId,
    overrideAccess: true,
    depth: 0,
  })
  if (!order || order.status !== 'pending') return

  await payload.update({
    collection: 'orders',
    id: orderId,
    overrideAccess: true,
    data: { status: 'paid', ...data },
    context: { skipShippedMail: true },
  })

  try {
    const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
    const company = firmenAngaben(settings)
    const craftNotice = settings?.craft?.notice ?? null

    // Rechnung als PDF anhängen — schlägt das fehl, geht die Mail trotzdem raus
    let anhang: { filename: string; content: Buffer; contentType: string }[] | undefined
    try {
      anhang = [
        {
          filename: `Rechnung-${order.orderNumber}.pdf`,
          content: await bestellungAlsRechnung(order, company),
          contentType: 'application/pdf',
        },
      ]
    } catch (err) {
      payload.logger.error({ err }, `Rechnung für ${order.orderNumber} konnte nicht erzeugt werden`)
    }

    await sendMail(payload, {
      ...orderConfirmationEmail(order, company, craftNotice),
      attachments: anhang,
      art: 'bestellung',
      bezug: { order: order.id },
    })
    const { email } = await getIntegrations(payload)
    if (email.notificationEmail) {
      await sendMail(payload, {
        ...orderNotificationEmail(order, email.notificationEmail, company),
        art: 'bestellung',
        bezug: { order: order.id },
      })
    }
  } catch (err) {
    payload.logger.error({ err }, 'Bestell-E-Mails konnten nicht gesendet werden')
  }

  await werkstattStueckeAusbuchen(payload, order)
  await auftragAusBestellung(payload, order)

  // Meldung aufs Handy — Vincent steht meist in der Werkstatt, nicht am Rechner
  await benachrichtige(payload, {
    titel: 'Neue Bestellung',
    text: `${order.orderNumber} über ${new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(order.total ?? 0)}`,
    url: `/office/bestellungen/${order.id}`,
    tag: `bestellung-${order.id}`,
  }).catch(() => undefined)
}

/**
 * Legt zu einer bezahlten Shop-Bestellung einen Fertigungsauftrag an.
 *
 * Für den Shop braucht es kein Angebot — der Preis steht auf der Website.
 * Der Auftrag entsteht deshalb automatisch, damit der Durchlauf durch die
 * Werkstatt an derselben Stelle steht wie beim Projektgeschäft.
 *
 * Fertige Werkstattstücke bekommen keinen Auftrag: Die liegen schon da.
 */
async function auftragAusBestellung(
  payload: Payload,
  order: {
    id: number | string
    orderNumber: string
    customer?: { name?: string | null } | null
    items?:
      | {
          product?: unknown
          titleSnapshot: string
          variantTitle?: string | null
          color?: string | null
          quantity: number
          unitPrice: number
        }[]
      | null
  },
): Promise<void> {
  try {
    const { totalDocs } = await payload.count({
      collection: 'jobs',
      where: { order: { equals: order.id } },
      overrideAccess: true,
    })
    if (totalDocs > 0) return

    // Nur, was wirklich gefertigt werden muss
    const zuFertigen: typeof order.items = []
    for (const pos of order.items ?? []) {
      const produktId = typeof pos.product === 'object' ? (pos.product as { id?: number })?.id : pos.product
      if (typeof produktId !== 'number') {
        zuFertigen.push(pos)
        continue
      }
      const produkt = await payload
        .findByID({ collection: 'products', id: produktId, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!produkt?.readyMade) zuFertigen.push(pos)
    }
    if (!zuFertigen.length) return

    // Material aus den Stücklisten vorbelegen — damit steht sofort da, was
    // gebraucht wird und ob es im Haus ist
    const bedarf = await bedarfFuerBestellung(payload, { items: zuFertigen })

    const auftrag = await payload.create({
      collection: 'jobs',
      overrideAccess: true,
      data: {
        title: `Bestellung ${order.orderNumber}`,
        status: 'geplant',
        source: 'shop',
        customerName: order.customer?.name ?? undefined,
        order: order.id as number,
        positions: zuFertigen.map((p) => ({
          description: [p.titleSnapshot, p.variantTitle, p.color].filter(Boolean).join(' · '),
          quantity: p.quantity,
          price: p.unitPrice,
        })),
        material: bedarf.map((b) => ({ item: b.itemId, quantity: b.benoetigt })),
      },
    })
    payload.logger.info(`Auftrag ${auftrag.jobNumber} aus Bestellung ${order.orderNumber} angelegt`)

    const fehlt = bedarf.filter((b) => b.fehlt > 0)
    if (fehlt.length) {
      payload.logger.warn(
        `Auftrag ${auftrag.jobNumber}: Material fehlt — ${fehlt
          .map((f) => `${f.name} (${f.fehlt} ${f.einheit})`)
          .join(', ')}`,
      )
    }
  } catch (err) {
    payload.logger.error({ err }, `Auftrag zu Bestellung ${order.orderNumber} nicht angelegt`)
  }
}

/**
 * „Aus der Werkstatt"-Stücke stehen fertig da und gibt es nur einmal —
 * nach dem Verkauf werden sie ausgeblendet. Auf Auftragsfertigung wirkt das
 * ausdrücklich nicht: dort wird jedes Stück ohnehin neu gefertigt.
 */
async function werkstattStueckeAusbuchen(
  payload: Payload,
  order: { items?: { product?: unknown }[] | null },
): Promise<void> {
  const ids = (order.items ?? [])
    .map((i) => (typeof i.product === 'object' ? (i.product as { id?: number })?.id : i.product))
    .filter((id): id is number => typeof id === 'number')
  if (!ids.length) return

  try {
    const { docs } = await payload.find({
      collection: 'products',
      where: { and: [{ id: { in: ids } }, { readyMade: { equals: true } }] },
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    for (const p of docs) {
      await payload.update({
        collection: 'products',
        id: p.id,
        overrideAccess: true,
        data: { available: false },
      })
      payload.logger.info(`Werkstattstück "${p.title}" nach Verkauf ausgeblendet`)
    }
  } catch (err) {
    payload.logger.error({ err }, 'Werkstattstücke konnten nicht ausgebucht werden')
  }
}

/**
 * afterChange-Hook: Wenn eine Bestellung auf „versendet" wechselt,
 * bekommt der Kunde automatisch eine Versandbestätigung — inklusive
 * Trackingnummer/-link, falls im Admin eingetragen.
 */
/**
 * afterChange-Hook: Meldet dem Kunden, dass sein Stück in Fertigung ist.
 * Ohne Serienfertigung ist das die längste Wartephase — vorher hörte der
 * Kunde zwischen Zahlung und Versand gar nichts.
 */
export const notifyOnProduction: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc
  if (doc.status !== 'inProduction' || previousDoc?.status === 'inProduction') return doc
  if (!doc.customer?.email) return doc

  try {
    const settings = await req.payload.findGlobal({ slug: 'site-settings', depth: 0 })
    await sendMail(req.payload, {
      ...orderInProductionEmail(doc, settings?.craft?.notice ?? null),
      art: 'fertigung',
      bezug: { order: doc.id },
    })
    req.payload.logger.info(`Fertigungs-Mail für ${doc.orderNumber} gesendet`)
  } catch (err) {
    req.payload.logger.error({ err }, `Fertigungs-Mail für ${doc.orderNumber} fehlgeschlagen`)
  }

  return doc
}

export const notifyOnShipped: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context?.skipShippedMail) return doc
  if (operation !== 'update') return doc
  if (doc.status !== 'shipped' || previousDoc?.status === 'shipped') return doc

  // Wann das Stück raus ist, entscheidet später darüber, wann wir um eine
  // Kundenstimme bitten — direkt nach dem Kauf wäre es zu früh.
  if (!doc.shippedAt) {
    await req.payload
      .update({
        collection: 'orders',
        id: doc.id,
        overrideAccess: true,
        context: { skipShippedMail: true },
        data: { shippedAt: new Date().toISOString() },
      })
      .catch(() => undefined)
  }

  if (doc.deliveryMethod === 'pickup') return doc
  if (!doc.customer?.email) return doc

  try {
    await sendMail(req.payload, {
      ...orderShippedEmail(doc),
      art: 'versand',
      bezug: { order: doc.id },
    })
    req.payload.logger.info(`Versandbestätigung für ${doc.orderNumber} gesendet`)
  } catch (err) {
    req.payload.logger.error({ err }, `Versandbestätigung für ${doc.orderNumber} fehlgeschlagen`)
  }

  return doc
}
