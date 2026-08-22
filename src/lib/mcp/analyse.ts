import { z } from 'zod'

import { richTextZuText } from '../richtextText'
import { ALLE_BEREICHE, suche, type SuchBereich } from '../search'
import { BESTELL_STATUS, werteVon } from '../listen'
import { db, type McpServer, ok, type Sprache, sprache } from './helpers'

const TAG = 86400_000

/**
 * Lokalisierte Felder je Inhaltsbereich — Textfelder und Fließtexte getrennt.
 *
 * **Warum die Fließtexte eigens dastehen.** Sie fehlten hier lange ganz, und
 * das hatte Folgen: Die Prüfung meldete einen Artikel als übersetzt, während
 * seine Beschreibung — der längste Text der ganzen Seite — noch leer war oder
 * aus einem 250-Zeichen-Stummel bestand, wo im Deutschen 2.300 Zeichen
 * standen. Gefunden wurde das nicht von diesem Werkzeug, sondern von Hand.
 */
const UEBERSETZBAR = {
  produkte: {
    collection: 'products' as const,
    felder: ['title', 'shortDescription'],
    fliesstext: ['description'],
    label: 'Produkt',
  },
  referenzen: {
    collection: 'projects' as const,
    felder: ['title', 'summary'],
    fliesstext: ['description'],
    label: 'Referenz',
  },
  news: {
    collection: 'news' as const,
    felder: ['title', 'excerpt'],
    fliesstext: [] as string[],
    label: 'News-Beitrag',
  },
  kategorien: {
    collection: 'categories' as const,
    felder: ['name', 'description'],
    fliesstext: [] as string[],
    label: 'Kategorie',
  },
  kundenstimmen: {
    collection: 'testimonials' as const,
    felder: ['quote'],
    fliesstext: [] as string[],
    label: 'Kundenstimme',
  },
}

type BereichName = keyof typeof UEBERSETZBAR

/**
 * Ab wann ein vorhandener Text als Stummel gilt.
 *
 * Eine Übersetzung ist selten genau so lang wie das Original — Französisch
 * gerät etwas länger, Englisch etwas kürzer. Ein Drittel der deutschen Länge
 * unterschreitet aber keine ehrliche Übersetzung; dort steht dann ein
 * Restbestand aus früheren Zeiten.
 */
const STUMMEL_ANTEIL = 0.4

/**
 * Die Gliederung eines Fließtextes als Kürzel: `P H2 P L7 P`.
 *
 * Damit lässt sich vergleichen, ob die Übersetzung dieselben
 * Zwischenüberschriften und Aufzählungen trägt wie das Original. Eine
 * französische Textwüste neben einem gegliederten deutschen Text ist kein
 * Schönheitsfehler: Überschriften sind das, woran ein Leser sich orientiert,
 * und woran Google erkennt, worum es geht.
 */
function gliederung(wert: unknown): string {
  const wurzel = (wert as { root?: { children?: unknown[] } } | null)?.root
  if (!wurzel) return ''
  return (wurzel.children ?? [])
    .map((k) => {
      const n = k as { type?: string; tag?: string; children?: unknown[] }
      if (n.type === 'heading') return n.tag === 'h3' ? 'H3' : 'H2'
      if (n.type === 'list') return `L${(n.children ?? []).length}`
      return 'P'
    })
    .join(' ')
}

/** Ein Fließtext als reiner Text — für den Längenvergleich */
function laenge(wert: unknown): number {
  return richTextZuText(wert).replace(/\s+/g, ' ').trim().length
}

type Befund = {
  id: number | string
  bezeichnung: string
  /** Felder, in denen in dieser Sprache gar nichts steht */
  fehlt: string[]
  /** Felder, in denen etwas steht, das nicht stimmen kann */
  auffaellig: string[]
}

/**
 * Was an einer Sprachfassung fehlt — und was daran nicht stimmt.
 *
 * **Warum das mehr prüft als „leer oder nicht".** So fing es an, und so ging
 * an einem Abend fast alles daneben, was danebengehen konnte:
 *
 * — Die **Beschreibungen** waren nicht dabei. Ein Artikel galt als übersetzt,
 *   während sein längster Text noch leer war.
 * — Vier Artikel trugen **Stummel** aus einer frühen Einspielung: 250 Zeichen,
 *   wo im Deutschen 2.300 standen. Gefüllt ist eben nicht übersetzt.
 * — Zwei Artikel trugen **denselben** fremdsprachigen Text. Eine
 *   Fahrrad-Wandhalterung wurde auf Französisch als beleuchtetes Herz
 *   beschrieben, in beiden Sprachen, monatelang.
 * — Übersetzungen kamen als **Textwüste** zurück, wo das deutsche Original
 *   Zwischenüberschriften und Aufzählungen hatte.
 *
 * Keiner dieser vier Fälle fiel diesem Werkzeug auf. Jetzt fallen alle vier
 * auf. Was es findet, ist bewusst keine Fehlermeldung, sondern ein Hinweis:
 * „auffällig" heißt hinsehen, nicht wegwerfen.
 */
async function fehlendeUebersetzungen(
  payload: Awaited<ReturnType<typeof db>>,
  ziel: Sprache,
  nurBereich?: BereichName,
) {
  const namen = (nurBereich ? [nurBereich] : (Object.keys(UEBERSETZBAR) as BereichName[])).filter(
    Boolean,
  )
  const ergebnis: Record<string, Befund[]> = {}

  for (const name of namen) {
    const { collection, felder, fliesstext, label } = UEBERSETZBAR[name]
    const gemeinsam = {
      collection,
      limit: 200,
      depth: 0,
      ...(collection === 'news' ? { draft: true } : {}),
    }
    const { docs: deutsch } = await payload.find({ ...gemeinsam, locale: 'de' })
    const { docs: uebersetzt } = await payload.find({
      ...gemeinsam,
      locale: ziel,
      fallbackLocale: false,
    })
    const nachId = new Map(uebersetzt.map((d) => [d.id, d as unknown as Record<string, unknown>]))

    /*
     * Derselbe Text an zwei Stellen ist fast nie Absicht.
     *
     * Zwei Artikel mit wortgleicher fremdsprachiger Beschreibung heißt: Beim
     * Nachtragen ist eine Zeile verrutscht. Gesammelt wird über den ganzen
     * Bereich, weil der Fehler zwischen zwei beliebigen Einträgen liegen kann.
     */
    const gesehen = new Map<string, (number | string)[]>()
    for (const d of deutsch) {
      const uebersetztDoc = nachId.get(d.id)
      for (const f of fliesstext) {
        const text = richTextZuText(uebersetztDoc?.[f]).replace(/\s+/g, ' ').trim()
        if (text.length < 40) continue
        const bisher = gesehen.get(text) ?? []
        bisher.push(d.id)
        gesehen.set(text, bisher)
      }
    }
    const doppelt = new Set<number | string>()
    for (const ids of gesehen.values()) if (ids.length > 1) ids.forEach((i) => doppelt.add(i))

    const luecken: Befund[] = []
    for (const d of deutsch) {
      const original = d as unknown as Record<string, unknown>
      const uebersetztDoc = nachId.get(d.id)
      const fehlt: string[] = []
      const auffaellig: string[] = []

      for (const f of felder) {
        const wert = uebersetztDoc?.[f]
        // Nur prüfen, was auf Deutsch überhaupt gefüllt ist — sonst meldet die
        // Liste eine fehlende Übersetzung für etwas, das es nicht gibt
        const deutschLeer = typeof original[f] !== 'string' || !String(original[f]).trim()
        if (deutschLeer) continue
        if (typeof wert !== 'string' || !wert.trim()) fehlt.push(f)
      }

      for (const f of fliesstext) {
        const deutschLaenge = laenge(original[f])
        if (!deutschLaenge) continue
        const zielLaenge = laenge(uebersetztDoc?.[f])
        if (!zielLaenge) {
          fehlt.push(f)
          continue
        }
        if (zielLaenge < deutschLaenge * STUMMEL_ANTEIL) {
          auffaellig.push(
            `${f}: nur ${zielLaenge} von ${deutschLaenge} Zeichen — sieht nach einem Rest aus früherer Zeit aus`,
          )
        }
        const gd = gliederung(original[f])
        const gz = gliederung(uebersetztDoc?.[f])
        if (gd !== gz) {
          auffaellig.push(
            `${f}: Gliederung weicht ab (de: ${gd || '—'} · ${ziel}: ${gz || '—'}) — Zwischenüberschriften und Aufzählungen fehlen`,
          )
        }
        if (doppelt.has(d.id)) {
          auffaellig.push(
            `${f}: wortgleich mit einem anderen Eintrag — beim Nachtragen ist vermutlich eine Zeile verrutscht`,
          )
        }
      }

      if (fehlt.length || auffaellig.length) {
        luecken.push({
          id: d.id,
          bezeichnung: String(original.title ?? original.name ?? original.author ?? d.id),
          fehlt,
          auffaellig,
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
        'Die Arbeitsliste für eine Sprachfassung. Meldet zweierlei: was FEHLT (Feld ist leer) und was AUFFÄLLIG ist (Text vorhanden, aber viel kürzer als das Original, ohne dessen Zwischenüberschriften und Aufzählungen, oder wortgleich mit einem anderen Eintrag). Auffällig heißt hinsehen, nicht wegwerfen. Nachgetragen wird über die jeweiligen *_aendern-Werkzeuge mit sprache.',
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
          ? `Nachtragen über produkt_aendern / referenz_aendern / news_aendern / kategorie_aendern / kundenstimme_aendern mit sprache: '${ziel}'. ` +
            'Die Gliederung des deutschen Originals übernehmen: ## Überschrift, ### kleinere, - Aufzählung, **fett**.'
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
      const statuses = werteVon(BESTELL_STATUS)
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
