import config from '@payload-config'
import type { createMcpHandler } from 'mcp-handler'
import { getPayload, type CollectionSlug, type Payload } from 'payload'
import { z } from 'zod'

import { richTextZuText } from '../richtextText'
import { slugify } from '../slug'
import { freigabePruefen, type Freigabestand } from './leitplanken'

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

/**
 * Richtext lesbar herausgeben — mit derselben Auszeichnung, die beim
 * Schreiben angenommen wird.
 *
 * **Hier stand einmal eine eigene Umwandlung, und die hat Schaden angerichtet.**
 * Sie gab nur den nackten Text zurück: Fettungen fielen weg, und die Punkte
 * einer Aufzählung klebten ohne Trennzeichen aneinander
 * („…witterungsbeständigMassive Holz-Tischplatte…"). Das sah nach kaputten
 * Daten aus, war aber heil — kaputt war das Lesen. Wer daraufhin den Text
 * „richtete" und zurückschrieb, hat die Auszeichnung dann wirklich gelöscht;
 * einmal passiert, an einer Artikelbeschreibung im laufenden Betrieb.
 *
 * Dieselbe Falle steckt im Übersetzen: Eine Fassung, die aus dem entschärften
 * Text entsteht, hat keine Fettungen mehr — und es fällt niemandem auf, weil
 * die Kontrolle wieder durch dasselbe Werkzeug läuft.
 *
 * Deshalb dieselbe Umwandlung wie überall sonst. Sie ist verlustfrei in beide
 * Richtungen, und eine Prüfung hält das fest. Damit ist es gleich, ob jemand
 * die Seite ansieht oder das Werkzeug fragt.
 */
export { richTextZuText }

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

/** Das Feld, mit dem ein änderndes Werkzeug seine Leitplanken-Freigabe nachweist */
export const freigabe = z
  .string()
  .describe(
    'Freigabe aus leitplanken_lesen. Ohne gültige Freigabe wird nichts geändert — ' +
      'das Werkzeug zuerst aufrufen und den Wert von dort übernehmen.',
  )

const FREIGABE_TEXT: Record<Exclude<Freigabestand, 'ok'>, string> = {
  fehlt:
    'Keine Freigabe dabei. Bitte zuerst leitplanken_lesen aufrufen, die Hausregeln lesen ' +
    'und die Freigabe von dort als Parameter „freigabe" mitgeben.',
  ungueltig:
    'Diese Freigabe stimmt nicht. Sie stammt aus leitplanken_lesen und wird unverändert ' +
    'übernommen — bitte dort eine neue holen.',
  abgelaufen:
    'Die Freigabe ist abgelaufen (sie gilt eine Stunde). Bitte leitplanken_lesen erneut ' +
    'aufrufen; die Hausregeln stehen dort noch einmal.',
}

/**
 * Fängt Ausnahmen eines Werkzeugs und macht eine ordentliche Antwort daraus.
 *
 * Vorher hatte kein einziges der schreibenden Werkzeuge ein try/catch: Jeder
 * Datenbank- oder Validierungsfehler blies als Ausnahme durchs Protokoll und
 * der Assistent bekam einen Stacktrace statt eines Satzes. Zentral gefangen
 * gilt es auch für jedes künftige Werkzeug — dieselbe Begründung wie beim
 * Freigabe-Proxy darunter.
 */
function abgesichert(name: string, handler: unknown) {
  return async (...args: unknown[]) => {
    try {
      return await (handler as (...a: unknown[]) => unknown)(...args)
    } catch (err) {
      console.error(`MCP-Werkzeug ${name} fehlgeschlagen:`, err)
      const grund = err instanceof Error ? err.message : 'unbekannter Fehler'
      return fehler(
        `Das hat nicht geklappt (${name}): ${grund} — im Zweifel wurde nichts geändert. ` +
          'Bitte die Eingaben prüfen oder es dem Büro sagen.',
      )
    }
  }
}

/**
 * Hüllt den Server so ein, dass jedes **ändernde** Werkzeug eine gültige
 * Leitplanken-Freigabe verlangt.
 *
 * Der Weg über einen Proxy ist hier kein Kunststück, sondern das Gegenteil:
 * Er hält die Regel an **einer** Stelle. Jedes Werkzeug einzeln um einen
 * Parameter zu ergänzen hieße, das nächste zu vergessen — und zwar das, das
 * nächsten Monat jemand schreibt. So ist jedes künftige Werkzeug von selbst
 * dahinter, sobald sein Name nicht auf `_lesen` oder `_liste` endet.
 *
 * Der Parameter wird dem Schema angehängt und vor dem Aufruf geprüft; das
 * Werkzeug selbst sieht ihn nie und muss ihn nicht kennen.
 */
export function mitLeitplanken(server: McpServer): McpServer {
  return new Proxy(server, {
    get(ziel, eigenschaft, empfaenger) {
      if (eigenschaft !== 'registerTool') return Reflect.get(ziel, eigenschaft, empfaenger)

      return (name: string, beschreibung: Record<string, unknown>, handler: unknown) => {
        if (istLesend(name)) {
          return (ziel.registerTool as (...args: unknown[]) => unknown)(
            name,
            beschreibung,
            abgesichert(name, handler),
          )
        }

        const erweitert = {
          ...beschreibung,
          inputSchema: { ...(beschreibung.inputSchema as object), freigabe },
        }

        const bewacht = async (eingabe: Record<string, unknown>, rest: unknown) => {
          const stand = freigabePruefen(eingabe?.freigabe)
          if (stand !== 'ok') return fehler(FREIGABE_TEXT[stand])
          /*
           * Das Protokoll, das die Leitplanken versprechen: Werkzeug und
           * Freigabe-Kennung je schreibendem Aufruf. Bewusst eine Logzeile
           * und keine eigene Sammlung — gelesen wird das bei „wer hat das
           * geändert?" über die Container-Logs, und eine Sammlung wäre ein
           * zweiter Datenbestand, den niemand pflegt und aufräumt.
           */
          const kennung = String(eingabe?.freigabe ?? '').split('.')[2] ?? '?'
          console.info(
            `MCP-Schreibzugriff ${name} (Freigabe ${kennung}) um ${new Date().toISOString()}`,
          )
          return (handler as (a: unknown, b: unknown) => unknown)(eingabe, rest)
        }

        return (ziel.registerTool as (...args: unknown[]) => unknown)(
          name,
          erweitert,
          abgesichert(name, bewacht),
        )
      }
    },
  }) as McpServer
}

/**
 * Hüllt den Server so ein, dass nur lesende Werkzeuge registriert werden.
 * Damit taucht beim Nur-Lese-Schlüssel gar nichts Schreibendes in tools/list auf.
 */
export function nurLesenderServer(server: McpServer): McpServer {
  return new Proxy(server, {
    get(ziel, eigenschaft, empfaenger) {
      if (eigenschaft === 'registerTool') {
        return (name: string, beschreibung: unknown, handler: unknown) => {
          if (!istLesend(name)) return undefined
          return (ziel.registerTool as (...args: unknown[]) => unknown)(
            name,
            beschreibung,
            abgesichert(name, handler),
          )
        }
      }
      return Reflect.get(ziel, eigenschaft, empfaenger)
    },
  }) as McpServer
}

/**
 * Slugs streng auflösen: sagt auch, welche es **nicht** gibt.
 *
 * `resolveIds` gibt bei Tippfehlern still eine kürzere Liste zurück — für
 * Aktionen hieß das: „gilt für Kategorie X" mit vertipptem Slug wurde
 * erfolgreich angelegt und galt für nichts. Wer schreibt, nutzt diese
 * Fassung und bricht bei Fehlendem ab.
 */
export async function resolveIdsStrikt(
  payload: Payload,
  collection: 'categories' | 'products' | 'projects',
  slugs?: string[],
): Promise<{ ids: number[]; fehlend: string[] }> {
  if (!slugs?.length) return { ids: [], fehlend: [] }
  const { docs } = await payload.find({
    collection,
    where: { slug: { in: slugs } },
    limit: 100,
  })
  const gefunden = new Set(docs.map((d) => (d as { slug?: string }).slug ?? ''))
  return {
    ids: docs.map((d) => d.id as number),
    fehlend: slugs.filter((s) => !gefunden.has(s)),
  }
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
