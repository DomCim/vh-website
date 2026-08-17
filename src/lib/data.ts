import config from '@payload-config'
import { getPayload } from 'payload'

import type { Locale } from './i18n'

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
    depth: 1,
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
    where: { featured: { equals: true } },
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
    where: { product: { equals: productId } },
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
  size?: 'thumbnail' | 'card' | 'large',
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
