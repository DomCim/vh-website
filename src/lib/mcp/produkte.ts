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
  richTextZuText,
  sprache,
} from './helpers'

export function registerProdukte(server: McpServer) {
  // ── Produkte ──────────────────────────────────────────────────────────────
  server.registerTool(
    'produkte_liste',
    {
      description:
        'Listet Produkte mit Preis, Kategorie, Fertigungszeit und Verfügbarkeit. Optional nach Kategorie-Slug oder Suchbegriff filtern.',
      inputSchema: {
        kategorieSlug: z.string().optional().describe('z.B. outdoor-moebel, leuchten, objekte'),
        suche: z.string().optional().describe('Suchbegriff im Titel'),
        sprache,
      },
    },
    async ({ kategorieSlug, suche, sprache: locale }) => {
      const payload = await db()
      const where: Where[] = []
      if (kategorieSlug) {
        const kat = await findeNachSlug<{ id: number }>(payload, 'categories', kategorieSlug)
        if (!kat) return fehler(`Kategorie "${kategorieSlug}" nicht gefunden`)
        where.push({ category: { equals: kat.id } })
      }
      if (suche) where.push({ title: { contains: suche } })
      const { docs, totalDocs } = await payload.find({
        collection: 'products',
        where: where.length ? { and: where } : undefined,
        limit: 50,
        depth: 1,
        locale,
      })
      return ok({
        anzahl: totalDocs,
        produkte: docs.map((p) => ({
          id: p.id,
          titel: p.title,
          slug: p.slug,
          kategorie: typeof p.category === 'object' ? p.category?.slug : p.category,
          preis: p.price ?? null,
          versandkosten: p.shippingCost ?? 0,
          varianten: (p.variants ?? []).map((v) => ({ titel: v.title, preis: v.price })),
          fertigungszeit: p.productionTime ?? null,
          ausDerWerkstatt: Boolean(p.readyMade),
          nurAufAnfrage: Boolean(p.onRequestOnly),
          verfuegbar: p.available !== false,
          aufStartseite: Boolean(p.featured),
        })),
      })
    },
  )

  server.registerTool(
    'produkt_lesen',
    {
      description: 'Liest ein Produkt vollständig — inkl. Beschreibung, Varianten, Farben, Bild-IDs.',
      inputSchema: { slug: z.string(), sprache, ohneRueckfall },
    },
    async ({ slug, sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const p = await findeNachSlug<Record<string, any>>(payload, 'products', slug, {
        locale,
        depth: 1,
        ...(ohne ? { fallbackLocale: false as const } : {}),
      })
      if (!p) return fehler(`Produkt "${slug}" nicht gefunden`)
      return ok({
        id: p.id,
        titel: p.title,
        slug: p.slug,
        kategorie: typeof p.category === 'object' ? p.category?.slug : p.category,
        preis: p.price ?? null,
        versandkosten: p.shippingCost ?? 0,
        kurzbeschreibung: p.shortDescription ?? null,
        beschreibung: richTextZuText(p.description),
        varianten: (p.variants ?? []).map((v: any) => ({ titel: v.title, preis: v.price })),
        farboptionen: (p.colorOptions ?? []).map((c: any) => ({ name: c.name, hex: c.hex })),
        bildIds: (p.images ?? []).map((b: any) => (typeof b === 'object' ? b.id : b)),
        fertigungszeit: p.productionTime ?? null,
        ausDerWerkstatt: Boolean(p.readyMade),
        nurAufAnfrage: Boolean(p.onRequestOnly),
        verfuegbar: p.available !== false,
        aufStartseite: Boolean(p.featured),
        reihenfolge: p.order ?? 0,
      })
    },
  )

  server.registerTool(
    'produkt_aendern',
    {
      description:
        'Ändert ein Produkt (nur die angegebenen Felder). Preisänderungen wirken sofort im Shop. Mit sprache=fr/en werden die übersetzbaren Felder (Titel, Kurzbeschreibung, Beschreibung, Fertigungszeit) in dieser Sprache gesetzt; alle übrigen Felder gelten sprachübergreifend.',
      inputSchema: {
        slug: z.string().describe('Slug des Produkts, z.B. outdoor-sofa-os'),
        sprache,
        titel: z.string().optional(),
        preis: z.number().nonnegative().optional().describe('Grundpreis in EUR'),
        versandkosten: z
          .number()
          .nonnegative()
          .optional()
          .describe('Versandkosten pro Stück in EUR (0 = versandkostenfrei)'),
        kurzbeschreibung: z.string().optional(),
        beschreibung: z.string().optional().describe('Fließtext; Absätze durch Leerzeilen'),
        kategorieSlug: z.string().optional(),
        fertigungszeit: z
          .string()
          .optional()
          .describe('z.B. "3–4 Wochen". Leer lassen = Standardwert aus den Website-Einstellungen'),
        ausDerWerkstatt: z
          .boolean()
          .optional()
          .describe('true = fertiges Stück, sofort lieferbar (wird nach dem Verkauf automatisch ausgeblendet)'),
        verfuegbar: z.boolean().optional(),
        nurAufAnfrage: z.boolean().optional(),
        aufStartseite: z.boolean().optional(),
        reihenfolge: z.number().optional(),
      },
    },
    async ({
      slug,
      sprache: locale,
      titel,
      preis,
      versandkosten,
      kurzbeschreibung,
      beschreibung,
      kategorieSlug,
      fertigungszeit,
      ausDerWerkstatt,
      verfuegbar,
      nurAufAnfrage,
      aufStartseite,
      reihenfolge,
    }) => {
      const payload = await db()
      const produkt = await findeNachSlug<{ id: number }>(payload, 'products', slug)
      if (!produkt) return fehler(`Produkt "${slug}" nicht gefunden`)

      let kategorieId: number | undefined
      if (kategorieSlug) {
        const kat = await findeNachSlug<{ id: number }>(payload, 'categories', kategorieSlug)
        if (!kat) return fehler(`Kategorie "${kategorieSlug}" nicht gefunden`)
        kategorieId = kat.id
      }

      const updated = await payload.update({
        collection: 'products',
        id: produkt.id,
        locale,
        data: {
          ...(titel !== undefined && { title: titel }),
          ...(preis !== undefined && { price: preis }),
          ...(versandkosten !== undefined && { shippingCost: versandkosten }),
          ...(kurzbeschreibung !== undefined && { shortDescription: kurzbeschreibung }),
          ...(beschreibung !== undefined && { description: richText(beschreibung) }),
          ...(kategorieId !== undefined && { category: kategorieId }),
          ...(fertigungszeit !== undefined && { productionTime: fertigungszeit }),
          ...(ausDerWerkstatt !== undefined && { readyMade: ausDerWerkstatt }),
          ...(verfuegbar !== undefined && { available: verfuegbar }),
          ...(nurAufAnfrage !== undefined && { onRequestOnly: nurAufAnfrage }),
          ...(aufStartseite !== undefined && { featured: aufStartseite }),
          ...(reihenfolge !== undefined && { order: reihenfolge }),
        },
      })
      return ok({
        ok: true,
        sprache: locale,
        produkt: { id: updated.id, titel: updated.title, preis: updated.price },
      })
    },
  )

  server.registerTool(
    'produkt_anlegen',
    {
      description:
        'Legt ein neues Produkt auf Deutsch an. Bild-IDs über medien_liste oder bild_hochladen besorgen. Slug weglassen = wird aus dem Titel erzeugt.',
      inputSchema: {
        titel: z.string(),
        kategorieSlug: z.string(),
        bildIds: z.array(z.number()).min(1).describe('Media-IDs (siehe medien_liste)'),
        slug: z.string().optional().describe('URL-Pfad; leer = automatisch aus dem Titel'),
        preis: z.number().nonnegative().optional(),
        versandkosten: z.number().nonnegative().optional().describe('Versandkosten pro Stück in EUR'),
        kurzbeschreibung: z.string().optional(),
        beschreibung: z.string().optional().describe('Fließtext; Absätze durch Leerzeilen'),
        fertigungszeit: z.string().optional().describe('z.B. "3–4 Wochen"'),
        ausDerWerkstatt: z.boolean().optional().describe('true = fertiges Stück, sofort lieferbar'),
        nurAufAnfrage: z.boolean().optional(),
      },
    },
    async ({
      titel,
      kategorieSlug,
      bildIds,
      slug,
      preis,
      versandkosten,
      kurzbeschreibung,
      beschreibung,
      fertigungszeit,
      ausDerWerkstatt,
      nurAufAnfrage,
    }) => {
      const payload = await db()
      const kat = await findeNachSlug<{ id: number }>(payload, 'categories', kategorieSlug)
      if (!kat) return fehler(`Kategorie "${kategorieSlug}" nicht gefunden`)
      const doc = await payload.create({
        collection: 'products',
        locale: 'de',
        data: {
          title: titel,
          slug: slug || undefined,
          category: kat.id,
          images: bildIds,
          price: preis,
          shippingCost: versandkosten,
          shortDescription: kurzbeschreibung,
          description: beschreibung ? richText(beschreibung) : undefined,
          productionTime: fertigungszeit,
          readyMade: ausDerWerkstatt ?? false,
          onRequestOnly: nurAufAnfrage ?? false,
        },
      })
      return ok({
        ok: true,
        id: doc.id,
        slug: doc.slug,
        url: `/de/${kategorieSlug}/${doc.slug}`,
        hinweis:
          "Französisch/Englisch mit produkt_aendern und sprache: 'fr' bzw. 'en' nachtragen.",
      })
    },
  )

  server.registerTool(
    'produkt_bilder_setzen',
    {
      description: 'Ersetzt die Bilder eines Produkts; die Reihenfolge der IDs ist die Anzeigereihenfolge.',
      inputSchema: {
        slug: z.string(),
        bildIds: z.array(z.number()).min(1).describe('Media-IDs in gewünschter Reihenfolge'),
      },
    },
    async ({ slug, bildIds }) => {
      const payload = await db()
      const produkt = await findeNachSlug<{ id: number }>(payload, 'products', slug)
      if (!produkt) return fehler(`Produkt "${slug}" nicht gefunden`)
      await payload.update({
        collection: 'products',
        id: produkt.id,
        data: { images: bildIds },
      })
      return ok({ ok: true, slug, anzahlBilder: bildIds.length })
    },
  )

  server.registerTool(
    'produkt_varianten_setzen',
    {
      description:
        'Ersetzt Varianten und/oder Farboptionen eines Produkts. Nur das angegebene Feld wird überschrieben.',
      inputSchema: {
        slug: z.string(),
        sprache,
        varianten: z
          .array(z.object({ titel: z.string(), preis: z.number().nonnegative() }))
          .optional()
          .describe('z.B. [{titel: "Größe M", preis: 890}]'),
        farboptionen: z
          .array(z.object({ name: z.string(), hex: z.string().optional() }))
          .optional()
          .describe('z.B. [{name: "Anthrazitgrau (RAL 7016)", hex: "#383E42"}]'),
      },
    },
    async ({ slug, sprache: locale, varianten, farboptionen }) => {
      const payload = await db()
      const produkt = await findeNachSlug<{ id: number }>(payload, 'products', slug)
      if (!produkt) return fehler(`Produkt "${slug}" nicht gefunden`)
      await payload.update({
        collection: 'products',
        id: produkt.id,
        locale,
        data: {
          ...(varianten !== undefined && {
            variants: varianten.map((v) => ({ title: v.titel, price: v.preis })),
          }),
          ...(farboptionen !== undefined && {
            colorOptions: farboptionen.map((c) => ({ name: c.name, hex: c.hex })),
          }),
        },
      })
      return ok({ ok: true, slug, sprache: locale })
    },
  )

  server.registerTool(
    'produkt_loeschen',
    {
      description:
        'Löscht ein Produkt endgültig. Ohne bestaetigen=true wird nur angezeigt, was gelöscht würde. Alternative ohne Datenverlust: produkt_aendern mit verfuegbar=false.',
      inputSchema: { slug: z.string(), bestaetigen },
    },
    async ({ slug, bestaetigen: jetzt }) => {
      const payload = await db()
      const p = await findeNachSlug<Record<string, any>>(payload, 'products', slug, { depth: 0 })
      if (!p) return fehler(`Produkt "${slug}" nicht gefunden`)
      if (!jetzt) {
        return bestaetigungNoetig({ id: p.id, titel: p.title, slug: p.slug, preis: p.price ?? null })
      }
      await payload.delete({ collection: 'products', id: p.id })
      return ok({ ok: true, geloescht: p.title })
    },
  )
}
