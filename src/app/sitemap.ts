import type { MetadataRoute } from 'next'

import { bildQuellen, type BildQuelle } from '../components/Bild'
import { adressenAllerSprachen } from '../lib/adressen'
import { payloadClient } from '../lib/data'
import { defaultLocale, type Locale, locales } from '../lib/i18n'
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

/**
 * Ein Eintrag je Sprache, wenn jede ihre eigene Adresse hat.
 *
 * `entries` setzt denselben Pfad für alle drei Sprachen — richtig, solange die
 * Adresse überall gleich lautet. Für Artikel und Kategorien gilt das nicht
 * mehr: Dort kann die französische Fassung `canape-os` heißen, wo die deutsche
 * `outdoor-sofa-os` heißt. Stünde hier der deutsche Pfad unter `/fr/`, meldete
 * die Search Console lauter Fehler — und die französische Seite fehlte im
 * Index.
 */
function eintraegeJeSprache(
  pfade: Record<Locale, string>,
  lastModified?: string | Date,
  priority = 0.7,
  images?: string[],
): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(locales.map((l) => [l, `${BASE}/${l}${pfade[l]}`]))
  return locales.map((l) => ({
    url: `${BASE}/${l}${pfade[l]}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    alternates: { languages },
    priority,
    ...(images?.length ? { images } : {}),
  }))
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
    // Über alle Sprachen, damit die eigenen Adressen mitkommen
    payload.find({ collection: 'categories', limit: 200, depth: 0, locale: 'all' as never }),
    payload.find({
      collection: 'products',
      // Interne Artikel existieren nach außen nicht — siehe Products.intern
      where: { and: [{ available: { equals: true } }, { intern: { not_equals: true } }] },
      limit: 500,
      depth: 1,
      locale: 'all' as never,
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
    // Die Übersicht über das ganze Sortiment — zugleich erste Station in
    // jedem Brotkrumen (siehe [locale]/kollektion/page.tsx)
    ...entries('/kollektion', undefined, 0.8),
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

  /*
   * Die Adressen der Kategorien einmal je Sprache — die Artikel darunter
   * brauchen sie für ihren eigenen Pfad.
   */
  const kategorieAdressen = new Map<string, Record<Locale, string>>()
  for (const c of categories.docs) {
    const pfade = adressenAllerSprachen(c as unknown as Record<string, unknown>)
    kategorieAdressen.set(String(c.id), pfade)
    result.push(
      ...eintraegeJeSprache(
        Object.fromEntries(locales.map((l) => [l, `/${pfade[l]}`])) as Record<Locale, string>,
        c.updatedAt,
        0.8,
      ),
    )
  }

  for (const p of products.docs) {
    const kategorieId = typeof p.category === 'object' ? p.category?.id : p.category
    const katPfade = kategorieId ? kategorieAdressen.get(String(kategorieId)) : undefined
    if (!katPfade) continue
    const artikelPfade = adressenAllerSprachen(p as unknown as Record<string, unknown>)
    result.push(
      ...eintraegeJeSprache(
        Object.fromEntries(locales.map((l) => [l, `/${katPfade[l]}/${artikelPfade[l]}`])) as Record<
          Locale,
          string
        >,
        p.updatedAt,
        0.9,
        bilder(p.images),
      ),
    )
  }
  for (const n of news.docs) {
    result.push(...entries(`/news/${n.slug}`, n.updatedAt, 0.6, bilder(n.coverImage)))
  }

  return result
}
