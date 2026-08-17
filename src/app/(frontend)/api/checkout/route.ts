import { NextResponse } from 'next/server'

import {
  priceCart,
  nextOrderNumber,
  type CheckoutItemInput,
  type DeliveryMethod,
} from '../../../../lib/checkout'
import { payloadClient } from '../../../../lib/data'
import { isLocale, type Locale } from '../../../../lib/i18n'
import { stripeClient } from '../../../../lib/stripe'

export const dynamic = 'force-dynamic'

type CheckoutBody = {
  items: CheckoutItemInput[]
  promoCode?: string
  locale?: string
  deliveryMethod?: DeliveryMethod
  customer: {
    name: string
    email: string
    phone?: string
  }
  shippingAddress?: {
    line1?: string
    line2?: string
    postalCode?: string
    city?: string
    country?: string
  }
  note?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CheckoutBody
    const locale: Locale = body.locale && isLocale(body.locale) ? body.locale : 'de'

    const deliveryMethod: DeliveryMethod = body.deliveryMethod === 'pickup' ? 'pickup' : 'shipping'

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'empty-cart' }, { status: 400 })
    }
    if (!body.customer?.name || !body.customer?.email) {
      return NextResponse.json({ error: 'missing-fields' }, { status: 400 })
    }
    // Lieferadresse nur bei Lieferung Pflicht — bei Abholung reicht der Kontakt
    if (
      deliveryMethod === 'shipping' &&
      (!body.shippingAddress?.line1 || !body.shippingAddress?.postalCode || !body.shippingAddress?.city)
    ) {
      return NextResponse.json({ error: 'missing-address' }, { status: 400 })
    }

    const payload = await payloadClient()
    const cart = await priceCart(payload, body.items, body.promoCode, deliveryMethod)
    const orderNumber = await nextOrderNumber(payload)

    // Bestellung als "offen" anlegen — bezahlt wird sie erst per Webhook
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber,
        status: 'pending',
        items: cart.lines.map((l) => ({
          product: typeof l.productId === 'string' ? Number(l.productId) : l.productId,
          titleSnapshot: l.titleSnapshot,
          variantTitle: l.variantTitle,
          color: l.color,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        subtotal: cart.subtotal,
        discount: cart.discount,
        shippingTotal: cart.shippingTotal,
        total: cart.total,
        promotionTitle: cart.promotionTitle,
        deliveryMethod,
        customer: {
          name: body.customer.name,
          email: body.customer.email,
          phone: body.customer.phone,
        },
        shippingAddress:
          deliveryMethod === 'shipping'
            ? {
                line1: body.shippingAddress?.line1,
                line2: body.shippingAddress?.line2,
                postalCode: body.shippingAddress?.postalCode,
                city: body.shippingAddress?.city,
                country: body.shippingAddress?.country,
              }
            : undefined,
        customerNote: body.note,
      },
    })

    const stripe = await stripeClient(payload)
    const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    // Rabatt als einmaliger Stripe-Coupon
    let discounts: { coupon: string }[] | undefined
    if (cart.discount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(cart.discount * 100),
        currency: 'eur',
        duration: 'once',
        name: cart.promotionTitle || 'Rabatt',
      })
      discounts = [{ coupon: coupon.id }]
    }

    const shippingLabel = locale === 'fr' ? 'Livraison' : 'Lieferung'
    const pickupLabel = locale === 'fr' ? 'Retrait sur place' : 'Abholung'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: locale === 'fr' ? 'fr' : 'de',
      customer_email: body.customer.email,
      line_items: [
        ...cart.lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency: 'eur',
            unit_amount: Math.round(l.unitPrice * 100),
            product_data: {
              name: [l.titleSnapshot, l.variantTitle, l.color].filter(Boolean).join(' – '),
            },
          },
        })),
        // Versandkosten als eigene Positionen je Artikel
        ...cart.lines
          .filter((l) => l.shippingCost > 0)
          .map((l) => ({
            quantity: l.quantity,
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(l.shippingCost * 100),
              product_data: {
                name: `${shippingLabel}: ${l.titleSnapshot}`,
              },
            },
          })),
        // Abholung als 0-€-Position, damit sie auf der Stripe-Seite sichtbar ist
        ...(deliveryMethod === 'pickup'
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: 'eur',
                  unit_amount: 0,
                  product_data: { name: pickupLabel },
                },
              },
            ]
          : []),
      ],
      discounts,
      metadata: {
        orderId: String(order.id),
        orderNumber,
      },
      success_url: `${serverURL}/${locale}/bestellung/danke?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${serverURL}/${locale}/kasse?cancelled=1`,
    })

    await payload.update({
      collection: 'orders',
      id: order.id,
      overrideAccess: true,
      data: { stripeSessionId: session.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Checkout fehlgeschlagen:', err)
    return NextResponse.json({ error: 'checkout-failed' }, { status: 500 })
  }
}
