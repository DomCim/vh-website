import { z } from 'zod'

import {
  db,
  fehler,
  findeNachSlug,
  freierSlug,
  type McpServer,
  ohneRueckfall,
  ok,
  sprache,
} from './helpers'

export function registerKategorien(server: McpServer) {
  // ── Kategorien ────────────────────────────────────────────────────────────
  server.registerTool(
    'kategorien_liste',
    {
      description:
        'Listet alle Kategorien der Navigation samt Unterkategorien und Reihenfolge.',
      inputSchema: { sprache, ohneRueckfall },
    },
    async ({ sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const { docs } = await payload.find({
        collection: 'categories',
        sort: 'order',
        limit: 200,
        depth: 1,
        locale,
        ...(ohne ? { fallbackLocale: false as const } : {}),
      })
      const eintrag = (c: (typeof docs)[number]) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        beschreibung: c.description ?? null,
        reihenfolge: c.order ?? 0,
      })
      const haupt = docs.filter((c) => !c.parent)
      return ok({
        anzahl: docs.length,
        kategorien: haupt.map((c) => ({
          ...eintrag(c),
          unterkategorien: docs
            .filter((k) => (typeof k.parent === 'object' ? k.parent?.id : k.parent) === c.id)
            .map(eintrag),
        })),
      })
    },
  )

  server.registerTool(
    'kategorie_anlegen',
    {
      description:
        'Legt eine Kategorie auf Deutsch an. Achtung: Kategorien sind Menüpunkte der Website. Slug weglassen = aus dem Namen erzeugt.',
      inputSchema: {
        name: z.string(),
        slug: z.string().optional(),
        beschreibung: z.string().optional(),
        uebergeordneteKategorieSlug: z.string().optional().describe('macht daraus eine Unterkategorie'),
        bildId: z.number().optional().describe('Titelbild (Media-ID)'),
        reihenfolge: z.number().optional(),
      },
    },
    async ({ name, slug, beschreibung, uebergeordneteKategorieSlug, bildId, reihenfolge }) => {
      const payload = await db()
      let parentId: number | undefined
      if (uebergeordneteKategorieSlug) {
        const parent = await findeNachSlug<{ id: number }>(
          payload,
          'categories',
          uebergeordneteKategorieSlug,
        )
        if (!parent) return fehler(`Kategorie "${uebergeordneteKategorieSlug}" nicht gefunden`)
        parentId = parent.id
      }
      const doc = await payload.create({
        collection: 'categories',
        locale: 'de',
        data: {
          name,
          slug: slug || (await freierSlug(payload, 'categories', name)),
          description: beschreibung,
          parent: parentId,
          image: bildId,
          order: reihenfolge ?? 0,
        },
      })
      return ok({
        ok: true,
        id: doc.id,
        slug: doc.slug,
        hinweis: "Französisch/Englisch mit kategorie_aendern und sprache nachtragen.",
      })
    },
  )

  server.registerTool(
    'kategorie_aendern',
    {
      description:
        'Ändert eine Kategorie. Mit sprache=fr/en werden Name und Beschreibung in dieser Sprache gesetzt.',
      inputSchema: {
        slug: z.string(),
        sprache,
        name: z.string().optional(),
        beschreibung: z.string().optional(),
        bildId: z.number().optional(),
        reihenfolge: z.number().optional(),
      },
    },
    async ({ slug, sprache: locale, name, beschreibung, bildId, reihenfolge }) => {
      const payload = await db()
      const kat = await findeNachSlug<{ id: number }>(payload, 'categories', slug)
      if (!kat) return fehler(`Kategorie "${slug}" nicht gefunden`)
      await payload.update({
        collection: 'categories',
        id: kat.id,
        locale,
        data: {
          ...(name !== undefined && { name }),
          ...(beschreibung !== undefined && { description: beschreibung }),
          ...(bildId !== undefined && { image: bildId }),
          ...(reihenfolge !== undefined && { order: reihenfolge }),
        },
      })
      return ok({ ok: true, slug, sprache: locale })
    },
  )
}
