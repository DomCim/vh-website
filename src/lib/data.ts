import config from '@payload-config'
import { getPayload, type Where } from 'payload'

import { auswahlFuerAktion, type Aktionsregel } from './aktionspreis'
import type { Locale } from './i18n'
import { laufendeAktionen } from './promotions'

/** Payload Local API — Server-seitiger Datenzugriff */
export async function payloadClient() {
  return getPayload({ config })
}

export async function getMainCategories(locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'categories',
    where: { parent: { exists: false } },
    sort: 'order',
    locale,
    limit: 20,
    depth: 1,
  })
  return docs
}

export async function getCategoryBySlug(slug: string, locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'categories',
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  })
  return docs[0] ?? null
}

export async function getChildCategories(parentId: number | string, locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'categories',
    where: { parent: { equals: parentId } },
    sort: 'order',
    locale,
    limit: 50,
    depth: 1,
  })
  return docs
}

export async function getProductsByCategory(categoryIds: (number | string)[], locale: Locale) {
  if (categoryIds.length === 0) return []
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'products',
    where: {
      and: [{ category: { in: categoryIds } }, { available: { equals: true } }],
    },
    sort: 'order',
    locale,
    limit: 100,
    depth: 1,
  })
  return docs
}

export async function getProductBySlug(slug: string, locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    depth: 1,
  })
  return docs[0] ?? null
}

export async function getFeaturedProducts(locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'products',
    where: {
      and: [{ featured: { equals: true } }, { available: { equals: true } }],
    },
    sort: 'order',
    locale,
    limit: 8,
    depth: 1,
  })
  return docs
}

export async function getNews(locale: Locale, limit = 12) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'news',
    where: { _status: { equals: 'published' } },
    sort: '-publishedDate',
    locale,
    limit,
    depth: 1,
  })
  return docs
}

export async function getNewsBySlug(slug: string, locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'news',
    where: {
      and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }],
    },
    locale,
    limit: 1,
    depth: 1,
  })
  return docs[0] ?? null
}

/** Aktive Aktionen (Zeitraum + aktiv-Flag) */
export async function getActivePromotions(locale: Locale) {
  const payload = await payloadClient()
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
    locale,
    limit: 20,
    depth: 1,
  })
  return docs
}

export async function getProjects(locale: Locale, sector?: string) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'projects',
    where: sector ? { sector: { equals: sector } } : undefined,
    sort: 'order',
    locale,
    limit: 100,
    depth: 1,
  })
  return docs
}

export async function getProjectBySlug(slug: string, locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'projects',
    where: { slug: { equals: slug } },
    locale,
    limit: 1,
    // Tiefe 2: verknüpfte Produkte samt Kategorie und Bild für die Detailseite
    depth: 2,
  })
  return docs[0] ?? null
}

export async function getFeaturedProjects(locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'projects',
    where: { featured: { equals: true } },
    sort: 'order',
    locale,
    limit: 3,
    depth: 1,
  })
  return docs
}

export async function getFeaturedTestimonials(locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'testimonials',
    // `not_equals: true` statt `equals: false`: Stimmen aus der Zeit vor der
    // Prüfung haben gar keinen Wert im Feld und sollen sichtbar bleiben.
    where: { and: [{ featured: { equals: true } }, { pending: { not_equals: true } }] },
    locale,
    limit: 3,
    depth: 0,
  })
  return docs
}

export async function getTestimonialsForProduct(productId: number | string, locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'testimonials',
    where: { and: [{ product: { equals: productId } }, { pending: { not_equals: true } }] },
    locale,
    limit: 5,
    depth: 0,
  })
  return docs
}

export async function getAbout(locale: Locale) {
  const payload = await payloadClient()
  return payload.findGlobal({ slug: 'about', locale, depth: 1 })
}

export async function getHomepage(locale: Locale) {
  const payload = await payloadClient()
  return payload.findGlobal({ slug: 'homepage', locale, depth: 1 })
}

export async function getSiteSettings(locale: Locale) {
  const payload = await payloadClient()
  return payload.findGlobal({ slug: 'site-settings', locale, depth: 1 })
}

export async function getLegal(locale: Locale) {
  const payload = await payloadClient()
  return payload.findGlobal({ slug: 'legal', locale, depth: 0 })
}

/** URL eines Media-Dokuments (bevorzugt eine passende Größe) */
export function mediaUrl(
  media: unknown,
  size?: 'klein' | 'thumbnail' | 'card' | 'large' | 'xl',
): string | undefined {
  if (!media || typeof media !== 'object') return undefined
  const m = media as {
    url?: string
    sizes?: Record<string, { url?: string | null } | undefined>
  }
  if (size && m.sizes?.[size]?.url) return m.sizes[size]!.url ?? undefined
  return m.url
}

export function mediaAlt(media: unknown, fallback = ''): string {
  if (!media || typeof media !== 'object') return fallback
  const m = media as { alt?: string | null }
  return m.alt || fallback
}

/** Referenzen, in denen ein bestimmtes Produkt verbaut wurde */
export async function getProjectsForProduct(productId: number | string, locale: Locale) {
  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'projects',
    where: { relatedProducts: { equals: productId } },
    locale,
    limit: 6,
    depth: 1,
    sort: 'order',
  })
  return docs
}

/**
 * Die Aktionen, die gerade an den Preisen stehen sollen.
 *
 * Einmal je Seite, nicht je Kachel: Zwölf Artikel auf einer Kategorieseite
 * hießen sonst zwölf gleiche Abfragen.
 */
export async function getPreisaktionen(locale: Locale): Promise<Aktionsregel[]> {
  const payload = await payloadClient()
  return laufendeAktionen(payload, locale)
}

/**
 * Die Stücke, für die eine Aktion gilt.
 *
 * Auf der Aktionsseite stand bisher nur, worum es geht — „40 % auf alle
 * Outdoor-Möbel" —, und wer wissen wollte, welche Stücke das sind, musste
 * raten und suchen. Eine Aktion, die den Weg zur Ware nicht zeigt, verkauft
 * nichts.
 *
 * Ausgewählt wird nach derselben Regel wie im Warenkorb: über die Kategorie,
 * die am Artikel steht. Damit stehen hier genau die Stücke, die den Rabatt
 * auch wirklich bekommen — und keines mehr.
 */
export async function getProductsForPromotion(
  promotion: {
    appliesTo?: string | null
    categories?: unknown
    products?: unknown
  },
  locale: Locale,
  limit = 12,
) {
  const auswahl = auswahlFuerAktion(promotion)
  if (auswahl.art === 'keine') return []

  const payload = await payloadClient()
  const { docs } = await payload.find({
    collection: 'products',
    where: {
      and: [
        { available: { equals: true } },
        ...(auswahl.art === 'feld' ? [{ [auswahl.feld]: { in: auswahl.werte } } as Where] : []),
      ],
    },
    sort: 'order',
    locale,
    limit,
    depth: 1,
  })
  return docs
}
