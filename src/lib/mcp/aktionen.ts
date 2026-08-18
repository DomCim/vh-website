import { z } from 'zod'

import {
  bestaetigen,
  bestaetigungNoetig,
  db,
  fehler,
  type McpServer,
  ok,
  resolveIds,
  sprache,
} from './helpers'

const giltFuerEnum = z.enum(['all', 'categories', 'products'])

export function registerAktionen(server: McpServer) {
  // ── Aktionen ──────────────────────────────────────────────────────────────
  server.registerTool(
    'aktionen_liste',
    {
      description: 'Listet alle Aktionen mit Rabatt, Zeitraum und Status.',
      inputSchema: { sprache },
    },
    async ({ sprache: locale }) => {
      const payload = await db()
      const { docs } = await payload.find({
        collection: 'promotions',
        sort: '-endDate',
        limit: 50,
        locale,
      })
      const now = Date.now()
      return ok(
        docs.map((p) => ({
          id: p.id,
          titel: p.title,
          rabatt: p.discountType === 'percent' ? `${p.discountValue} %` : `${p.discountValue} €`,
          von: p.startDate,
          bis: p.endDate,
          giltFuer: p.appliesTo,
          code: p.code ?? null,
          aktiv: Boolean(p.active),
          laeuftGerade:
            Boolean(p.active) &&
            new Date(p.startDate).getTime() <= now &&
            new Date(p.endDate).getTime() >= now,
        })),
      )
    },
  )

  server.registerTool(
    'aktion_anlegen',
    {
      description:
        'Startet eine neue Rabatt-Aktion. Ohne Code gilt der Rabatt automatisch im Warenkorb; mit Code nur nach Eingabe.',
      inputSchema: {
        titel: z.string(),
        beschreibung: z.string().optional(),
        rabattTyp: z.enum(['percent', 'fixed']).describe('percent = %, fixed = fester EUR-Betrag'),
        rabattWert: z.number().positive(),
        tageGueltig: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Laufzeit ab heute in Tagen (Standard 30)'),
        giltFuer: giltFuerEnum.optional(),
        kategorieSlugs: z.array(z.string()).optional().describe('bei giltFuer=categories'),
        produktSlugs: z.array(z.string()).optional().describe('bei giltFuer=products'),
        code: z.string().optional().describe('optionaler Gutscheincode'),
      },
    },
    async ({
      titel,
      beschreibung,
      rabattTyp,
      rabattWert,
      tageGueltig,
      giltFuer,
      kategorieSlugs,
      produktSlugs,
      code,
    }) => {
      const payload = await db()
      const doc = await payload.create({
        collection: 'promotions',
        locale: 'de',
        data: {
          title: titel,
          description: beschreibung,
          discountType: rabattTyp,
          discountValue: rabattWert,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + (tageGueltig ?? 30) * 86400_000).toISOString(),
          appliesTo: giltFuer ?? 'all',
          categories: await resolveIds(payload, 'categories', kategorieSlugs),
          products: await resolveIds(payload, 'products', produktSlugs),
          code: code?.toUpperCase(),
          active: true,
        },
      })
      return ok({
        ok: true,
        id: doc.id,
        bis: doc.endDate,
        hinweis: 'Aktion ist ab sofort aktiv (Banner + Warenkorb).',
      })
    },
  )

  server.registerTool(
    'aktion_aendern',
    {
      description:
        'Ändert eine laufende Aktion — Titel, Rabatt, Zeitraum, Geltungsbereich oder Code. Mit sprache=fr/en werden Titel und Beschreibung in dieser Sprache gesetzt.',
      inputSchema: {
        id: z.number().describe('Aktions-ID aus aktionen_liste'),
        sprache,
        titel: z.string().optional(),
        beschreibung: z.string().optional(),
        rabattTyp: z.enum(['percent', 'fixed']).optional(),
        rabattWert: z.number().positive().optional(),
        bis: z.string().optional().describe('neues Enddatum als ISO-Datum'),
        verlaengernUmTage: z.number().int().positive().optional().describe('ab heute gerechnet'),
        giltFuer: giltFuerEnum.optional(),
        kategorieSlugs: z.array(z.string()).optional(),
        produktSlugs: z.array(z.string()).optional(),
        code: z.string().optional(),
        aktiv: z.boolean().optional(),
      },
    },
    async ({
      id,
      sprache: locale,
      titel,
      beschreibung,
      rabattTyp,
      rabattWert,
      bis,
      verlaengernUmTage,
      giltFuer,
      kategorieSlugs,
      produktSlugs,
      code,
      aktiv,
    }) => {
      const payload = await db()
      const vorhanden = await payload
        .findByID({ collection: 'promotions', id, depth: 0 })
        .catch(() => null)
      if (!vorhanden) return fehler(`Aktion ${id} nicht gefunden`)
      const endDate =
        bis ??
        (verlaengernUmTage
          ? new Date(Date.now() + verlaengernUmTage * 86400_000).toISOString()
          : undefined)
      const doc = await payload.update({
        collection: 'promotions',
        id,
        locale,
        data: {
          ...(titel !== undefined && { title: titel }),
          ...(beschreibung !== undefined && { description: beschreibung }),
          ...(rabattTyp !== undefined && { discountType: rabattTyp }),
          ...(rabattWert !== undefined && { discountValue: rabattWert }),
          ...(endDate !== undefined && { endDate }),
          ...(giltFuer !== undefined && { appliesTo: giltFuer }),
          ...(kategorieSlugs !== undefined && {
            categories: await resolveIds(payload, 'categories', kategorieSlugs),
          }),
          ...(produktSlugs !== undefined && {
            products: await resolveIds(payload, 'products', produktSlugs),
          }),
          ...(code !== undefined && { code: code.toUpperCase() }),
          ...(aktiv !== undefined && { active: aktiv }),
        },
      })
      return ok({ ok: true, id, sprache: locale, bis: doc.endDate, aktiv: Boolean(doc.active) })
    },
  )

  server.registerTool(
    'aktion_beenden',
    {
      description: 'Deaktiviert eine Aktion sofort — der schonende Weg, die Aktion bleibt erhalten.',
      inputSchema: { id: z.number().describe('Aktions-ID aus aktionen_liste') },
    },
    async ({ id }) => {
      const payload = await db()
      const vorhanden = await payload
        .findByID({ collection: 'promotions', id, depth: 0 })
        .catch(() => null)
      if (!vorhanden) return fehler(`Aktion ${id} nicht gefunden`)
      await payload.update({ collection: 'promotions', id, data: { active: false } })
      return ok({ ok: true })
    },
  )

  server.registerTool(
    'aktion_loeschen',
    {
      description:
        'Löscht eine Aktion endgültig. Ohne bestaetigen=true nur Vorschau. Meist reicht aktion_beenden.',
      inputSchema: { id: z.number(), bestaetigen },
    },
    async ({ id, bestaetigen: jetzt }) => {
      const payload = await db()
      const doc = await payload
        .findByID({ collection: 'promotions', id, depth: 0 })
        .catch(() => null)
      if (!doc) return fehler(`Aktion ${id} nicht gefunden`)
      if (!jetzt) {
        return bestaetigungNoetig({ id, titel: doc.title, bis: doc.endDate, code: doc.code ?? null })
      }
      await payload.delete({ collection: 'promotions', id })
      return ok({ ok: true, geloescht: doc.title })
    },
  )
}
