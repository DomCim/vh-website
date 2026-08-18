import config from '@payload-config'
import type { createMcpHandler } from 'mcp-handler'
import { getPayload, type CollectionSlug, type Payload } from 'payload'
import { z } from 'zod'

import { slugify } from '../slug'

/**
 * Gemeinsame Bausteine aller MCP-Werkzeuge.
 *
 * Konventionen (bitte beibehalten):
 *  - Werkzeug- und Parameternamen auf Deutsch, snake_case bzw. camelCase
 *  - inputSchema ist ein rohes Objekt aus Zod-Feldern (kein z.object)
 *  - jede Antwort läuft über ok(); "nicht gefunden" über fehler()
 *  - Teil-Updates über conditional spread: ...(x !== undefined && { feld: x })
 */

/** Der Server, den mcp-handler an die Registrierungs-Funktionen übergibt */
export type McpServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0]

export const ok = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
})

export const fehler = (text: string) => ok({ fehler: text })

export async function db(): Promise<Payload> {
  return getPayload({ config })
}

/** Sprachfassung — an jedem lesenden und ändernden Werkzeug */
export const sprache = z
  .enum(['de', 'fr', 'en'])
  .default('de')
  .describe("Sprachfassung: 'de' (Standard), 'fr', 'en'")

export type Sprache = 'de' | 'fr' | 'en'

/** Zeigt beim Lesen nur echte Übersetzungen statt der deutschen Rückfall-Fassung */
export const ohneRueckfall = z
  .boolean()
  .optional()
  .describe('true = keine deutsche Rückfall-Fassung; zeigt, was wirklich übersetzt ist')

/** Löschschutz: ohne bestaetigen=true gibt es nur eine Vorschau */
export const bestaetigen = z
  .boolean()
  .optional()
  .describe('Muss true sein, damit wirklich gelöscht wird. Ohne Angabe: nur Vorschau.')

/** Einheitliche Antwort, wenn eine Löschung noch bestätigt werden muss */
export const bestaetigungNoetig = (was: unknown) =>
  ok({
    bestaetigung_noetig: true,
    loeschen_wuerde: was,
    hinweis: 'Zum wirklichen Löschen denselben Aufruf mit bestaetigen: true wiederholen.',
  })

/** Slugs einer Sammlung zu IDs auflösen (leere Eingabe = leeres Ergebnis) */
export async function resolveIds(
  payload: Payload,
  collection: 'categories' | 'products' | 'projects',
  slugs?: string[],
): Promise<number[]> {
  if (!slugs?.length) return []
  const { docs } = await payload.find({
    collection,
    where: { slug: { in: slugs } },
    limit: 100,
  })
  return docs.map((d) => d.id as number)
}

/** Einen Datensatz über seinen Slug holen; null, wenn es ihn nicht gibt */
export async function findeNachSlug<T = Record<string, unknown>>(
  payload: Payload,
  collection: CollectionSlug,
  slug: string,
  opts: { locale?: Sprache; draft?: boolean; depth?: number } = {},
): Promise<T | null> {
  const { docs } = await payload.find({
    collection,
    where: { slug: { equals: slug } },
    limit: 1,
    ...opts,
  })
  return (docs[0] as T) ?? null
}

/** Lexical-Richtext wieder in lesbaren Fließtext zurückverwandeln */
export function richTextZuText(value: unknown): string {
  const sammle = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''
    const n = node as { type?: string; text?: string; children?: unknown[] }
    if (typeof n.text === 'string') return n.text
    if (!Array.isArray(n.children)) return ''
    const inner = n.children.map(sammle).join('')
    return n.type === 'paragraph' || n.type === 'heading' ? `${inner}\n\n` : inner
  }
  const root = (value as { root?: unknown } | null)?.root
  return root ? sammle(root).trim() : ''
}

/**
 * Werkzeuge, die nur lesen — erkennbar an der Namenskonvention.
 * Alles andere verändert Daten.
 */
export function istLesend(name: string): boolean {
  return (
    name.endsWith('_liste') ||
    name.endsWith('_lesen') ||
    name.endsWith('_pruefen') ||
    name === 'suchen' ||
    name === 'website_check' ||
    name === 'shop_statistik'
  )
}

/**
 * Hüllt den Server so ein, dass nur lesende Werkzeuge registriert werden.
 * Damit taucht beim Nur-Lese-Schlüssel gar nichts Schreibendes in tools/list auf.
 */
export function nurLesenderServer(server: McpServer): McpServer {
  return new Proxy(server, {
    get(ziel, eigenschaft, empfaenger) {
      if (eigenschaft === 'registerTool') {
        return (name: string, ...rest: unknown[]) => {
          if (!istLesend(name)) return undefined
          return (ziel.registerTool as (...args: unknown[]) => unknown)(name, ...rest)
        }
      }
      return Reflect.get(ziel, eigenschaft, empfaenger)
    },
  }) as McpServer
}

/**
 * Freien Slug aus einem Titel bilden. Für Sammlungen ohne autoSlug-Hook
 * (z.B. Kategorien, wo der Slug Pflicht ist).
 */
export async function freierSlug(
  payload: Payload,
  collection: CollectionSlug,
  titel: string,
): Promise<string> {
  const basis = slugify(titel) || 'eintrag'
  let kandidat = basis
  for (let i = 2; i <= 50; i++) {
    const { totalDocs } = await payload.count({
      collection,
      where: { slug: { equals: kandidat } },
      overrideAccess: true,
    })
    if (totalDocs === 0) return kandidat
    kandidat = `${basis}-${i}`
  }
  return `${basis}-${Date.now()}`
}
