import type { CollectionAfterChangeHook, Payload } from 'payload'

import { rechnungPdf } from './invoice'
import {
  orderConfirmationEmail,
  orderInProductionEmail,
  orderNotificationEmail,
  orderShippedEmail,
} from './mail'
import { sendMail } from './sendMail'
import { getIntegrations } from './settings'

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
    const company = {
      name: settings?.siteName,
      siret: settings?.company?.siret,
      vatId: settings?.company?.vatId,
      vatRate: settings?.company?.vatRate,
    }
    const craftNotice = settings?.craft?.notice ?? null

    // Rechnung als PDF anhängen — schlägt das fehl, geht die Mail trotzdem raus
    let anhang: { filename: string; content: Buffer; contentType: string }[] | undefined
    try {
      anhang = [
        {
          filename: `Rechnung-${order.orderNumber}.pdf`,
          content: await rechnungPdf(order, company),
          contentType: 'application/pdf',
        },
      ]
    } catch (err) {
      payload.logger.error({ err }, `Rechnung für ${order.orderNumber} konnte nicht erzeugt werden`)
    }

    await sendMail(payload, {
      ...orderConfirmationEmail(order, company, craftNotice),
      attachments: anhang,
    })
    const { email } = await getIntegrations(payload)
    if (email.notificationEmail) {
      await sendMail(payload, orderNotificationEmail(order, email.notificationEmail, company))
    }
  } catch (err) {
    payload.logger.error({ err }, 'Bestell-E-Mails konnten nicht gesendet werden')
  }

  await werkstattStueckeAusbuchen(payload, order)
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
    await sendMail(req.payload, orderInProductionEmail(doc, settings?.craft?.notice ?? null))
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
  if (doc.deliveryMethod === 'pickup') return doc
  if (!doc.customer?.email) return doc

  try {
    await sendMail(req.payload, orderShippedEmail(doc))
    req.payload.logger.info(`Versandbestätigung für ${doc.orderNumber} gesendet`)
  } catch (err) {
    req.payload.logger.error({ err }, `Versandbestätigung für ${doc.orderNumber} fehlgeschlagen`)
  }

  return doc
}
