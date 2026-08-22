import { z } from 'zod'

import {
  bestaetigen,
  bestaetigungNoetig,
  db,
  fehler,
  findeNachSlug,
  type McpServer,
  ohneRueckfall,
  ok,
  sprache,
} from './helpers'

const NUR_ECHTE =
  'Nur echte Stimmen mit Einverständnis der Kundschaft eintragen — erfundene Bewertungen sind wettbewerbswidrig.'

export function registerKundenstimmen(server: McpServer) {
  // ── Kundenstimmen ─────────────────────────────────────────────────────────
  server.registerTool(
    'kundenstimmen_liste',
    {
      description:
        'Listet die Kundenstimmen mit Zitat, Name, Kontext, Sternen und zugehörigem Produkt.',
      inputSchema: { sprache, ohneRueckfall },
    },
    async ({ sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const { docs, totalDocs } = await payload.find({
        collection: 'testimonials',
        limit: 100,
        depth: 1,
        locale,
        ...(ohne ? { fallbackLocale: false as const } : {}),
      })
      return ok({
        anzahl: totalDocs,
        kundenstimmen: docs.map((t) => ({
          id: t.id,
          zitat: t.quote,
          name: t.author,
          kontext: t.context ?? null,
          sterne: t.rating ?? null,
          produkt: typeof t.product === 'object' ? t.product?.slug : (t.product ?? null),
          aufStartseite: Boolean(t.featured),
        })),
      })
    },
  )

  server.registerTool(
    'kundenstimme_lesen',
    {
      description:
        'Liest eine einzelne Kundenstimme. Mit ohneRueckfall zeigt sich, was in dieser Sprache wirklich übersetzt ist.',
      inputSchema: { id: z.number().describe('ID aus kundenstimmen_liste'), sprache, ohneRueckfall },
    },
    async ({ id, sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const t = (await payload
        .findByID({
          collection: 'testimonials',
          id,
          locale,
          depth: 1,
          ...(ohne ? { fallbackLocale: false as never } : {}),
        })
        .catch(() => null)) as Record<string, any> | null
      if (!t) return fehler(`Kundenstimme mit der Nummer ${id} nicht gefunden`)
      return ok({
        id: t.id,
        sprache: locale,
        zitat: t.quote ?? null,
        name: t.author ?? null,
        kontext: t.context ?? null,
        sterne: t.rating ?? null,
        produkt: typeof t.product === 'object' && t.product ? t.product.slug : (t.product ?? null),
        aufStartseite: Boolean(t.featured),
      })
    },
  )

  server.registerTool(
    'kundenstimme_anlegen',
    {
      description: `Legt eine Kundenstimme auf Deutsch an. ${NUR_ECHTE}`,
      inputSchema: {
        zitat: z.string().describe('Wortlaut der Kundenstimme'),
        name: z.string().describe('So wie es öffentlich stehen darf, z.B. "Familie M." oder "Stadt Naila"'),
        kontext: z.string().optional().describe('z.B. "Outdoor-Sofa OS, München"'),
        produktSlug: z.string().optional().describe('Wird dann auf der Produktseite angezeigt'),
        aufStartseite: z.boolean().optional(),
        /*
         * Die Sterne kamen später dazu und fehlten hier.
         *
         * Sie entscheiden mit darüber, ob im Google-Ergebnis eine
         * Sternebewertung erscheint — der Durchschnitt wird nur aus den
         * Stimmen gerechnet, die eine tragen. Wer eine Stimme per Assistent
         * anlegt und die Zahl nicht mitgeben kann, hat sie stillschweigend
         * unter den Tisch fallen lassen.
         */
        sterne: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe('1 bis 5, freiwillig. Weglassen, wenn die Kundschaft keine vergeben hat.'),
      },
    },
    async ({ zitat, name, kontext, produktSlug, aufStartseite, sterne }) => {
      const payload = await db()
      let produktId: number | undefined
      if (produktSlug) {
        const p = await findeNachSlug<{ id: number }>(payload, 'products', produktSlug)
        if (!p) return fehler(`Produkt "${produktSlug}" nicht gefunden`)
        produktId = p.id
      }
      const doc = await payload.create({
        collection: 'testimonials',
        locale: 'de',
        data: {
          quote: zitat,
          author: name,
          context: kontext,
          product: produktId,
          featured: aufStartseite ?? false,
          ...(sterne !== undefined && { rating: sterne }),
        },
      })
      return ok({
        ok: true,
        id: doc.id,
        hinweis: `Französisch/Englisch mit kundenstimme_aendern und sprache nachtragen. ${NUR_ECHTE}`,
      })
    },
  )

  server.registerTool(
    'kundenstimme_aendern',
    {
      description:
        'Ändert eine Kundenstimme. Mit sprache=fr/en werden Zitat und Kontext in dieser Sprache gesetzt; Name und Produktbezug gelten sprachübergreifend.',
      inputSchema: {
        id: z.number().describe('ID aus kundenstimmen_liste'),
        sprache,
        zitat: z.string().optional(),
        name: z.string().optional(),
        kontext: z.string().optional(),
        produktSlug: z.string().optional(),
        aufStartseite: z.boolean().optional(),
        sterne: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe('1 bis 5, freiwillig — siehe kundenstimme_anlegen'),
      },
    },
    async ({ id, sprache: locale, zitat, name, kontext, produktSlug, aufStartseite, sterne }) => {
      const payload = await db()
      let produktId: number | undefined
      if (produktSlug) {
        const p = await findeNachSlug<{ id: number }>(payload, 'products', produktSlug)
        if (!p) return fehler(`Produkt "${produktSlug}" nicht gefunden`)
        produktId = p.id
      }
      await payload.update({
        collection: 'testimonials',
        id,
        locale,
        data: {
          ...(zitat !== undefined && { quote: zitat }),
          ...(name !== undefined && { author: name }),
          ...(kontext !== undefined && { context: kontext }),
          ...(produktId !== undefined && { product: produktId }),
          ...(aufStartseite !== undefined && { featured: aufStartseite }),
          ...(sterne !== undefined && { rating: sterne }),
        },
      })
      return ok({ ok: true, id, sprache: locale })
    },
  )

  server.registerTool(
    'kundenstimme_loeschen',
    {
      description: 'Löscht eine Kundenstimme. Ohne bestaetigen=true nur Vorschau.',
      inputSchema: { id: z.number(), bestaetigen },
    },
    async ({ id, bestaetigen: jetzt }) => {
      const payload = await db()
      const doc = await payload
        .findByID({ collection: 'testimonials', id, depth: 0 })
        .catch(() => null)
      if (!doc) return fehler(`Kundenstimme ${id} nicht gefunden`)
      if (!jetzt) return bestaetigungNoetig({ id, name: doc.author, zitat: doc.quote })
      await payload.delete({ collection: 'testimonials', id })
      return ok({ ok: true, geloescht: doc.author })
    },
  )
}
