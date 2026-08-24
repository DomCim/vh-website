import type { Payload } from 'payload'

import { naechsteBestellnummer } from './nummernkreis'

import { findBestPromotion, type PricedItem } from './promotions'
import { versandJeStueck, versandzonen, zoneFuer, type Zone } from './versand'

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
  /** Versandkosten pro Stück (0 bei versandkostenfrei, Abholung oder digitaler Ware) */
  shippingCost: number
  /** Wird als Download geliefert — kein Versand, keine Anschrift */
  digital?: boolean
}

export type PricedCart = {
  lines: PricedLine[]
  subtotal: number
  discount: number
  shippingTotal: number
  total: number
  promotionTitle?: string
  deliveryMethod: DeliveryMethod
  /** Nur Dateien im Korb — dann braucht es weder Anschrift noch Versandart */
  nurDigital: boolean
  /** Die Zone, nach der gerechnet wurde — null bei Abholung, digital oder ohne Land */
  zone: Zone | null
}

/**
 * Was für Ware im Korb liegt — beantwortet, bevor gerechnet wird.
 *
 * Die Kasse muss zwei Dinge früh wissen, und zwar bevor sie nach einer
 * Anschrift verlangt: Ob überhaupt etwas verschickt werden muss, und ob etwas
 * dabei ist, das sofort geliefert wird. Das sind zwei verschiedene Fragen —
 * ein Bauplan neben einem Tisch braucht beides: die Anschrift für den Tisch
 * und die Einwilligung für den Bauplan.
 */
export async function wareImKorb(
  payload: Payload,
  items: CheckoutItemInput[],
): Promise<{ hatDigitales: boolean; nurDigital: boolean }> {
  const ids = [...new Set(items.map((i) => i.productId))]
  if (ids.length === 0) return { hatDigitales: false, nurDigital: false }

  const { docs } = await payload.find({
    collection: 'products',
    where: { id: { in: ids } },
    limit: ids.length,
    depth: 0,
    overrideAccess: true,
  })

  /*
   * Ein Artikel, den es nicht gibt, zählt hier als nicht digital. Ihn
   * abzuweisen ist nicht die Aufgabe dieser Stelle — das tut `priceCart`
   * gleich danach, mit einer Meldung, die den Artikel benennt.
   */
  const digital = new Set(docs.filter((d) => d.digital).map((d) => String(d.id)))
  const alle = items.map((i) => String(i.productId))
  return {
    hatDigitales: alle.some((id) => digital.has(id)),
    nurDigital: alle.length > 0 && alle.every((id) => digital.has(id)),
  }
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
  land?: string,
): Promise<PricedCart> {
  if (items.length === 0) throw new Error('Warenkorb ist leer')

  /*
   * Die Zone bestimmt den Aufschlag je Stück.
   *
   * Bei Abholung wird gar nicht erst gefragt — dort fällt der Versand
   * ohnehin weg, und ein Land wäre eine Angabe ohne Wirkung. Kommt ein Land
   * herein, in das nicht geliefert wird, ist das ein Abbruch und keine
   * stille Null: Sonst zahlte jemand den Inlandssatz nach Neuseeland.
   */
  const zonen = deliveryMethod === 'pickup' ? [] : await versandzonen(payload)
  let zone: Zone | null = null
  if (deliveryMethod === 'shipping' && land) {
    zone = zoneFuer(zonen, land)
    if (!zone) throw new Error(`Dorthin wird nicht geliefert: ${land}`)
  }

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
      /*
       * Eine Datei wird nicht verschickt. Stünde hier der Versand des
       * Artikels, zahlte jemand Fracht für einen Download — und beim
       * gemischten Korb fiele es niemandem auf, weil dort ohnehin Versand
       * steht.
       */
      shippingCost:
        product.digital || deliveryMethod === 'pickup'
          ? 0
          : versandJeStueck(product.shippingCost, zone),
      digital: product.digital || undefined,
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
    nurDigital: lines.every((l) => l.digital),
    zone,
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
