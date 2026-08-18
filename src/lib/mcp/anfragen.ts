import type { Where } from 'payload'
import { z } from 'zod'

import { db, fehler, type McpServer, ok } from './helpers'

const statusEnum = z.enum(['neu', 'inBearbeitung', 'beantwortet', 'erledigt'])

const ART_TEXT: Record<string, string> = {
  kontakt: 'Kontaktformular',
  produkt: 'Produktanfrage',
  massanfertigung: 'Maßanfertigung',
}

export function registerAnfragen(server: McpServer) {
  // ── Anfragen ──────────────────────────────────────────────────────────────
  server.registerTool(
    'anfragen_liste',
    {
      description:
        'Listet eingegangene Anfragen (Kontaktformular, Produktanfrage, Maßanfertigung), neueste zuerst.',
      inputSchema: {
        status: statusEnum.optional().describe('ohne Angabe: alle'),
        art: z.enum(['kontakt', 'produkt', 'massanfertigung']).optional(),
      },
    },
    async ({ status, art }) => {
      const payload = await db()
      const where: Where[] = []
      if (status) where.push({ status: { equals: status } })
      if (art) where.push({ type: { equals: art } })
      const { docs, totalDocs } = await payload.find({
        collection: 'inquiries',
        where: where.length ? { and: where } : undefined,
        sort: '-createdAt',
        limit: 50,
        overrideAccess: true,
      })
      return ok({
        anzahl: totalDocs,
        anfragen: docs.map((a) => ({
          id: a.id,
          art: ART_TEXT[a.type] ?? a.type,
          status: a.status,
          name: a.name,
          email: a.email,
          telefon: a.phone ?? null,
          produkt: a.productTitle ?? null,
          datum: a.createdAt,
          nachricht: (a.message ?? '').slice(0, 200),
        })),
      })
    },
  )

  server.registerTool(
    'anfrage_lesen',
    {
      description: 'Liest eine Anfrage vollständig, inkl. Maß-Angaben und angehängten Bildern.',
      inputSchema: { id: z.number().describe('ID aus anfragen_liste') },
    },
    async ({ id }) => {
      const payload = await db()
      const a = await payload
        .findByID({ collection: 'inquiries', id, depth: 1, overrideAccess: true })
        .catch(() => null)
      if (!a) return fehler(`Anfrage ${id} nicht gefunden`)
      return ok({
        id: a.id,
        art: ART_TEXT[a.type] ?? a.type,
        status: a.status,
        datum: a.createdAt,
        name: a.name,
        email: a.email,
        telefon: a.phone ?? null,
        nachricht: a.message,
        produkt: a.productTitle ?? null,
        produktLink: a.productUrl ?? null,
        sprachfassung: a.locale ?? null,
        massanfertigung:
          a.type === 'massanfertigung'
            ? {
                breite: a.custom?.width ?? null,
                tiefe: a.custom?.depth ?? null,
                hoehe: a.custom?.height ?? null,
                farbe: a.custom?.color ?? null,
                verwendung: a.custom?.purpose ?? null,
                wunschtermin: a.custom?.desiredDate ?? null,
              }
            : null,
        anhaenge: (a.attachments ?? []).map((m) =>
          typeof m === 'object' ? { id: m.id, datei: m.filename } : { id: m },
        ),
        interneNotiz: a.internalNote ?? null,
      })
    },
  )

  server.registerTool(
    'anfrage_status_setzen',
    {
      description: 'Setzt den Bearbeitungsstand einer Anfrage und ergänzt optional eine interne Notiz.',
      inputSchema: {
        id: z.number(),
        status: statusEnum,
        notiz: z.string().optional().describe('interne Notiz, nur im Backend sichtbar'),
      },
    },
    async ({ id, status, notiz }) => {
      const payload = await db()
      const a = await payload
        .findByID({ collection: 'inquiries', id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!a) return fehler(`Anfrage ${id} nicht gefunden`)
      await payload.update({
        collection: 'inquiries',
        id,
        overrideAccess: true,
        data: {
          status,
          ...(notiz !== undefined && { internalNote: notiz }),
        },
      })
      return ok({ ok: true, id, neuerStatus: status })
    },
  )
}
