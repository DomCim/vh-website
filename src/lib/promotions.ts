import type { Payload } from 'payload'

type PromotionDoc = {
  id: number | string
  title: string
  discountType: 'percent' | 'fixed'
  discountValue: number
  appliesTo: 'all' | 'categories' | 'products'
  categories?: ({ id: number | string } | number | string)[] | null
  products?: ({ id: number | string } | number | string)[] | null
  code?: string | null
}

export type PricedItem = {
  productId: number | string
  categoryId?: number | string
  lineTotal: number
}

function relIds(rels?: ({ id: number | string } | number | string)[] | null): string[] {
  return (rels ?? []).map((r) => String(typeof r === 'object' ? r.id : r))
}

/** Summe der Positionen, auf die eine Aktion anwendbar ist */
function applicableAmount(promo: PromotionDoc, items: PricedItem[]): number {
  if (promo.appliesTo === 'all') {
    return items.reduce((sum, i) => sum + i.lineTotal, 0)
  }
  if (promo.appliesTo === 'categories') {
    const ids = relIds(promo.categories)
    return items
      .filter((i) => i.categoryId !== undefined && ids.includes(String(i.categoryId)))
      .reduce((sum, i) => sum + i.lineTotal, 0)
  }
  const ids = relIds(promo.products)
  return items
    .filter((i) => ids.includes(String(i.productId)))
    .reduce((sum, i) => sum + i.lineTotal, 0)
}

function discountFor(promo: PromotionDoc, amount: number): number {
  if (amount <= 0) return 0
  const value =
    promo.discountType === 'percent' ? (amount * promo.discountValue) / 100 : promo.discountValue
  return Math.min(Math.round(value * 100) / 100, amount)
}

/**
 * Ermittelt die beste anwendbare Aktion für einen Warenkorb.
 * Aktionen ohne Code gelten automatisch; Aktionen mit Code nur bei passender Eingabe.
 * Es wird genau eine Aktion angewendet (die mit dem höchsten Rabatt).
 */
export async function findBestPromotion(
  payload: Payload,
  items: PricedItem[],
  code?: string,
): Promise<{ promotion: PromotionDoc; discount: number } | null> {
  const now = new Date().toISOString()
  const { docs } = await payload.find({
    collection: 'promotions',
    where: {
      and: [
        { active: { equals: true } },
        { startDate: { less_than_equal: now } },
        { endDate: { greater_than_equal: now } },
      ],
    },
    limit: 100,
    depth: 0,
  })

  const normalizedCode = code?.trim().toUpperCase()

  let best: { promotion: PromotionDoc; discount: number } | null = null
  for (const doc of docs as unknown as PromotionDoc[]) {
    const promoCode = doc.code?.trim().toUpperCase()
    if (promoCode && promoCode !== normalizedCode) continue

    const discount = discountFor(doc, applicableAmount(doc, items))
    if (discount > 0 && (!best || discount > best.discount)) {
      best = { promotion: doc, discount }
    }
  }
  return best
}
