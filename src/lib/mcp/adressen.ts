import { z } from 'zod'

import { adresseAus, adresseSaeubern } from '../adressen'
import { locales } from '../i18n'
import { db, fehler, findeNachSlug, type McpServer, ok, sprache } from './helpers'

/**
 * Adressen je Sprache — als eigenes Werkzeug, nicht als Feld unter fünfzehn.
 *
 * **Warum getrennt von `produkt_aendern`.** Eine Adresse zu ändern ist keine
 * Textänderung. Sie steht in Lesezeichen, in Mails und im Index von Google;
 * wer sie umstellt, greift in etwas ein, das andere Leute in der Hand haben.
 * Als Feld neben Titel und Beschreibung würde sie irgendwann nebenbei
 * mitgeändert, wenn jemand einen Tippfehler korrigiert. Als eigene Geste
 * nicht.
 *
 * Die Umleitung von der alten auf die neue Adresse entsteht dabei von selbst —
 * dafür sorgt ein Haken an der Sammlung (`adresseMerken`), nicht dieses
 * Werkzeug. So greift sie auch, wenn jemand im Admin umbenennt.
 */

const BEREICHE = {
  produkt: 'products',
  kategorie: 'categories',
} as const

type Bereich = keyof typeof BEREICHE

export function registerAdressen(server: McpServer) {
  server.registerTool(
    'adresse_setzen',
    {
      description:
        'Setzt die Adresse (den URL-Pfad) eines Artikels oder einer Kategorie in einer Sprache. ' +
        'Damit trägt die französische Fassung französische Wörter im Pfad statt deutscher. ' +
        'Die Umleitung von der alten Adresse entsteht automatisch. Leere Adresse = zurück auf den Slug.',
      inputSchema: {
        bereich: z.enum(['produkt', 'kategorie']),
        slug: z
          .string()
          .describe('Der Slug, unter dem das Stück heute geführt wird — die Kennung, nicht die neue Adresse'),
        sprache,
        adresse: z
          .string()
          .describe(
            'Die neue Adresse in dieser Sprache, z.B. "canape-os". Leer lassen setzt sie zurück auf den Slug.',
          ),
      },
    },
    async ({ bereich, slug, sprache: locale, adresse }) => {
      const payload = await db()
      const sammlung = BEREICHE[bereich as Bereich]

      const stueck = await findeNachSlug<{ id: number; title?: string; name?: string }>(
        payload,
        sammlung,
        slug,
      )
      if (!stueck) return fehler(`Unter "${slug}" gibt es nichts in ${bereich}.`)

      /*
       * Eine Adresse braucht eine Sprachfassung.
       *
       * Payload legt übersetzbare Felder in einer eigenen Tabelle ab, eine
       * Zeile je Sprache — und in dieser Zeile ist der Titel Pflicht. Wer
       * einem Artikel ohne französische Fassung eine französische Adresse
       * geben will, bekommt deshalb eine Fehlermeldung über den Titel, die
       * niemand versteht. Die Reihenfolge ist ohnehin die richtige: Eine
       * französische Adresse an einer Seite, die noch deutschen Text zeigt,
       * hilft niemandem.
       */
      const alleFassungen = (await payload.findByID({
        collection: sammlung,
        id: stueck.id,
        locale: 'all' as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      const bezeichnungen = (alleFassungen.title ?? alleFassungen.name) as
        | Record<string, string>
        | undefined
      if (locale !== 'de' && !bezeichnungen?.[locale as string]?.trim()) {
        return fehler(
          `"${slug}" hat noch keine ${String(locale).toUpperCase()}-Fassung. ` +
            `Erst den Text übersetzen (produkt_aendern bzw. kategorie_aendern mit sprache: "${locale}"), ` +
            'dann die Adresse setzen.',
        )
      }

      const sauber = adresseSaeubern(adresse)

      /*
       * Zurücksetzen ist erlaubt und heißt: Es gilt wieder der Slug. Auch das
       * ist ein Umzug — der Haken an der Sammlung merkt die bisherige Adresse
       * und leitet künftig von ihr weiter.
       */
      if (!sauber) {
        await payload.update({
          collection: sammlung,
          id: stueck.id,
          locale: locale as never,
          overrideAccess: true,
          data: { adresse: null } as never,
        })
        return ok({
          ok: true,
          sprache: locale,
          adresse: slug,
          hinweis: 'Zurückgesetzt — es gilt wieder der Slug.',
        })
      }

      /*
       * Ist die Adresse in dieser Sprache schon vergeben? Der Index in der
       * Datenbank verhindert es ohnehin, aber eine Fehlermeldung aus der
       * Datenbank sagt niemandem, wer sie hat.
       */
      for (const wo of ['products', 'categories'] as const) {
        const { docs } = await payload.find({
          collection: wo,
          where: {
            or: [{ adresse: { equals: sauber } }, { slug: { equals: sauber } }],
          },
          locale: locale as never,
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        const belegt = docs[0] as { id?: number; title?: string; name?: string } | undefined
        if (belegt && !(wo === sammlung && belegt.id === stueck.id)) {
          return fehler(
            `"${sauber}" ist in dieser Sprache schon vergeben — an "${belegt.title ?? belegt.name ?? belegt.id}". Adressen müssen je Sprache eindeutig sein.`,
          )
        }
      }

      await payload.update({
        collection: sammlung,
        id: stueck.id,
        locale: locale as never,
        overrideAccess: true,
        data: { adresse: sauber } as never,
      })

      return ok({
        ok: true,
        sprache: locale,
        adresse: sauber,
        ...(sauber !== adresse.trim() ? { bereinigt: `aus "${adresse}" wurde "${sauber}"` } : {}),
        hinweis: 'Die alte Adresse leitet ab sofort dauerhaft hierher.',
      })
    },
  )

  server.registerTool(
    'adressen_pruefen',
    {
      description:
        'Zeigt, welche Artikel und Kategorien in einer Sprache noch die deutsche Adresse tragen. ' +
        'Die Arbeitsliste für „keine deutschen Wörter in französischen URLs".',
      inputSchema: { sprache: z.enum(['fr', 'en']) },
    },
    async ({ sprache: locale }) => {
      const payload = await db()

      const offen: Record<string, { slug: string; bezeichnung: string }[]> = {
        Artikel: [],
        Kategorie: [],
      }
      /*
       * Was noch gar keine Sprachfassung hat, ist keine Adressarbeit, sondern
       * Übersetzungsarbeit — und muss zuerst dran sein.
       */
      const ohneFassung: Record<string, { slug: string; bezeichnung: string }[]> = {
        Artikel: [],
        Kategorie: [],
      }
      const gesetzt: Record<string, { slug: string; adresse: string }[]> = {
        Artikel: [],
        Kategorie: [],
      }

      for (const [bereich, sammlung] of [
        ['Artikel', 'products'],
        ['Kategorie', 'categories'],
      ] as const) {
        const { docs } = await payload.find({
          collection: sammlung,
          limit: 200,
          depth: 0,
          locale: 'all' as never,
          overrideAccess: true,
        })
        for (const d of docs as unknown as Record<string, unknown>[]) {
          const eigene = adresseAus(d, locale)
          const slug = String(d.slug ?? '')
          const name = ((d.title ?? d.name) as Record<string, string> | string | undefined) ?? ''
          const bezeichnung =
            typeof name === 'string' ? name : (name.de ?? Object.values(name)[0] ?? slug)
          if (!slug) continue
          const hatFassung =
            typeof name === 'object' && name ? Boolean(name[locale]?.trim()) : false
          if (!hatFassung) ohneFassung[bereich].push({ slug, bezeichnung })
          else if (eigene === slug) offen[bereich].push({ slug, bezeichnung })
          else gesetzt[bereich].push({ slug, adresse: eigene })
        }
      }

      const anzahlOffen = offen.Artikel.length + offen.Kategorie.length
      const anzahlOhne = ohneFassung.Artikel.length + ohneFassung.Kategorie.length
      return ok({
        sprache: locale,
        nochDeutsch: anzahlOffen,
        offen,
        ohneSprachfassung: anzahlOhne > 0 ? ohneFassung : undefined,
        bereitsGesetzt: gesetzt,
        hinweis:
          anzahlOffen > 0
            ? 'Nachtragen über adresse_setzen mit bereich, slug, sprache und adresse. Erst die Kategorien, dann die Artikel — der Pfad besteht aus beiden. Was unter „ohneSprachfassung" steht, muss zuerst übersetzt werden.'
            : 'Alle Adressen sind in dieser Sprache eigenständig.',
      })
    },
  )

  server.registerTool(
    'adressen_lesen',
    {
      description:
        'Die Adressen eines Artikels oder einer Kategorie in allen Sprachen — samt der Adressen, unter denen es früher zu finden war.',
      inputSchema: {
        bereich: z.enum(['produkt', 'kategorie']),
        slug: z.string(),
      },
    },
    async ({ bereich, slug }) => {
      const payload = await db()
      const sammlung = BEREICHE[bereich as Bereich]
      const stueck = await findeNachSlug<{ id: number }>(payload, sammlung, slug)
      if (!stueck) return fehler(`Unter "${slug}" gibt es nichts in ${bereich}.`)

      const alle = (await payload.findByID({
        collection: sammlung,
        id: stueck.id,
        locale: 'all' as never,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>

      const { docs: verlauf } = await payload.find({
        collection: 'address-history',
        where: {
          and: [{ bereich: { equals: sammlung } }, { dokument: { equals: stueck.id } }],
        },
        sort: '-seit',
        limit: 50,
        depth: 0,
        overrideAccess: true,
      })

      return ok({
        slug,
        adressen: Object.fromEntries(locales.map((l) => [l, adresseAus(alle, l)])),
        frueher: (verlauf as unknown as Record<string, unknown>[]).map((v) => ({
          adresse: v.adresse,
          sprache: v.sprache,
          seit: v.seit,
        })),
      })
    },
  )
}
