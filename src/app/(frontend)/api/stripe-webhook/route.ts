import { NextResponse } from 'next/server'
import type Stripe from 'stripe'

import { payloadClient } from '../../../../lib/data'
import { markOrderPaid } from '../../../../lib/orderHooks'
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

    if (order) {
      await markOrderPaid(payload, order.id, {
        stripePaymentIntentId:
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id,
      })
    }
  }

  return NextResponse.json({ received: true })
}
