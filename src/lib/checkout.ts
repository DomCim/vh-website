import type { Payload } from 'payload'

import { findBestPromotion, type PricedItem } from './promotions'

export type CheckoutItemInput = {
  productId: number | string
  variantTitle?: string
  color?: string
  quantity: number
}

export type PricedLine = {
  productId: number | string
  titleSnapshot: string
  variantTitle?: string
  color?: string
  quantity: number
  unitPrice: number
}

export type PricedCart = {
  lines: PricedLine[]
  subtotal: number
  discount: number
  total: number
  promotionTitle?: string
}

/**
 * Berechnet Preise verbindlich server-seitig aus der Datenbank —
 * Client-Angaben (außer Menge/Auswahl) werden nicht übernommen.
 */
export async function priceCart(
  payload: Payload,
  items: CheckoutItemInput[],
  promoCode?: string,
): Promise<PricedCart> {
  if (items.length === 0) throw new Error('Warenkorb ist leer')

  const lines: PricedLine[] = []
  const pricedItems: PricedItem[] = []

  for (const item of items) {
    const quantity = Math.max(1, Math.min(99, Math.floor(item.quantity)))
    const product = await payload.findByID({
      collection: 'products',
      id: item.productId,
      depth: 0,
    })

    if (!product || product.available === false || product.onRequestOnly) {
      throw new Error(`Produkt nicht bestellbar: ${item.productId}`)
    }

    let unitPrice: number | undefined
    let variantTitle: string | undefined
    if ((product.variants?.length ?? 0) > 0) {
      const variant = product.variants!.find((v) => v.title === item.variantTitle)
      if (!variant) throw new Error(`Variante nicht gefunden: ${item.variantTitle}`)
      unitPrice = variant.price
      variantTitle = variant.title
    } else {
      unitPrice = product.price ?? undefined
    }
    if (typeof unitPrice !== 'number') {
      throw new Error(`Kein Preis für Produkt: ${item.productId}`)
    }

    const color = product.colorOptions?.find((c) => c.name === item.color)?.name

    lines.push({
      productId: product.id,
      titleSnapshot: product.title,
      variantTitle,
      color,
      quantity,
      unitPrice,
    })
    pricedItems.push({
      productId: product.id,
      categoryId: typeof product.category === 'object' ? product.category?.id : product.category,
      lineTotal: unitPrice * quantity,
    })
  }

  const subtotal = Math.round(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0) * 100) / 100
  const best = await findBestPromotion(payload, pricedItems, promoCode)
  const discount = best?.discount ?? 0
  const total = Math.round(Math.max(0, subtotal - discount) * 100) / 100

  return {
    lines,
    subtotal,
    discount,
    total,
    promotionTitle: best?.promotion.title,
  }
}

/** Fortlaufende, lesbare Bestellnummer, z.B. VH-2026-0042 */
export async function nextOrderNumber(payload: Payload): Promise<string> {
  const year = new Date().getFullYear()
  const { totalDocs } = await payload.count({ collection: 'orders' })
  return `VH-${year}-${String(totalDocs + 1).padStart(4, '0')}`
}
