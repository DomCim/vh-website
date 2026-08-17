import Stripe from 'stripe'

let client: Stripe | null = null

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY ist nicht gesetzt')
  if (!client) client = new Stripe(key)
  return client
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}
