import type { Payload } from 'payload'

import type { Locale } from './i18n'

export type Treffer = {
  bereich: 'produkt' | 'referenz' | 'news' | 'kategorie' | 'kundenstimme'
  titel: string
  text: string | null
  url: string
  bildId?: number | null
}

export type SuchBereich = Treffer['bereich']

export const ALLE_BEREICHE: SuchBereich[] = [
  'produkt',
  'referenz',
  'news',
  'kategorie',
  'kundenstimme',
]

const bildId = (wert: unknown): number | null => {
  const erstes = Array.isArray(wert) ? wert[0] : wert
  if (!erstes) return null
  return typeof erstes === 'object' ? ((erstes as { id?: number }).id ?? null) : (erstes as number)
}

/**
 * Volltextsuche über die öffentlichen Inhalte. Wird sowohl von der
 * Website-Suche als auch vom MCP-Werkzeug "suchen" benutzt.
 */
export async function suche(
  payload: Payload,
  begriff: string,
  locale: Locale,
  bereiche: SuchBereich[] = ALLE_BEREICHE,
  proBereich = 10,
): Promise<Treffer[]> {
  const q = begriff.trim()
  if (!q) return []
  const treffer: Treffer[] = []
  const will = (b: SuchBereich) => bereiche.includes(b)

  if (will('produkt')) {
    const { docs } = await payload.find({
      collection: 'products',
      where: {
        or: [{ title: { contains: q } }, { shortDescription: { contains: q } }],
      },
      limit: proBereich,
      depth: 1,
      locale,
    })
    for (const p of docs) {
      const kat = typeof p.category === 'object' ? p.category?.slug : p.category
      treffer.push({
        bereich: 'produkt',
        titel: p.title,
        text: p.shortDescription ?? null,
        url: `/${locale}/${kat}/${p.slug}`,
        bildId: bildId(p.images),
      })
    }
  }

  if (will('referenz')) {
    const { docs } = await payload.find({
      collection: 'projects',
      where: { or: [{ title: { contains: q } }, { summary: { contains: q } }, { client: { contains: q } }] },
      limit: proBereich,
      depth: 1,
      locale,
    })
    for (const p of docs) {
      treffer.push({
        bereich: 'referenz',
        titel: p.title,
        text: p.summary ?? null,
        url: `/${locale}/projekte/${p.slug}`,
        bildId: bildId(p.images),
      })
    }
  }

  if (will('news')) {
    const { docs } = await payload.find({
      collection: 'news',
      where: {
        and: [
          { _status: { equals: 'published' } },
          { or: [{ title: { contains: q } }, { excerpt: { contains: q } }] },
        ],
      },
      limit: proBereich,
      depth: 1,
      locale,
    })
    for (const n of docs) {
      treffer.push({
        bereich: 'news',
        titel: n.title,
        text: n.excerpt ?? null,
        url: `/${locale}/news/${n.slug}`,
        bildId: bildId(n.coverImage),
      })
    }
  }

  if (will('kategorie')) {
    const { docs } = await payload.find({
      collection: 'categories',
      where: { or: [{ name: { contains: q } }, { description: { contains: q } }] },
      limit: proBereich,
      depth: 0,
      locale,
    })
    for (const c of docs) {
      treffer.push({
        bereich: 'kategorie',
        titel: c.name,
        text: c.description ?? null,
        url: `/${locale}/${c.slug}`,
      })
    }
  }

  if (will('kundenstimme')) {
    const { docs } = await payload.find({
      collection: 'testimonials',
      where: { or: [{ quote: { contains: q } }, { author: { contains: q } }] },
      limit: proBereich,
      depth: 0,
      locale,
    })
    for (const t of docs) {
      treffer.push({
        bereich: 'kundenstimme',
        titel: t.author,
        text: t.quote,
        url: `/${locale}`,
      })
    }
  }

  return treffer
}
