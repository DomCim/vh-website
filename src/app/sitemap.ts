import type { MetadataRoute } from 'next'

import { payloadClient } from '../lib/data'
import { locales } from '../lib/i18n'

export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/** Ein Eintrag pro Sprache inkl. hreflang-Alternates */
function entries(
  path: string,
  lastModified?: string | Date,
  priority = 0.7,
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [l, `${BASE}/${l}${path}`]))
  return locales.map((l) => ({
    url: `${BASE}/${l}${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: { languages },
    priority,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await payloadClient()

  const [categories, products, news, projects] = await Promise.all([
    payload.find({ collection: 'categories', limit: 200, depth: 0 }),
    payload.find({
      collection: 'products',
      where: { available: { equals: true } },
      limit: 500,
      depth: 1,
    }),
    payload.find({
      collection: 'news',
      where: { _status: { equals: 'published' } },
      limit: 500,
      depth: 0,
    }),
    payload.find({ collection: 'projects', limit: 500, depth: 0 }),
  ])

  const result: MetadataRoute.Sitemap = [
    ...entries('', undefined, 1),
    ...entries('/news', undefined, 0.8),
    ...entries('/projekte', undefined, 0.7),
    ...entries('/ueber-uns', undefined, 0.6),
    ...entries('/aktionen', undefined, 0.6),
    ...entries('/massanfertigung', undefined, 0.7),
    ...entries('/kontakt', undefined, 0.5),
  ]

  for (const p of projects.docs) {
    result.push(...entries(`/projekte/${p.slug}`, p.updatedAt, 0.6))
  }

  for (const c of categories.docs) {
    result.push(...entries(`/${c.slug}`, c.updatedAt, 0.8))
  }
  for (const p of products.docs) {
    const categorySlug = typeof p.category === 'object' ? p.category?.slug : undefined
    if (categorySlug) result.push(...entries(`/${categorySlug}/${p.slug}`, p.updatedAt, 0.9))
  }
  for (const n of news.docs) {
    result.push(...entries(`/news/${n.slug}`, n.updatedAt, 0.6))
  }

  return result
}
