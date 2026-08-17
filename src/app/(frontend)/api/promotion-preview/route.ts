import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { priceCart, type CheckoutItemInput } from '../../../../lib/checkout'

export const dynamic = 'force-dynamic'

/** Rabatt-Vorschau für den Warenkorb (unverbindlich, Anzeige only) */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { items?: CheckoutItemInput[]; code?: string }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ valid: false })
    }

    const payload = await payloadClient()
    const cart = await priceCart(payload, body.items, body.code)

    return NextResponse.json({
      valid: cart.discount > 0,
      title: cart.promotionTitle,
      discount: cart.discount,
    })
  } catch {
    return NextResponse.json({ valid: false })
  }
}
