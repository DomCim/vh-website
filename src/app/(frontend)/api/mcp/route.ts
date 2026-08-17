import config from '@payload-config'
import { createMcpHandler } from 'mcp-handler'
import { getPayload, type Payload, type Where } from 'payload'
import { z } from 'zod'

import { richText } from '../../../../lib/richtext'

/**
 * MCP-Server zur Verwaltung der Website per KI-Assistent (z.B. Claude).
 *
 * Endpunkt:  POST /api/mcp   (Streamable HTTP)
 * Auth:      Authorization: Bearer <MCP_API_KEY>  oder  ?key=<MCP_API_KEY>
 * Ohne gesetzte Umgebungsvariable MCP_API_KEY ist der Server deaktiviert.
 */

const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
})

async function db(): Promise<Payload> {
  return getPayload({ config })
}

const handler = createMcpHandler(
  (server) => {
    // ── Produkte ────────────────────────────────────────────────────────────
    server.registerTool(
      'produkte_liste',
      {
        description:
          'Listet Produkte mit Preis, Kategorie und Verfügbarkeit. Optional nach Kategorie-Slug oder Suchbegriff filtern.',
        inputSchema: {
          kategorieSlug: z.string().optional().describe('z.B. outdoor-moebel, leuchten, objekte'),
          suche: z.string().optional().describe('Suchbegriff im Titel'),
        },
      },
      async ({ kategorieSlug, suche }) => {
        const payload = await db()
        const where: Where[] = []
        if (kategorieSlug) {
          const { docs } = await payload.find({
            collection: 'categories',
            where: { slug: { equals: kategorieSlug } },
            limit: 1,
          })
          if (!docs[0]) return ok({ fehler: `Kategorie "${kategorieSlug}" nicht gefunden` })
          where.push({ category: { equals: docs[0].id } })
        }
        if (suche) where.push({ title: { contains: suche } })
        const { docs, totalDocs } = await payload.find({
          collection: 'products',
          where: where.length ? { and: where } : undefined,
          limit: 50,
          depth: 1,
          locale: 'de',
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
            nurAufAnfrage: Boolean(p.onRequestOnly),
            verfuegbar: p.available !== false,
            aufStartseite: Boolean(p.featured),
          })),
        })
      },
    )

    server.registerTool(
      'produkt_aendern',
      {
        description:
          'Ändert ein Produkt (nur die angegebenen Felder). Preisänderungen wirken sofort im Shop.',
        inputSchema: {
          slug: z.string().describe('Slug des Produkts, z.B. outdoor-sofa-os'),
          titel: z.string().optional(),
          preis: z.number().nonnegative().optional().describe('Grundpreis in EUR'),
          versandkosten: z.number().nonnegative().optional().describe('Versandkosten pro Stück in EUR (0 = versandkostenfrei)'),
          kurzbeschreibung: z.string().optional(),
          verfuegbar: z.boolean().optional(),
          nurAufAnfrage: z.boolean().optional(),
          aufStartseite: z.boolean().optional(),
        },
      },
      async ({ slug, titel, preis, versandkosten, kurzbeschreibung, verfuegbar, nurAufAnfrage, aufStartseite }) => {
        const payload = await db()
        const { docs } = await payload.find({
          collection: 'products',
          where: { slug: { equals: slug } },
          limit: 1,
        })
        if (!docs[0]) return ok({ fehler: `Produkt "${slug}" nicht gefunden` })
        const updated = await payload.update({
          collection: 'products',
          id: docs[0].id,
          locale: 'de',
          data: {
            ...(titel !== undefined && { title: titel }),
            ...(preis !== undefined && { price: preis }),
            ...(versandkosten !== undefined && { shippingCost: versandkosten }),
            ...(kurzbeschreibung !== undefined && { shortDescription: kurzbeschreibung }),
            ...(verfuegbar !== undefined && { available: verfuegbar }),
            ...(nurAufAnfrage !== undefined && { onRequestOnly: nurAufAnfrage }),
            ...(aufStartseite !== undefined && { featured: aufStartseite }),
          },
        })
        return ok({
          ok: true,
          produkt: { id: updated.id, titel: updated.title, preis: updated.price },
        })
      },
    )

    server.registerTool(
      'produkt_anlegen',
      {
        description:
          'Legt ein neues Produkt an (deutsch; die französische Übersetzung danach im Admin ergänzen). Bild-IDs über medien_liste finden.',
        inputSchema: {
          titel: z.string(),
          slug: z.string().describe('URL-Pfad, z.B. outdoor-bank-ob'),
          kategorieSlug: z.string(),
          bildIds: z.array(z.number()).min(1).describe('Media-IDs (siehe medien_liste)'),
          preis: z.number().nonnegative().optional(),
          versandkosten: z.number().nonnegative().optional().describe('Versandkosten pro Stück in EUR'),
          kurzbeschreibung: z.string().optional(),
          beschreibung: z.string().optional().describe('Fließtext; Absätze durch Leerzeilen'),
          nurAufAnfrage: z.boolean().optional(),
        },
      },
      async ({ titel, slug, kategorieSlug, bildIds, preis, versandkosten, kurzbeschreibung, beschreibung, nurAufAnfrage }) => {
        const payload = await db()
        const { docs: cats } = await payload.find({
          collection: 'categories',
          where: { slug: { equals: kategorieSlug } },
          limit: 1,
        })
        if (!cats[0]) return ok({ fehler: `Kategorie "${kategorieSlug}" nicht gefunden` })
        const doc = await payload.create({
          collection: 'products',
          locale: 'de',
          data: {
            title: titel,
            slug,
            category: cats[0].id,
            images: bildIds,
            price: preis,
            shippingCost: versandkosten,
            shortDescription: kurzbeschreibung,
            description: beschreibung ? richText(beschreibung) : undefined,
            onRequestOnly: nurAufAnfrage ?? false,
          },
        })
        return ok({ ok: true, id: doc.id, url: `/de/${kategorieSlug}/${slug}` })
      },
    )

    // ── News ────────────────────────────────────────────────────────────────
    server.registerTool(
      'news_liste',
      {
        description: 'Listet News-Beiträge (auch Entwürfe) mit Datum, Status und Facebook-Status.',
        inputSchema: {},
      },
      async () => {
        const payload = await db()
        const { docs } = await payload.find({
          collection: 'news',
          sort: '-publishedDate',
          limit: 50,
          locale: 'de',
          draft: true,
        })
        return ok(
          docs.map((n) => ({
            id: n.id,
            titel: n.title,
            slug: n.slug,
            datum: n.publishedDate,
            status: n._status,
            facebookPostId: n.facebookPostId ?? null,
            facebookFehler: n.facebookPostError ?? null,
          })),
        )
      },
    )

    server.registerTool(
      'news_verfassen',
      {
        description:
          'Erstellt einen News-Beitrag (deutsch). Standardmäßig als Entwurf; mit veroeffentlichen=true geht er sofort live und wird bei aktivierter Facebook-Option gepostet.',
        inputSchema: {
          titel: z.string(),
          slug: z.string().optional().describe('URL-Pfad; leer = aus Titel erzeugt'),
          teaser: z.string().describe('Kurztext für Übersicht und Facebook'),
          inhalt: z.string().describe('Fließtext; Absätze durch Leerzeilen'),
          bildId: z.number().describe('Media-ID des Titelbilds (siehe medien_liste)'),
          rubrik: z.enum(['news', 'ratgeber']).optional().describe('Standard: news'),
          aufFacebookPosten: z.boolean().optional(),
          veroeffentlichen: z.boolean().optional(),
        },
      },
      async ({ titel, slug, teaser, inhalt, bildId, rubrik, aufFacebookPosten, veroeffentlichen }) => {
        const payload = await db()
        const finalSlug =
          slug ||
          titel
            .toLowerCase()
            .replace(/ä/g, 'ae')
            .replace(/ö/g, 'oe')
            .replace(/ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
        const publish = veroeffentlichen ?? false
        const doc = await payload.create({
          collection: 'news',
          locale: 'de',
          draft: !publish,
          data: {
            title: titel,
            slug: finalSlug,
            excerpt: teaser,
            content: richText(inhalt),
            type: rubrik ?? 'news',
            coverImage: bildId,
            publishedDate: new Date().toISOString(),
            postToFacebook: aufFacebookPosten ?? false,
            _status: publish ? 'published' : 'draft',
          },
        })
        return ok({
          ok: true,
          id: doc.id,
          status: doc._status,
          url: `/de/news/${finalSlug}`,
          hinweis: publish
            ? aufFacebookPosten
              ? 'Veröffentlicht — Facebook-Post wurde ausgelöst (Status via news_liste prüfen).'
              : 'Veröffentlicht.'
            : 'Als Entwurf gespeichert — Veröffentlichung im Admin oder erneut mit veroeffentlichen=true.',
        })
      },
    )

    // ── Aktionen ────────────────────────────────────────────────────────────
    server.registerTool(
      'aktionen_liste',
      {
        description: 'Listet alle Aktionen mit Rabatt, Zeitraum und Status.',
        inputSchema: {},
      },
      async () => {
        const payload = await db()
        const { docs } = await payload.find({
          collection: 'promotions',
          sort: '-endDate',
          limit: 50,
          locale: 'de',
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
          tageGueltig: z.number().int().positive().optional().describe('Laufzeit ab heute in Tagen (Standard 30)'),
          giltFuer: z.enum(['all', 'categories', 'products']).optional(),
          kategorieSlugs: z.array(z.string()).optional().describe('bei giltFuer=categories'),
          produktSlugs: z.array(z.string()).optional().describe('bei giltFuer=products'),
          code: z.string().optional().describe('optionaler Gutscheincode'),
        },
      },
      async ({ titel, beschreibung, rabattTyp, rabattWert, tageGueltig, giltFuer, kategorieSlugs, produktSlugs, code }) => {
        const payload = await db()
        const resolveIds = async (collection: 'categories' | 'products', slugs?: string[]) => {
          if (!slugs?.length) return []
          const { docs } = await payload.find({
            collection,
            where: { slug: { in: slugs } },
            limit: 100,
          })
          return docs.map((d) => d.id)
        }
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
            categories: await resolveIds('categories', kategorieSlugs),
            products: await resolveIds('products', produktSlugs),
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
      'aktion_beenden',
      {
        description: 'Deaktiviert eine Aktion sofort.',
        inputSchema: { id: z.number().describe('Aktions-ID aus aktionen_liste') },
      },
      async ({ id }) => {
        const payload = await db()
        await payload.update({ collection: 'promotions', id, data: { active: false } })
        return ok({ ok: true })
      },
    )

    // ── Bestellungen ────────────────────────────────────────────────────────
    server.registerTool(
      'bestellungen_liste',
      {
        description:
          'Listet Bestellungen, optional nach Status gefiltert (pending/paid/shipped/cancelled).',
        inputSchema: { status: z.enum(['pending', 'paid', 'shipped', 'cancelled']).optional() },
      },
      async ({ status }) => {
        const payload = await db()
        const { docs, totalDocs } = await payload.find({
          collection: 'orders',
          where: status ? { status: { equals: status } } : undefined,
          sort: '-createdAt',
          limit: 50,
          overrideAccess: true,
        })
        return ok({
          anzahl: totalDocs,
          bestellungen: docs.map((o) => ({
            bestellnummer: o.orderNumber,
            status: o.status,
            gesamt: o.total,
            kunde: o.customer?.name,
            email: o.customer?.email,
            datum: o.createdAt,
            positionen: (o.items ?? []).map(
              (i) => `${i.quantity}× ${i.titleSnapshot}${i.variantTitle ? ` (${i.variantTitle})` : ''}`,
            ),
          })),
        })
      },
    )

    server.registerTool(
      'bestellung_status_setzen',
      {
        description: 'Setzt den Status einer Bestellung (z.B. auf shipped nach dem Versand).',
        inputSchema: {
          bestellnummer: z.string().describe('z.B. VH-2026-0001'),
          status: z.enum(['pending', 'paid', 'shipped', 'cancelled']),
        },
      },
      async ({ bestellnummer, status }) => {
        const payload = await db()
        const { docs } = await payload.find({
          collection: 'orders',
          where: { orderNumber: { equals: bestellnummer } },
          limit: 1,
          overrideAccess: true,
        })
        if (!docs[0]) return ok({ fehler: `Bestellung ${bestellnummer} nicht gefunden` })
        await payload.update({
          collection: 'orders',
          id: docs[0].id,
          overrideAccess: true,
          data: { status },
        })
        return ok({ ok: true, bestellnummer, neuerStatus: status })
      },
    )

    // ── Medien & Statistik ──────────────────────────────────────────────────
    server.registerTool(
      'medien_liste',
      {
        description:
          'Listet hochgeladene Bilder mit ID und Dateiname (IDs für produkt_anlegen/news_verfassen).',
        inputSchema: { suche: z.string().optional().describe('Filter im Dateinamen oder Alt-Text') },
      },
      async ({ suche }) => {
        const payload = await db()
        const { docs } = await payload.find({
          collection: 'media',
          where: suche
            ? { or: [{ filename: { contains: suche } }, { alt: { contains: suche } }] }
            : undefined,
          limit: 100,
          locale: 'de',
        })
        return ok(docs.map((m) => ({ id: m.id, datei: m.filename, alt: m.alt ?? null })))
      },
    )

    server.registerTool(
      'shop_statistik',
      {
        description:
          'Überblick: Bestellungen nach Status, Umsatz (bezahlte Bestellungen), Anzahl Produkte/News/Aktionen.',
        inputSchema: {},
      },
      async () => {
        const payload = await db()
        const statuses = ['pending', 'paid', 'shipped', 'cancelled'] as const
        const counts: Record<string, number> = {}
        for (const s of statuses) {
          const { totalDocs } = await payload.count({
            collection: 'orders',
            where: { status: { equals: s } },
            overrideAccess: true,
          })
          counts[s] = totalDocs
        }
        const { docs: paidOrders } = await payload.find({
          collection: 'orders',
          where: { status: { in: ['paid', 'shipped'] } },
          limit: 1000,
          overrideAccess: true,
        })
        const umsatz = Math.round(paidOrders.reduce((s, o) => s + (o.total || 0), 0) * 100) / 100
        const [produkte, news, aktionen] = await Promise.all([
          payload.count({ collection: 'products' }),
          payload.count({ collection: 'news' }),
          payload.count({ collection: 'promotions', where: { active: { equals: true } } }),
        ])
        return ok({
          bestellungen: counts,
          umsatzEUR: umsatz,
          produkte: produkte.totalDocs,
          news: news.totalDocs,
          aktiveAktionen: aktionen.totalDocs,
        })
      },
    )
  },
  {
    serverInfo: { name: 'vh-website', version: '1.0.0' },
    instructions:
      'Verwaltung der Vincent-Hellmann-Website: Produkte, News (inkl. Facebook-Autopost), Rabatt-Aktionen, Bestellungen und Shop-Statistik. Inhalte werden auf Deutsch angelegt; französische Übersetzungen im Admin-Panel ergänzen.',
  },
)

function authorized(req: Request): boolean {
  const key = process.env.MCP_API_KEY
  if (!key) return false
  const header = req.headers.get('authorization')
  if (header === `Bearer ${key}`) return true
  const url = new URL(req.url)
  return url.searchParams.get('key') === key
}

const guarded = async (req: Request) => {
  if (!process.env.MCP_API_KEY) {
    return new Response('MCP ist deaktiviert (MCP_API_KEY nicht gesetzt)', { status: 503 })
  }
  if (!authorized(req)) {
    return new Response('Unauthorized', { status: 401 })
  }
  return handler(req)
}

export { guarded as GET, guarded as POST, guarded as DELETE }
