import { z } from 'zod'

import {
  bestaetigen,
  bestaetigungNoetig,
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
    'kategorie_lesen',
    {
      description:
        'Liest eine Kategorie samt Beschreibung, übergeordneter Kategorie, Unterkategorien und der Zahl der Artikel darin. Vor kategorie_aendern oder kategorie_loeschen aufrufen.',
      inputSchema: { slug: z.string(), sprache, ohneRueckfall },
    },
    async ({ slug, sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const kat = await findeNachSlug<Record<string, unknown>>(payload, 'categories', slug, {
        locale,
        depth: 1,
        ...(ohne ? { fallbackLocale: false as never } : {}),
      })
      if (!kat) return fehler(`Kategorie "${slug}" nicht gefunden`)

      const [artikel, unter] = await Promise.all([
        payload.count({
          collection: 'products',
          where: { category: { equals: kat.id } },
          overrideAccess: true,
        }),
        payload.find({
          collection: 'categories',
          where: { parent: { equals: kat.id } },
          locale,
          depth: 0,
          limit: 50,
          sort: 'order',
          overrideAccess: true,
        }),
      ])

      const eltern = kat.parent
      return ok({
        id: kat.id,
        slug,
        sprache: locale,
        name: kat.name ?? null,
        beschreibung: kat.description ?? null,
        reihenfolge: kat.order ?? 0,
        uebergeordnet:
          typeof eltern === 'object' && eltern
            ? { slug: (eltern as { slug?: string }).slug, name: (eltern as { name?: string }).name }
            : null,
        unterkategorien: unter.docs.map((u) => ({ slug: u.slug, name: u.name })),
        // Sagt vor dem Löschen, ob überhaupt gelöscht werden kann
        artikelDarin: artikel.totalDocs,
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

  server.registerTool(
    'kategorie_loeschen',
    {
      description:
        'Löscht eine Kategorie endgültig. Ohne bestaetigen=true wird nur angezeigt, was passieren würde. Eine Kategorie mit Artikeln wird nicht gelöscht — die Artikel zuerst umhängen.',
      inputSchema: { slug: z.string(), bestaetigen },
    },
    async ({ slug, bestaetigen: jetzt }) => {
      const payload = await db()
      const kat = await findeNachSlug<{ id: number; name?: string | null }>(
        payload,
        'categories',
        slug,
        { depth: 0 },
      )
      if (!kat) return fehler(`Kategorie "${slug}" nicht gefunden`)

      const artikel = await payload.find({
        collection: 'products',
        where: { category: { equals: kat.id } },
        limit: 5,
        depth: 0,
        overrideAccess: true,
      })
      const unter = await payload.find({
        collection: 'categories',
        where: { parent: { equals: kat.id } },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      })

      /*
       * Die Vorschau nennt beides, weil es sich verschieden verhält: Artikel
       * verhindern das Löschen (siehe collections/Categories.ts), eine
       * Unterkategorie nicht — sie rückt eine Ebene nach oben und steht dann
       * plötzlich in der Hauptnavigation. Das ist selten gewollt und darum
       * einen Satz wert, bevor jemand bestätigt.
       */
      const uebersicht = {
        id: kat.id,
        name: kat.name ?? slug,
        slug,
        artikelDarin: artikel.totalDocs,
        beispiele: artikel.docs.map((a) => (a as { title?: string }).title).filter(Boolean),
        unterkategorien: unter.docs.map((u) => (u as { name?: string }).name).filter(Boolean),
        hinweis:
          artikel.totalDocs > 0
            ? 'Diese Kategorie wird nicht gelöscht, solange Artikel darin liegen. Die Artikel zuerst über produkt_aendern mit kategorieSlug umhängen.'
            : unter.docs.length
              ? 'Die Unterkategorien bleiben bestehen und rücken in die oberste Ebene.'
              : 'Die Kategorie ist leer. Ihre Adresse antwortet danach mit 404 — bei einer Seite, die Google kennt, ist das gewollt und erledigt sich von selbst.',
      }

      if (!jetzt) return bestaetigungNoetig(uebersicht)

      if (artikel.totalDocs > 0) {
        return fehler(
          `In „${uebersicht.name}" liegen noch ${artikel.totalDocs} Artikel. ` +
            'Erst umhängen, dann löschen — ein Artikel ohne Kategorie taucht in keiner Übersicht mehr auf.',
        )
      }

      await payload.delete({ collection: 'categories', id: kat.id })
      return ok({ ok: true, geloescht: uebersicht.name, slug })
    },
  )
}
