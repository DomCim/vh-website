import type { CollectionAfterChangeHook, Payload } from 'payload'

import { orderConfirmationEmail, orderNotificationEmail, orderShippedEmail } from './mail'
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
    await sendMail(payload, orderConfirmationEmail(order))
    const { email } = await getIntegrations(payload)
    if (email.notificationEmail) {
      await sendMail(payload, orderNotificationEmail(order, email.notificationEmail))
    }
  } catch (err) {
    payload.logger.error({ err }, 'Bestell-E-Mails konnten nicht gesendet werden')
  }
}

/**
 * afterChange-Hook: Wenn eine Bestellung auf „versendet" wechselt,
 * bekommt der Kunde automatisch eine Versandbestätigung — inklusive
 * Trackingnummer/-link, falls im Admin eingetragen.
 */
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
