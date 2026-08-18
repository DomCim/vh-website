import { z } from 'zod'

import { ALLE_BEREICHE, suche, type SuchBereich } from '../search'
import { db, type McpServer, ok, type Sprache, sprache } from './helpers'

const TAG = 86400_000

/** Lokalisierte Pflichtfelder je Inhaltsbereich */
const UEBERSETZBAR = {
  produkte: { collection: 'products' as const, felder: ['title', 'shortDescription'], label: 'Produkt' },
  referenzen: { collection: 'projects' as const, felder: ['title', 'summary'], label: 'Referenz' },
  news: { collection: 'news' as const, felder: ['title', 'excerpt'], label: 'News-Beitrag' },
  kategorien: { collection: 'categories' as const, felder: ['name'], label: 'Kategorie' },
  kundenstimmen: { collection: 'testimonials' as const, felder: ['quote'], label: 'Kundenstimme' },
}

type BereichName = keyof typeof UEBERSETZBAR

async function fehlendeUebersetzungen(
  payload: Awaited<ReturnType<typeof db>>,
  ziel: Sprache,
  nurBereich?: BereichName,
) {
  const namen = (nurBereich ? [nurBereich] : (Object.keys(UEBERSETZBAR) as BereichName[])).filter(
    Boolean,
  )
  const ergebnis: Record<string, { id: number | string; bezeichnung: string; fehlt: string[] }[]> = {}
  for (const name of namen) {
    const { collection, felder, label } = UEBERSETZBAR[name]
    const { docs: deutsch } = await payload.find({
      collection,
      limit: 200,
      depth: 0,
      locale: 'de',
      ...(collection === 'news' ? { draft: true } : {}),
    })
    const { docs: uebersetzt } = await payload.find({
      collection,
      limit: 200,
      depth: 0,
      locale: ziel,
      fallbackLocale: false,
      ...(collection === 'news' ? { draft: true } : {}),
    })
    const nachId = new Map(uebersetzt.map((d) => [d.id, d as unknown as Record<string, unknown>]))
    const luecken: { id: number | string; bezeichnung: string; fehlt: string[] }[] = []
    for (const d of deutsch) {
      const ziel_ = nachId.get(d.id)
      const fehlt = felder.filter((f) => {
        const wert = ziel_?.[f]
        return typeof wert !== 'string' || wert.trim() === ''
      })
      if (fehlt.length) {
        const doc = d as unknown as Record<string, unknown>
        luecken.push({
          id: d.id,
          bezeichnung: String(doc.title ?? doc.name ?? doc.author ?? d.id),
          fehlt,
        })
      }
    }
    if (luecken.length) ergebnis[label] = luecken
  }
  return ergebnis
}

export function registerAnalyse(server: McpServer) {
  // ── Suche, Prüfung & Statistik ────────────────────────────────────────────
  server.registerTool(
    'suchen',
    {
      description:
        'Sucht quer über Produkte, Referenzen, News, Kategorien und Kundenstimmen — dieselbe Suche, die auch auf der Website läuft.',
      inputSchema: {
        begriff: z.string().min(2).describe('Suchbegriff'),
        bereiche: z
          .array(z.enum(['produkt', 'referenz', 'news', 'kategorie', 'kundenstimme']))
          .optional()
          .describe('ohne Angabe: alle Bereiche'),
        sprache,
      },
    },
    async ({ begriff, bereiche, sprache: locale }) => {
      const payload = await db()
      const treffer = await suche(
        payload,
        begriff,
        locale,
        (bereiche as SuchBereich[]) ?? ALLE_BEREICHE,
      )
      return ok({ anzahl: treffer.length, treffer })
    },
  )

  server.registerTool(
    'uebersetzungen_pruefen',
    {
      description:
        'Listet alle Inhalte, bei denen die französische bzw. englische Fassung noch fehlt — die Arbeitsliste zum Nachtragen über die jeweiligen *_aendern-Werkzeuge mit sprache.',
      inputSchema: {
        sprache: z.enum(['fr', 'en']).describe('Welche Sprachfassung geprüft werden soll'),
        bereich: z
          .enum(['produkte', 'referenzen', 'news', 'kategorien', 'kundenstimmen'])
          .optional()
          .describe('ohne Angabe: alle Bereiche'),
      },
    },
    async ({ sprache: ziel, bereich }) => {
      const payload = await db()
      const luecken = await fehlendeUebersetzungen(payload, ziel, bereich as BereichName | undefined)
      const anzahl = Object.values(luecken).reduce((s, l) => s + l.length, 0)
      return ok({
        sprache: ziel,
        anzahlUnvollstaendig: anzahl,
        fehlendeUebersetzungen: luecken,
        hinweis: anzahl
          ? `Nachtragen über produkt_aendern / referenz_aendern / news_aendern / kategorie_aendern / kundenstimme_aendern mit sprache: '${ziel}'.`
          : 'Alles übersetzt.',
      })
    },
  )

  server.registerTool(
    'website_check',
    {
      description:
        'Redaktionelle Prüfliste: unvollständige Produkte, Bilder ohne Alt-Text, fehlende Übersetzungen, ablaufende Aktionen, hängende Bestellungen, offene Anfragen und fehlgeschlagene Social-Media-Posts.',
      inputSchema: {},
    },
    async () => {
      const payload = await db()
      const jetzt = Date.now()

      const { docs: produkte } = await payload.find({
        collection: 'products',
        limit: 500,
        depth: 0,
        locale: 'de',
      })
      const ohnePreis = produkte.filter((p) => !p.onRequestOnly && (p.price ?? 0) <= 0)
      const ohneBild = produkte.filter((p) => !(p.images ?? []).length)
      const ohneKurztext = produkte.filter((p) => !p.shortDescription?.trim())
      const ohneFertigungszeit = produkte.filter((p) => !p.readyMade && !p.productionTime?.trim())

      const { docs: medien } = await payload.find({
        collection: 'media',
        limit: 500,
        depth: 0,
        locale: 'de',
      })
      const ohneAltText = medien.filter((m) => !m.alt?.trim())

      const { docs: aktionen } = await payload.find({
        collection: 'promotions',
        where: { active: { equals: true } },
        limit: 100,
        depth: 0,
        locale: 'de',
      })
      const laeuftAus = aktionen.filter((a) => {
        const ende = new Date(a.endDate).getTime()
        return ende >= jetzt && ende <= jetzt + 7 * TAG
      })
      const abgelaufenAberAktiv = aktionen.filter((a) => new Date(a.endDate).getTime() < jetzt)

      const { docs: news } = await payload.find({
        collection: 'news',
        limit: 200,
        depth: 0,
        locale: 'de',
        draft: true,
      })
      const entwuerfe = news.filter((n) => n._status === 'draft')
      const socialFehler = news.filter((n) => n.facebookPostError || n.instagramPostError)

      const { docs: bestellungen } = await payload.find({
        collection: 'orders',
        where: { status: { in: ['paid', 'inProduction'] } },
        limit: 200,
        depth: 0,
        overrideAccess: true,
      })
      const haengend = bestellungen.filter(
        (o) => jetzt - new Date(o.updatedAt).getTime() > 14 * TAG,
      )

      const { totalDocs: offeneAnfragen } = await payload.count({
        collection: 'inquiries',
        where: { status: { equals: 'neu' } },
        overrideAccess: true,
      })

      const [fr, en] = await Promise.all([
        fehlendeUebersetzungen(payload, 'fr'),
        fehlendeUebersetzungen(payload, 'en'),
      ])
      const zaehle = (l: Record<string, unknown[]>) =>
        Object.values(l).reduce((s, x) => s + x.length, 0)

      const liste = (docs: { title?: string | null; name?: string | null; slug?: string | null }[]) =>
        docs.slice(0, 20).map((d) => d.slug ?? d.title ?? d.name)

      return ok({
        produkte: {
          ohnePreis: liste(ohnePreis),
          ohneBild: liste(ohneBild),
          ohneKurzbeschreibung: liste(ohneKurztext),
          ohneFertigungszeit: liste(ohneFertigungszeit),
        },
        bilderOhneAltText: {
          anzahl: ohneAltText.length,
          beispiele: ohneAltText.slice(0, 20).map((m) => ({ id: m.id, datei: m.filename })),
        },
        uebersetzungen: {
          franzoesischUnvollstaendig: zaehle(fr),
          englischUnvollstaendig: zaehle(en),
          hinweis: 'Details über uebersetzungen_pruefen.',
        },
        aktionen: {
          laufenInSiebenTagenAus: laeuftAus.map((a) => ({ id: a.id, titel: a.title, bis: a.endDate })),
          abgelaufenAberNochAktiv: abgelaufenAberAktiv.map((a) => ({
            id: a.id,
            titel: a.title,
            bis: a.endDate,
          })),
        },
        news: {
          liegengebliebeneEntwuerfe: entwuerfe.map((n) => n.slug),
          mitSocialMediaFehler: socialFehler.map((n) => ({
            slug: n.slug,
            facebook: n.facebookPostError ?? null,
            instagram: n.instagramPostError ?? null,
          })),
        },
        bestellungen: {
          seitUeberVierzehnTagenUnveraendert: haengend.map((o) => ({
            bestellnummer: o.orderNumber,
            status: o.status,
            seit: o.updatedAt,
          })),
        },
        offeneAnfragen,
      })
    },
  )

  server.registerTool(
    'shop_statistik',
    {
      description:
        'Überblick: Bestellungen nach Status, Umsatz, Umsatz je Monat, meistverkaufte Produkte, Durchschnittsbestellwert sowie Anzahl Produkte/News/Referenzen/Aktionen.',
      inputSchema: {},
    },
    async () => {
      const payload = await db()
      const statuses = ['pending', 'paid', 'inProduction', 'shipped', 'cancelled'] as const
      const counts: Record<string, number> = {}
      for (const s of statuses) {
        const { totalDocs } = await payload.count({
          collection: 'orders',
          where: { status: { equals: s } },
          overrideAccess: true,
        })
        counts[s] = totalDocs
      }

      const { docs: bezahlt } = await payload.find({
        collection: 'orders',
        where: { status: { in: ['paid', 'inProduction', 'shipped'] } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      const runden = (n: number) => Math.round(n * 100) / 100
      const umsatz = runden(bezahlt.reduce((s, o) => s + (o.total || 0), 0))

      const proMonat: Record<string, number> = {}
      const grenze = jetztVorMonaten(12)
      for (const o of bezahlt) {
        const d = new Date(o.createdAt)
        if (d.getTime() < grenze) continue
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        proMonat[key] = runden((proMonat[key] ?? 0) + (o.total || 0))
      }

      const mengen = new Map<string, number>()
      for (const o of bezahlt) {
        for (const i of o.items ?? []) {
          const name = i.titleSnapshot ?? 'unbekannt'
          mengen.set(name, (mengen.get(name) ?? 0) + (i.quantity ?? 0))
        }
      }
      const topProdukte = [...mengen.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([bezeichnung, menge]) => ({ bezeichnung, menge }))

      const abholung = bezahlt.filter((o) => o.deliveryMethod === 'pickup').length

      const [produkte, news, referenzen, aktionen, anfragen] = await Promise.all([
        payload.count({ collection: 'products' }),
        payload.count({ collection: 'news' }),
        payload.count({ collection: 'projects' }),
        payload.count({ collection: 'promotions', where: { active: { equals: true } } }),
        payload.count({
          collection: 'inquiries',
          where: { status: { equals: 'neu' } },
          overrideAccess: true,
        }),
      ])

      return ok({
        bestellungen: counts,
        umsatzEUR: umsatz,
        durchschnittsbestellwertEUR: bezahlt.length ? runden(umsatz / bezahlt.length) : 0,
        umsatzProMonat: Object.fromEntries(Object.entries(proMonat).sort()),
        topProdukte,
        abholungen: abholung,
        lieferungen: bezahlt.length - abholung,
        produkte: produkte.totalDocs,
        news: news.totalDocs,
        referenzen: referenzen.totalDocs,
        aktiveAktionen: aktionen.totalDocs,
        offeneAnfragen: anfragen.totalDocs,
      })
    },
  )
}

function jetztVorMonaten(monate: number): number {
  const d = new Date()
  d.setMonth(d.getMonth() - monate)
  return d.getTime()
}
