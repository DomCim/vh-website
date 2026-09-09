import type { Field, Payload } from 'payload'

import { defaultLocale, type Locale, locales } from './i18n'

/**
 * Adressen je Sprache — und warum sie **neben** dem Slug stehen und nicht in ihm.
 *
 * **Das Ziel.** Die französischen Seiten trugen deutsche Wörter im Pfad:
 * `/fr/moebel/outdoor-sofa-os`. Wer in Frankreich sucht, tippt „canapé“, nicht
 * „moebel“ — und die Adresse ist eines der Signale, an denen ein Suchdienst
 * erkennt, worum es geht.
 *
 * **Der naheliegende Weg war der falsche.** Zuerst sollte der `slug` selbst
 * übersetzbar werden. Die Wanderung dafür sieht harmlos aus, und die
 * Datenbank hat gezeigt, warum sie es nicht ist: Payload legt übersetzbare
 * Felder in einer eigenen Tabelle ab, eine Zeile je Sprache — und in dieser
 * Zeile ist der **Titel Pflicht**. Ein Artikel ohne französische Textfassung
 * hat dort gar keine Zeile. Um ihm eine französische Adresse zu geben, müsste
 * man ihm einen französischen Titel erfinden (nämlich den deutschen), und
 * damit wäre die Übersetzungsliste im Büro entwertet: Alles sähe übersetzt
 * aus. Dazu hätte die erzeugte Wanderung die alte Spalte fallen lassen,
 * **bevor** die Werte kopiert sind — jeder Artikel wäre ohne Adresse
 * dagestanden.
 *
 * **Deshalb additiv.** Der `slug` bleibt, was er ist: die Kennung und die
 * deutsche Adresse. Daneben steht `adresse`, übersetzbar und freiwillig. Leer
 * heißt „es gilt der Slug“. Damit ändert sich am Tag des Ausrollens nichts —
 * und ab dem Tag kann jede Sprache ihre eigene Adresse bekommen, eine nach
 * der anderen.
 */

/** Das Feld, gleich in Artikeln, Kategorien, Beiträgen und Referenzen. */
export function adresseFeld(): Field {
  return {
    name: 'adresse',
    label: 'Adresse in dieser Sprache',
    type: 'text',
    localized: true,
    unique: true,
    index: true,
    admin: {
      description:
        'Leer lassen = es gilt der Slug. Sonst der Pfad in dieser Sprache, z.B. "canape-os". ' +
        'Beim Ändern entsteht die Umleitung von der alten Adresse automatisch.',
    },
  }
}

/** Was in der Adresszeile stehen darf — dieselbe Bereinigung wie beim Slug. */
export function adresseSaeubern(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type MitAdresse = { slug?: string | null; adresse?: string | null }

/**
 * Die maßgebliche Adresse eines Stücks in einer Sprache.
 *
 * **Der Rückfall ist hier gefährlich und deshalb ausgeschaltet.** Payload gibt
 * beim Lesen einer Sprachfassung den deutschen Wert zurück, wenn die eigene
 * leer ist. Für einen Text ist das richtig; für eine Adresse wäre es falsch:
 * Die französische Seite bekäme die **deutsche Adresse** — und die findet
 * unter `/fr/` niemand, weil dort nach der französischen gesucht wird. Wer
 * diese Funktion benutzt, muss das Dokument deshalb mit `locale: 'all'` oder
 * `fallbackLocale: false` geholt haben; `adresseAus` nimmt beide Formen an.
 */
export function adresseAus(doc: MitAdresse | Record<string, unknown>, sprache: Locale): string {
  const roh = (doc as Record<string, unknown>).adresse
  const eigene =
    typeof roh === 'string'
      ? roh
      : roh && typeof roh === 'object'
        ? ((roh as Record<string, unknown>)[sprache] as string | undefined)
        : undefined
  const slug = (doc as MitAdresse).slug
  return (eigene && eigene.trim()) || String(slug ?? '')
}

/** Die Adressen eines Stücks in allen Sprachen — für Sitemap und hreflang. */
export function adressenAllerSprachen(doc: Record<string, unknown>): Record<Locale, string> {
  const eintrag = {} as Record<Locale, string>
  for (const l of locales) eintrag[l] = adresseAus(doc, l)
  return eintrag
}

export type Fund<T> = {
  doc: T
  /** Die Adresse, unter der das Stück in dieser Sprache zu Hause ist */
  kanonisch: string
  /** Gerufen wurde etwas anderes — dann gehört eine dauerhafte Umleitung dorthin */
  umleiten: boolean
}

/**
 * Ein Stück zu einer gerufenen Adresse finden — in fünf Stufen.
 *
 * Die Reihenfolge ist die Rangfolge: Was zuerst trifft, gewinnt.
 *
 *  1. Die **Adresse dieser Sprache**. Der Normalfall, keine Umleitung.
 *  2. Der **Slug**. So heißen heute alle Adressen; solange keine eigene
 *     Adresse gesetzt ist, ist das der Normalfall. Hat das Stück inzwischen
 *     eine eigene Adresse in dieser Sprache, wird dorthin umgeleitet.
 *  3. Die Adresse **einer anderen Sprache**. Klingt weit hergeholt, ist aber
 *     der häufigste Fehlgriff: ein weitergegebener Link auf `/fr/…` mit der
 *     deutschen Adresse darin. Statt eines 404 gibt es die Umleitung.
 *  4. Der **Adressverlauf** — was einmal galt und umbenannt wurde.
 *  5. Nichts. Dann ist es wirklich ein 404.
 */
export async function findeNachAdresse<T extends Record<string, unknown>>(
  payload: Payload,
  sammlung: 'products' | 'categories' | 'news' | 'projects',
  gerufen: string,
  sprache: Locale,
  zusatz?: Record<string, unknown>,
): Promise<Fund<T> | null> {
  const und = (bedingung: Record<string, unknown>) => ({
    and: [bedingung, ...(zusatz ? [zusatz] : [])],
  })

  const holen = async (where: Record<string, unknown>, locale: 'all' | Locale) => {
    const { docs } = await payload.find({
      collection: sammlung,
      where: where as never,
      locale: locale as never,
      limit: 1,
      depth: 1,
      overrideAccess: true,
    })
    return docs[0] as unknown as T | undefined
  }

  /** Das Stück noch einmal mit allen Sprachen, um die maßgebliche Adresse zu kennen */
  const kanonischeAdresse = async (id: unknown): Promise<string> => {
    const alle = (await payload
      .findByID({ collection: sammlung, id: id as number, locale: 'all' as never, depth: 0, overrideAccess: true })
      .catch(() => null)) as Record<string, unknown> | null
    return alle ? adresseAus(alle, sprache) : gerufen
  }

  const fertig = async (doc: T): Promise<Fund<T>> => {
    const kanonisch = await kanonischeAdresse(doc.id)
    return { doc, kanonisch, umleiten: kanonisch !== gerufen }
  }

  // 1. Die Adresse dieser Sprache
  const eigene = await holen(und({ adresse: { equals: gerufen } }), sprache)
  if (eigene) return { doc: eigene, kanonisch: gerufen, umleiten: false }

  // 2. Der Slug
  const ueberSlug = await holen(und({ slug: { equals: gerufen } }), sprache)
  if (ueberSlug) return fertig(ueberSlug)

  // 3. Die Adresse einer anderen Sprache
  const fremd = await holen(und({ adresse: { equals: gerufen } }), 'all')
  if (fremd) {
    const wieder = await holen(und({ id: { equals: fremd.id } }), sprache)
    if (wieder) return fertig(wieder)
  }

  // 4. Der Adressverlauf
  const { docs: verlauf } = await payload.find({
    collection: 'address-history',
    where: {
      and: [
        { bereich: { equals: sammlung } },
        { sprache: { equals: sprache } },
        { adresse: { equals: gerufen } },
      ],
    },
    sort: '-seit',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const spur = verlauf[0] as { dokument?: number } | undefined
  if (spur?.dokument) {
    const frueher = await holen(und({ id: { equals: spur.dokument } }), sprache)
    if (frueher) return fertig(frueher)
  }

  return null
}

/**
 * Die Adressen mehrerer Stücke in einer Sprache — für Listen und Kacheln.
 *
 * Eine Liste holt ihre Stücke mit Rückfall (sonst stünde in der französischen
 * Fassung kein Titel). Genau dieser Rückfall macht die Adresse unbrauchbar,
 * deshalb hier eine zweite, schmale Abfrage über **alle** Sprachen: Sie kostet
 * eine Anfrage je Seite und liefert für jedes Stück die Adresse, unter der es
 * in dieser Sprache wirklich zu Hause ist.
 */
export async function adressenFuer(
  payload: Payload,
  sammlung: 'products' | 'categories',
  ids: (number | string)[],
  sprache: Locale,
): Promise<Map<string, string>> {
  const karte = new Map<string, string>()
  if (ids.length === 0) return karte
  const { docs } = await payload.find({
    collection: sammlung,
    where: { id: { in: ids } },
    locale: 'all' as never,
    limit: ids.length,
    depth: 0,
    overrideAccess: true,
  })
  for (const d of docs as unknown as Record<string, unknown>[]) {
    karte.set(String(d.id), adresseAus(d, sprache))
  }
  return karte
}

/** Die Sprache, in der geschrieben wird — 'all' und leer zählen als Deutsch. */
export function spracheOder(locale: unknown): Locale {
  return typeof locale === 'string' && (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : defaultLocale
}
