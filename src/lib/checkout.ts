import type { Payload } from 'payload'

import { naechsteBestellnummer } from './nummernkreis'

import { findBestPromotion, type PricedItem } from './promotions'

export type CheckoutItemInput = {
  productId: number | string
  /** Kennung der Variantenzeile — der verlässliche Weg */
  variantId?: string
  variantTitle?: string
  color?: string
  quantity: number
}

export type DeliveryMethod = 'shipping' | 'pickup'

export type PricedLine = {
  productId: number | string
  titleSnapshot: string
  variantId?: string
  variantTitle?: string
  color?: string
  quantity: number
  unitPrice: number
  /** Versandkosten pro Stück (0 bei versandkostenfrei oder Abholung) */
  shippingCost: number
}

export type PricedCart = {
  lines: PricedLine[]
  subtotal: number
  discount: number
  shippingTotal: number
  total: number
  promotionTitle?: string
  deliveryMethod: DeliveryMethod
}

/**
 * Berechnet Preise verbindlich server-seitig aus der Datenbank —
 * Client-Angaben (außer Menge/Auswahl) werden nicht übernommen.
 */
export async function priceCart(
  payload: Payload,
  items: CheckoutItemInput[],
  promoCode?: string,
  deliveryMethod: DeliveryMethod = 'shipping',
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
    let variantId: string | undefined
    if ((product.variants?.length ?? 0) > 0) {
      /*
       * Erst über die Kennung, dann über die Bezeichnung.
       *
       * Die Bezeichnung ist übersetzt: Wer auf Französisch bestellt, schickt
       * den französischen Namen — und der Artikel wird hier in der Sprache des
       * Hauses geladen. Über die Kennung ist das gleichgültig.
       */
      const variant =
        (item.variantId && product.variants!.find((v) => v.id === item.variantId)) ||
        product.variants!.find((v) => v.title === item.variantTitle)
      if (!variant) throw new Error(`Variante nicht gefunden: ${item.variantTitle}`)
      unitPrice = variant.price
      variantTitle = variant.title
      variantId = variant.id ?? undefined
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
      variantId,
      variantTitle,
      color,
      quantity,
      unitPrice,
      shippingCost: deliveryMethod === 'pickup' ? 0 : (product.shippingCost ?? 0),
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
  const shippingTotal =
    Math.round(lines.reduce((s, l) => s + l.shippingCost * l.quantity, 0) * 100) / 100
  const total = Math.round(Math.max(0, subtotal - discount + shippingTotal) * 100) / 100

  return {
    lines,
    subtotal,
    discount,
    shippingTotal,
    total,
    promotionTitle: best?.promotion.title,
    deliveryMethod,
  }
}

/**
 * Fortlaufende, lesbare Bestellnummer, z.B. VH-2026-0042.
 *
 * Läuft über einen eigenen Zähler statt über die Anzahl der Bestellungen:
 * Beim Zählen bekäme nach dem Löschen einer Bestellung die nächste dieselbe
 * Nummer noch einmal — für die Buchhaltung ein ernstes Problem.
 */
export async function nextOrderNumber(payload: Payload): Promise<string> {
  return naechsteBestellnummer(payload)
}
