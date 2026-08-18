import type { Where } from 'payload'
import { z } from 'zod'

import { richText } from '../richtext'
import {
  bestaetigen,
  bestaetigungNoetig,
  db,
  fehler,
  findeNachSlug,
  type McpServer,
  ohneRueckfall,
  ok,
  resolveIds,
  richTextZuText,
  sprache,
} from './helpers'

const bereich = z.enum(['kommunal', 'gewerbe', 'privat'])

export function registerReferenzen(server: McpServer) {
  // ── Referenzen (Projekte) ─────────────────────────────────────────────────
  server.registerTool(
    'referenzen_liste',
    {
      description:
        'Listet die Referenz-Projekte (Kommunen, Gewerbe, Privat) mit Bereich, Jahr und Auftraggeber.',
      inputSchema: {
        bereich: bereich.optional().describe('Filter: kommunal, gewerbe oder privat'),
        suche: z.string().optional().describe('Suchbegriff im Titel'),
        sprache,
      },
    },
    async ({ bereich: sektor, suche, sprache: locale }) => {
      const payload = await db()
      const where: Where[] = []
      if (sektor) where.push({ sector: { equals: sektor } })
      if (suche) where.push({ title: { contains: suche } })
      const { docs, totalDocs } = await payload.find({
        collection: 'projects',
        where: where.length ? { and: where } : undefined,
        sort: 'order',
        limit: 50,
        depth: 1,
        locale,
      })
      return ok({
        anzahl: totalDocs,
        referenzen: docs.map((p) => ({
          id: p.id,
          titel: p.title,
          slug: p.slug,
          bereich: p.sector,
          jahr: p.year ?? null,
          auftraggeber: p.client ?? null,
          kurzbeschreibung: p.summary ?? null,
          anzahlBilder: (p.images ?? []).length,
          aufStartseite: Boolean(p.featured),
          reihenfolge: p.order ?? 0,
          url: `/de/projekte/${p.slug}`,
        })),
      })
    },
  )

  server.registerTool(
    'referenz_lesen',
    {
      description: 'Liest eine Referenz vollständig — inkl. Beschreibung als Fließtext und Bild-IDs.',
      inputSchema: { slug: z.string(), sprache, ohneRueckfall },
    },
    async ({ slug, sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const p = await findeNachSlug<Record<string, any>>(payload, 'projects', slug, {
        locale,
        depth: 1,
        ...(ohne ? { fallbackLocale: false as const } : {}),
      })
      if (!p) return fehler(`Referenz "${slug}" nicht gefunden`)
      return ok({
        id: p.id,
        titel: p.title,
        slug: p.slug,
        bereich: p.sector,
        jahr: p.year ?? null,
        auftraggeber: p.client ?? null,
        kurzbeschreibung: p.summary ?? null,
        beschreibung: richTextZuText(p.description),
        bildIds: (p.images ?? []).map((b: any) => (typeof b === 'object' ? b.id : b)),
        produktSlugs: (p.relatedProducts ?? []).map((r: any) => (typeof r === 'object' ? r.slug : r)),
        aufStartseite: Boolean(p.featured),
        reihenfolge: p.order ?? 0,
        url: `/de/projekte/${p.slug}`,
      })
    },
  )

  server.registerTool(
    'referenz_anlegen',
    {
      description:
        'Legt eine neue Referenz auf Deutsch an. Mindestens ein Bild ist Pflicht — IDs über medien_liste oder bild_hochladen besorgen. Slug weglassen = wird aus dem Titel erzeugt.',
      inputSchema: {
        titel: z.string(),
        bereich: bereich.describe('kommunal = Kommunen & öffentliche Hand, gewerbe, privat'),
        bildIds: z.array(z.number()).min(1).describe('Media-IDs, mindestens eine (Pflichtfeld)'),
        slug: z.string().optional().describe('URL-Pfad; leer = automatisch aus dem Titel'),
        kurzbeschreibung: z.string().optional().describe('Teaser für die Übersicht'),
        beschreibung: z.string().optional().describe('Fließtext; Absätze durch Leerzeilen'),
        auftraggeber: z.string().optional().describe('Auftraggeber oder Ort'),
        jahr: z.number().int().min(2000).max(2100).optional(),
        produktSlugs: z
          .array(z.string())
          .optional()
          .describe('Produkte, die in diesem Projekt verbaut wurden'),
        aufStartseite: z.boolean().optional(),
        reihenfolge: z.number().optional(),
      },
    },
    async ({
      titel,
      bereich: sektor,
      bildIds,
      slug,
      kurzbeschreibung,
      beschreibung,
      auftraggeber,
      jahr,
      produktSlugs,
      aufStartseite,
      reihenfolge,
    }) => {
      const payload = await db()
      const doc = await payload.create({
        collection: 'projects',
        locale: 'de',
        data: {
          title: titel,
          slug: slug || undefined,
          sector: sektor,
          images: bildIds,
          summary: kurzbeschreibung,
          description: beschreibung ? richText(beschreibung) : undefined,
          client: auftraggeber,
          year: jahr,
          relatedProducts: await resolveIds(payload, 'products', produktSlugs),
          featured: aufStartseite ?? false,
          order: reihenfolge ?? 0,
        },
      })
      return ok({
        ok: true,
        id: doc.id,
        slug: doc.slug,
        url: `/de/projekte/${doc.slug}`,
        hinweis:
          "Französisch/Englisch mit referenz_aendern und sprache: 'fr' bzw. 'en' nachtragen.",
      })
    },
  )

  server.registerTool(
    'referenz_aendern',
    {
      description:
        'Ändert eine Referenz (nur die angegebenen Felder). Mit sprache=fr/en werden Titel, Kurzbeschreibung und Beschreibung in dieser Sprache gesetzt; Bereich, Jahr, Bilder, Auftraggeber und Reihenfolge gelten sprachübergreifend.',
      inputSchema: {
        slug: z.string(),
        sprache,
        titel: z.string().optional(),
        bereich: bereich.optional(),
        bildIds: z.array(z.number()).min(1).optional(),
        kurzbeschreibung: z.string().optional(),
        beschreibung: z.string().optional(),
        auftraggeber: z.string().optional(),
        jahr: z.number().int().min(2000).max(2100).optional(),
        produktSlugs: z.array(z.string()).optional(),
        aufStartseite: z.boolean().optional(),
        reihenfolge: z.number().optional(),
      },
    },
    async ({
      slug,
      sprache: locale,
      titel,
      bereich: sektor,
      bildIds,
      kurzbeschreibung,
      beschreibung,
      auftraggeber,
      jahr,
      produktSlugs,
      aufStartseite,
      reihenfolge,
    }) => {
      const payload = await db()
      const p = await findeNachSlug<{ id: number }>(payload, 'projects', slug)
      if (!p) return fehler(`Referenz "${slug}" nicht gefunden`)
      const updated = await payload.update({
        collection: 'projects',
        id: p.id,
        locale,
        data: {
          ...(titel !== undefined && { title: titel }),
          ...(sektor !== undefined && { sector: sektor }),
          ...(bildIds !== undefined && { images: bildIds }),
          ...(kurzbeschreibung !== undefined && { summary: kurzbeschreibung }),
          ...(beschreibung !== undefined && { description: richText(beschreibung) }),
          ...(auftraggeber !== undefined && { client: auftraggeber }),
          ...(jahr !== undefined && { year: jahr }),
          ...(produktSlugs !== undefined && {
            relatedProducts: await resolveIds(payload, 'products', produktSlugs),
          }),
          ...(aufStartseite !== undefined && { featured: aufStartseite }),
          ...(reihenfolge !== undefined && { order: reihenfolge }),
        },
      })
      return ok({
        ok: true,
        sprache: locale,
        referenz: { id: updated.id, titel: updated.title, slug: updated.slug },
      })
    },
  )

  server.registerTool(
    'referenz_loeschen',
    {
      description:
        'Löscht eine Referenz endgültig. Ohne bestaetigen=true wird nur angezeigt, was gelöscht würde. Die Bilder bleiben in der Mediathek.',
      inputSchema: { slug: z.string(), bestaetigen },
    },
    async ({ slug, bestaetigen: jetzt }) => {
      const payload = await db()
      const p = await findeNachSlug<Record<string, any>>(payload, 'projects', slug, { depth: 0 })
      if (!p) return fehler(`Referenz "${slug}" nicht gefunden`)
      if (!jetzt) {
        return bestaetigungNoetig({
          id: p.id,
          titel: p.title,
          slug: p.slug,
          bereich: p.sector,
          jahr: p.year ?? null,
        })
      }
      await payload.delete({ collection: 'projects', id: p.id })
      return ok({ ok: true, geloescht: p.title })
    },
  )
}
