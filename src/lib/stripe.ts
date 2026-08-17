import type { Payload } from 'payload'
import Stripe from 'stripe'

import { getIntegrations } from './settings'

/**
 * Stripe-Client mit dem im Admin hinterlegten Secret Key
 * (Fallback: STRIPE_SECRET_KEY aus der Umgebung).
 */
export async function stripeClient(payload: Payload): Promise<Stripe> {
  const { stripe } = await getIntegrations(payload)
  if (!stripe.secretKey) {
    throw new Error('Stripe ist nicht konfiguriert (Admin → Integrationen → Stripe)')
  }
  return new Stripe(stripe.secretKey)
}

export async function stripeWebhookSecret(payload: Payload): Promise<string | undefined> {
  const { stripe } = await getIntegrations(payload)
  return stripe.webhookSecret
}
