import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { payloadClient } from '../../../../lib/data'
import { orderConfirmationEmail, orderNotificationEmail } from '../../../../lib/mail'
import { stripeClient } from '../../../../lib/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
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
    event = stripeClient().webhooks.constructEvent(rawBody, signature, secret)
  } catch (err) {
    console.error('Stripe-Webhook: ungültige Signatur', err)
    return NextResponse.json({ error: 'invalid-signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const payload = await payloadClient()

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
        await payload.sendEmail(orderConfirmationEmail(order))
        const notify = process.env.NOTIFICATION_EMAIL
        if (notify) {
          await payload.sendEmail(orderNotificationEmail(order, notify))
        }
      } catch (err) {
        payload.logger.error({ err }, 'Bestell-E-Mails konnten nicht gesendet werden')
      }
    }
  }

  return NextResponse.json({ received: true })
}
