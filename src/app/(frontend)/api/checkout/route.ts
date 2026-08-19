import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'

import {
  priceCart,
  nextOrderNumber,
  type CheckoutItemInput,
  type DeliveryMethod,
} from '../../../../lib/checkout'
import { payloadClient } from '../../../../lib/data'
import { isLocale, type Locale } from '../../../../lib/i18n'
import { createPayPalOrder, paypalConfig } from '../../../../lib/paypal'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'
import { stripeClient } from '../../../../lib/stripe'

export const dynamic = 'force-dynamic'

type CheckoutBody = {
  items: CheckoutItemInput[]
  promoCode?: string
  locale?: string
  deliveryMethod?: DeliveryMethod
  paymentMethod?: 'stripe' | 'paypal'
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
  consent?: { terms?: boolean; waiver?: boolean }
}

export async function POST(req: Request) {
  try {
    // Jede Kasse legt eine Bestellung an und ruft Stripe bzw. PayPal — ohne
    // Bremse ließe sich damit die Nummernreihe zumüllen.
    if (zuVieleAnfragen(`kasse:${ipAus(req)}`, 20, 10 * 60_000)) {
      return NextResponse.json({ error: 'too-many-requests' }, { status: 429 })
    }

    const body = (await req.json()) as CheckoutBody
    const locale: Locale = body.locale && isLocale(body.locale) ? body.locale : 'de'

    const deliveryMethod: DeliveryMethod = body.deliveryMethod === 'pickup' ? 'pickup' : 'shipping'

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'empty-cart' }, { status: 400 })
    }
    if (!body.customer?.name || !body.customer?.email) {
      return NextResponse.json({ error: 'missing-fields' }, { status: 400 })
    }
    const paymentMethodEarly = body.paymentMethod === 'paypal' ? 'paypal' : 'stripe'
    const hasProvidedAddress = Boolean(
      body.shippingAddress?.line1 && body.shippingAddress?.postalCode && body.shippingAddress?.city,
    )
    // Lieferadresse ist Pflicht bei Lieferung — außer bei PayPal,
    // dort kommt sie aus dem PayPal-Konto (sofern keine abweichende angegeben ist)
    if (deliveryMethod === 'shipping' && paymentMethodEarly !== 'paypal' && !hasProvidedAddress) {
      return NextResponse.json({ error: 'missing-address' }, { status: 400 })
    }

    const payload = await payloadClient()
    const cart = await priceCart(payload, body.items, body.promoCode, deliveryMethod)
    const orderNumber = await nextOrderNumber(payload)
    const paymentMethod = body.paymentMethod === 'paypal' ? 'paypal' : 'stripe'

    // Bestellung als "offen" anlegen — bezahlt wird sie erst per Webhook
    const order = await payload.create({
      collection: 'orders',
      overrideAccess: true,
      data: {
        orderNumber,
        accessToken: randomUUID(),
        status: 'pending',
        paymentProvider: paymentMethod,
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
          deliveryMethod === 'shipping' && hasProvidedAddress
            ? {
                line1: body.shippingAddress?.line1,
                line2: body.shippingAddress?.line2,
                postalCode: body.shippingAddress?.postalCode,
                city: body.shippingAddress?.city,
                country: body.shippingAddress?.country,
              }
            : undefined,
        customerNote: body.note,
        // Zeitpunkt statt bloßem Haken: „hat zugestimmt" ohne Datum ist im
        // Zweifel nichts wert.
        consent: {
          termsAt: body.consent?.terms ? new Date().toISOString() : undefined,
          waiver: Boolean(body.consent?.waiver),
        },
      },
    })

    const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

    // ── PayPal ────────────────────────────────────────────────────────────
    if (paymentMethod === 'paypal') {
      const cfg = await paypalConfig(payload)
      if (!cfg) {
        return NextResponse.json({ error: 'paypal-not-configured' }, { status: 500 })
      }
      // PayPal hängt ?token=<order-id> selbst an die Return-URL an
      const countryToCode: Record<string, string> = {
        deutschland: 'DE', germany: 'DE', allemagne: 'DE',
        frankreich: 'FR', france: 'FR',
        österreich: 'AT', austria: 'AT', autriche: 'AT',
        schweiz: 'CH', switzerland: 'CH', suisse: 'CH',
      }
      const paypalOrder = await createPayPalOrder(cfg, {
        amountEUR: cart.total,
        orderNumber,
        returnUrl: `${serverURL}/${locale}/bestellung/danke`,
        cancelUrl: `${serverURL}/${locale}/kasse?cancelled=1`,
        shippingMode:
          deliveryMethod === 'pickup' ? 'none' : hasProvidedAddress ? 'provided' : 'paypal',
        providedAddress: hasProvidedAddress
          ? {
              name: body.customer.name,
              line1: body.shippingAddress?.line1,
              line2: body.shippingAddress?.line2,
              postalCode: body.shippingAddress?.postalCode,
              city: body.shippingAddress?.city,
              countryCode:
                countryToCode[(body.shippingAddress?.country || '').trim().toLowerCase()] || 'DE',
            }
          : undefined,
      })
      await payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: { paypalOrderId: paypalOrder.id },
      })
      return NextResponse.json({ url: paypalOrder.approveUrl })
    }

    // ── Stripe ────────────────────────────────────────────────────────────
    const stripe = await stripeClient(payload)

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

    const shippingLabel =
      locale === 'fr' ? 'Livraison' : locale === 'en' ? 'Delivery' : 'Lieferung'
    const pickupLabel =
      locale === 'fr' ? 'Retrait sur place' : locale === 'en' ? 'Pickup' : 'Abholung'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      locale: locale === 'fr' ? 'fr' : locale === 'en' ? 'en' : 'de',
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

    /*
     * „Bitte versuchen Sie es erneut" ist die falsche Auskunft, wenn Wiederholen
     * gar nicht helfen kann. Ist die Bezahlung nicht eingerichtet, scheitert
     * jeder weitere Versuch genauso — und die Kundschaft probiert es dreimal,
     * gibt auf und schreibt keine Mail.
     *
     * Was sie sieht, bleibt trotzdem allgemein: Wie der Betrieb seine Zahlungen
     * abwickelt und was davon fehlt, geht Fremde nichts an. Der Grund steht im
     * Protokoll, dort gehört er hin.
     */
    const text = err instanceof Error ? err.message : ''
    if (/nicht konfiguriert|not configured/i.test(text)) {
      return NextResponse.json({ error: 'zahlung-nicht-eingerichtet' }, { status: 503 })
    }

    return NextResponse.json({ error: 'checkout-failed' }, { status: 500 })
  }
}
