import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { payloadClient } from '../../../../lib/data'
import { orderConfirmationEmail, orderNotificationEmail } from '../../../../lib/mail'
import { sendMail } from '../../../../lib/sendMail'
import { getIntegrations } from '../../../../lib/settings'
import { stripeClient, stripeWebhookSecret } from '../../../../lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const payload = await payloadClient()

  const secret = await stripeWebhookSecret(payload)
  if (!secret) {
    return NextResponse.json({ error: 'webhook-not-configured' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'missing-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    const rawBody = await req.text()
    const stripe = await stripeClient(payload)
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error('Stripe-Webhook: ungültige Signatur', err)
    return NextResponse.json({ error: 'invalid-signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    const { docs } = await payload.find({
      collection: 'orders',
      where: { stripeSessionId: { equals: session.id } },
      overrideAccess: true,
      limit: 1,
      depth: 0,
    })
    const order = docs[0]

    if (order && order.status === 'pending') {
      await payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: {
          status: 'paid',
          stripePaymentIntentId:
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent?.id,
        },
      })

      // Bestätigung an Kunde + interne Benachrichtigung (Fehler blockieren den Webhook nicht)
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
  }

  return NextResponse.json({ received: true })
}
