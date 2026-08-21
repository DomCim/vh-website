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

export function registerNews(server: McpServer) {
  // ── News ──────────────────────────────────────────────────────────────────
  server.registerTool(
    'news_liste',
    {
      description:
        'Listet News-Beiträge (auch Entwürfe) mit Datum, Rubrik, Status und dem Ergebnis der Facebook-/Instagram-Posts.',
      inputSchema: {
        rubrik: z.enum(['news', 'ratgeber']).optional(),
        nurEntwuerfe: z.boolean().optional(),
        sprache,
      },
    },
    async ({ rubrik, nurEntwuerfe, sprache: locale }) => {
      const payload = await db()
      const where: Where[] = []
      if (rubrik) where.push({ type: { equals: rubrik } })
      if (nurEntwuerfe) where.push({ _status: { equals: 'draft' } })
      const { docs, totalDocs } = await payload.find({
        collection: 'news',
        where: where.length ? { and: where } : undefined,
        sort: '-publishedDate',
        limit: 50,
        locale,
        draft: true,
      })
      return ok({
        anzahl: totalDocs,
        news: docs.map((n) => ({
          id: n.id,
          titel: n.title,
          slug: n.slug,
          rubrik: n.type,
          datum: n.publishedDate,
          status: n._status,
          facebookPostId: n.facebookPostId ?? null,
          facebookFehler: n.facebookPostError ?? null,
          instagramPostId: n.instagramPostId ?? null,
          instagramFehler: n.instagramPostError ?? null,
        })),
      })
    },
  )

  server.registerTool(
    'news_lesen',
    {
      description: 'Liest einen News-Beitrag vollständig (auch Entwürfe), Inhalt als Fließtext.',
      inputSchema: { slug: z.string(), sprache, ohneRueckfall },
    },
    async ({ slug, sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const n = await findeNachSlug<Record<string, any>>(payload, 'news', slug, {
        locale,
        draft: true,
        depth: 1,
        ...(ohne ? { fallbackLocale: false as const } : {}),
      })
      if (!n) return fehler(`News-Beitrag "${slug}" nicht gefunden`)
      return ok({
        id: n.id,
        titel: n.title,
        slug: n.slug,
        rubrik: n.type,
        datum: n.publishedDate,
        status: n._status,
        teaser: n.excerpt ?? null,
        inhalt: richTextZuText(n.content),
        bildId: typeof n.coverImage === 'object' ? n.coverImage?.id : (n.coverImage ?? null),
        url: `/de/news/${n.slug}`,
      })
    },
  )

  server.registerTool(
    'news_verfassen',
    {
      description:
        'Erstellt einen News-Beitrag auf Deutsch. Standardmäßig als Entwurf; mit veroeffentlichen=true geht er sofort live und wird bei aktivierter Facebook-/Instagram-Option gepostet (Instagram braucht zwingend ein Titelbild). Slug weglassen = wird aus dem Titel erzeugt.',
      inputSchema: {
        titel: z.string(),
        teaser: z.string().describe('Kurztext für Übersicht und Social-Media-Post'),
        inhalt: z.string().describe('Fließtext; Absätze durch Leerzeilen'),
        bildId: z.number().describe('Media-ID des Titelbilds (siehe medien_liste)'),
        slug: z.string().optional().describe('URL-Pfad; leer = automatisch aus dem Titel'),
        rubrik: z.enum(['news', 'ratgeber']).optional().describe('Standard: news'),
        datum: z.string().optional().describe('ISO-Datum; leer = jetzt'),
        aufFacebookPosten: z.boolean().optional(),
        aufInstagramPosten: z.boolean().optional(),
        veroeffentlichen: z.boolean().optional(),
      },
    },
    async ({
      titel,
      teaser,
      inhalt,
      bildId,
      slug,
      rubrik,
      datum,
      aufFacebookPosten,
      aufInstagramPosten,
      veroeffentlichen,
    }) => {
      // „nächster Dienstag" landete sonst ungeprüft im Veröffentlichungsdatum
      if (datum !== undefined && !Number.isFinite(Date.parse(datum))) {
        return fehler(`„${datum}" ist kein lesbares Datum — bitte als ISO-Datum (2026-09-01) angeben.`)
      }
      const payload = await db()
      const publish = veroeffentlichen ?? false
      const doc = await payload.create({
        collection: 'news',
        locale: 'de',
        draft: !publish,
        data: {
          title: titel,
          slug: slug || undefined,
          excerpt: teaser,
          content: richText(inhalt),
          type: rubrik ?? 'news',
          coverImage: bildId,
          publishedDate: datum ?? new Date().toISOString(),
          postToFacebook: aufFacebookPosten ?? false,
          postToInstagram: aufInstagramPosten ?? false,
          _status: publish ? 'published' : 'draft',
        },
      })
      const gepostet = [aufFacebookPosten && 'Facebook', aufInstagramPosten && 'Instagram'].filter(
        Boolean,
      )
      return ok({
        ok: true,
        id: doc.id,
        slug: doc.slug,
        status: doc._status,
        url: `/de/news/${doc.slug}`,
        hinweis: publish
          ? gepostet.length
            ? `Veröffentlicht — Post auf ${gepostet.join(' und ')} wurde ausgelöst (Ergebnis über news_liste prüfen).`
            : 'Veröffentlicht.'
          : 'Als Entwurf gespeichert — Veröffentlichung über news_aendern mit veroeffentlichen=true.',
      })
    },
  )

  server.registerTool(
    'news_aendern',
    {
      description:
        'Ändert einen News-Beitrag und kann ihn veröffentlichen oder zurück in den Entwurf setzen. Mit sprache=fr/en werden Titel, Teaser und Inhalt in dieser Sprache gesetzt.',
      inputSchema: {
        slug: z.string(),
        sprache,
        titel: z.string().optional(),
        teaser: z.string().optional(),
        inhalt: z.string().optional(),
        bildId: z.number().optional(),
        rubrik: z.enum(['news', 'ratgeber']).optional(),
        datum: z.string().optional(),
        aufFacebookPosten: z.boolean().optional(),
        aufInstagramPosten: z.boolean().optional(),
        veroeffentlichen: z
          .boolean()
          .optional()
          .describe('true = veröffentlichen, false = zurück in den Entwurf'),
      },
    },
    async ({
      slug,
      sprache: locale,
      titel,
      teaser,
      inhalt,
      bildId,
      rubrik,
      datum,
      aufFacebookPosten,
      aufInstagramPosten,
      veroeffentlichen,
    }) => {
      if (datum !== undefined && !Number.isFinite(Date.parse(datum))) {
        return fehler(`„${datum}" ist kein lesbares Datum — bitte als ISO-Datum (2026-09-01) angeben.`)
      }
      const payload = await db()
      const n = await findeNachSlug<{ id: number }>(payload, 'news', slug, { draft: true })
      if (!n) return fehler(`News-Beitrag "${slug}" nicht gefunden`)
      const updated = await payload.update({
        collection: 'news',
        id: n.id,
        locale,
        ...(veroeffentlichen !== undefined ? { draft: !veroeffentlichen } : {}),
        data: {
          ...(titel !== undefined && { title: titel }),
          ...(teaser !== undefined && { excerpt: teaser }),
          ...(inhalt !== undefined && { content: richText(inhalt) }),
          ...(bildId !== undefined && { coverImage: bildId }),
          ...(rubrik !== undefined && { type: rubrik }),
          ...(datum !== undefined && { publishedDate: datum }),
          ...(aufFacebookPosten !== undefined && { postToFacebook: aufFacebookPosten }),
          ...(aufInstagramPosten !== undefined && { postToInstagram: aufInstagramPosten }),
          ...(veroeffentlichen !== undefined && {
            _status: veroeffentlichen ? ('published' as const) : ('draft' as const),
          }),
        },
      })
      return ok({ ok: true, sprache: locale, slug, status: updated._status })
    },
  )

  server.registerTool(
    'news_loeschen',
    {
      description:
        'Löscht einen News-Beitrag endgültig. Ohne bestaetigen=true nur Vorschau. Schonender: news_aendern mit veroeffentlichen=false setzt ihn zurück in den Entwurf.',
      inputSchema: { slug: z.string(), bestaetigen },
    },
    async ({ slug, bestaetigen: jetzt }) => {
      const payload = await db()
      const n = await findeNachSlug<Record<string, any>>(payload, 'news', slug, {
        draft: true,
        depth: 0,
      })
      if (!n) return fehler(`News-Beitrag "${slug}" nicht gefunden`)
      if (!jetzt) {
        return bestaetigungNoetig({ id: n.id, titel: n.title, slug: n.slug, status: n._status })
      }
      await payload.delete({ collection: 'news', id: n.id })
      return ok({ ok: true, geloescht: n.title })
    },
  )
}
