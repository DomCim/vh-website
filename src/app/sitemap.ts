import type { MetadataRoute } from 'next'

import { bildQuellen, type BildQuelle } from '../components/Bild'
import { payloadClient } from '../lib/data'
import { defaultLocale, locales } from '../lib/i18n'
import { oeffentlicheTermine } from '../lib/kalender/oeffentlich'
import { absoluteUrl } from '../lib/seo'

export const dynamic = 'force-dynamic'

const BASE = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

/**
 * Die Bilder einer Seite für die Sitemap.
 *
 * **Warum Bilder überhaupt in die Sitemap gehören.** Ein Betrieb, dessen Ware
 * man ansieht und dann haben will, wird über die Bildersuche gefunden — und
 * die findet nur, was ihr genannt wird. Ein Foto, das erst beim Ausführen von
 * JavaScript im Karussell auftaucht, sieht der Suchdienst sonst nie.
 *
 * **Der Zuschnitt, nicht das Original** — dieselbe Überlegung wie im
 * Merchant-Feed: `large` hat die volle Auflösung bei einem Bruchteil der
 * Größe, und Google lädt jedes genannte Bild wieder und wieder.
 */
function bilder(quelle: unknown): string[] {
  const liste = Array.isArray(quelle) ? quelle : quelle ? [quelle] : []
  return liste
    .map((b) => {
      const zuschnitt = bildQuellen(b as BildQuelle, 'large')?.src
      return absoluteUrl(zuschnitt ?? (typeof b === 'object' ? (b as { url?: string })?.url : undefined))
    })
    .filter((u): u is string => Boolean(u))
}

/** Ein Eintrag pro Sprache inkl. hreflang-Alternates */
function entries(
  path: string,
  lastModified?: string | Date,
  priority = 0.7,
  images?: string[],
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [l, `${BASE}/${l}${path}`]))
  return locales.map((l) => ({
    url: `${BASE}/${l}${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: { languages },
    priority,
    ...(images?.length ? { images } : {}),
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await payloadClient()

  const [categories, products, news, projects, termine] = await Promise.all([
    payload.find({ collection: 'categories', limit: 200, depth: 0 }),
    payload.find({
      collection: 'products',
      // Interne Artikel existieren nach außen nicht — siehe Products.intern
      where: { and: [{ available: { equals: true } }, { intern: { not_equals: true } }] },
      limit: 500,
      depth: 1,
    }),
    payload.find({
      collection: 'news',
      where: { _status: { equals: 'published' } },
      limit: 500,
      // Tiefe 1, damit Titelbild und Projektbilder mit ihren Zuschnitten
      // dabei sind — sie stehen als Bilder mit in der Sitemap.
      depth: 1,
    }),
    payload.find({ collection: 'projects', limit: 500, depth: 1 }),
    /*
     * Ob es kommende Termine gibt.
     *
     * Die Terminseite verschwindet, wenn keine anstehen (siehe
     * `[locale]/termine/page.tsx`). Sie darf dann auch hier nicht stehen —
     * eine Adresse in der Sitemap, die mit 404 antwortet, meldet die Search
     * Console als Fehler, und zwar fuer jede der drei Sprachen.
     */
    oeffentlicheTermine(payload, defaultLocale, 1),
  ])

  const result: MetadataRoute.Sitemap = [
    ...entries('', undefined, 1),
    ...entries('/news', undefined, 0.8),
    ...entries('/projekte', undefined, 0.7),
    ...entries('/ueber-uns', undefined, 0.6),
    ...entries('/aktionen', undefined, 0.6),
    ...entries('/massanfertigung', undefined, 0.7),
    ...entries('/faq', undefined, 0.6),
    ...entries('/kontakt', undefined, 0.5),
    ...(termine.length > 0 ? entries('/termine', undefined, 0.7) : []),
  ]

  for (const p of projects.docs) {
    result.push(...entries(`/projekte/${p.slug}`, p.updatedAt, 0.6, bilder(p.images)))
  }

  for (const c of categories.docs) {
    result.push(...entries(`/${c.slug}`, c.updatedAt, 0.8))
  }
  for (const p of products.docs) {
    const categorySlug = typeof p.category === 'object' ? p.category?.slug : undefined
    if (categorySlug) {
      result.push(...entries(`/${categorySlug}/${p.slug}`, p.updatedAt, 0.9, bilder(p.images)))
    }
  }
  for (const n of news.docs) {
    result.push(...entries(`/news/${n.slug}`, n.updatedAt, 0.6, bilder(n.coverImage)))
  }

  return result
}
