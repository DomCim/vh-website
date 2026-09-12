import { z } from 'zod'

import { bestaetigen, bestaetigungNoetig, db, fehler, type McpServer, ok } from './helpers'
import { merkmaleLesen } from '../kalender/merkmale'
import { wegwerfen } from '../wegwerfen'

/**
 * Termine anlegen, ansehen und absagen.
 *
 * **Warum es das braucht.** Ein Termin im Kalender ist schnell eingetragen —
 * ein *öffentlicher* nicht. Der entsteht dadurch, dass in der Notiz Merker
 * stehen:
 *
 *     #öffentlich
 *     #beschreibung: Hier stelle ich meine *Werke* aus.
 *     #beschreibung:fr: J'expose mes *œuvres*.
 *     #ort: Parc des Expositions, Nancy
 *     #link: https://…
 *
 * Das ist für das Telefon gedacht und dort auch richtig so (siehe
 * `kalender/merkmale.ts`): Die Kalender-App kennt nur Titel, Ort, Zeit und
 * Notiz, und über die Notiz kommt alles durch. Nur muss man die Schreibweise
 * im Kopf haben, und ein Tippfehler heißt: Der Termin steht nicht im Netz,
 * und niemand sieht warum.
 *
 * Hier gibt man stattdessen Felder an, und die Merker entstehen von selbst.
 *
 * **Was bewusst nicht passiert:** Bestehende Notizen werden nicht
 * umgeschrieben. Wer einen Termin vom Telefon aus angelegt hat, behält seine
 * Zeilen; `termin_oeffentlich_machen` hängt nur an, was fehlt.
 */

const sprachen = ['de', 'fr', 'en'] as const

const mehrsprachig = z
  .object({
    de: z.string().optional(),
    fr: z.string().optional(),
    en: z.string().optional(),
  })
  .optional()

/**
 * Aus den Angaben die Merker-Zeilen bauen.
 *
 * Reihenfolge wie in der Anleitung: erst das Flag, dann die Texte. Mehrzeilige
 * Beschreibungen sind erlaubt — gelesen wird bis zur nächsten Zeile, die mit
 * `#` beginnt.
 */
export function merkerBauen(angaben: {
  oeffentlich?: boolean
  abgesagt?: boolean
  beschreibung?: Partial<Record<(typeof sprachen)[number], string>>
  ort?: string
  link?: string
  bild?: string
}): string {
  const zeilen: string[] = []
  if (angaben.oeffentlich) zeilen.push('#öffentlich')
  if (angaben.abgesagt) zeilen.push('#absage')
  for (const sprache of sprachen) {
    const text = angaben.beschreibung?.[sprache]?.trim()
    if (!text) continue
    // Deutsch ist die Vorgabe und trägt kein Kürzel
    zeilen.push(sprache === 'de' ? `#beschreibung: ${text}` : `#beschreibung:${sprache}: ${text}`)
  }
  if (angaben.ort?.trim()) zeilen.push(`#ort: ${angaben.ort.trim()}`)
  if (angaben.link?.trim()) zeilen.push(`#link: ${angaben.link.trim()}`)
  if (angaben.bild?.trim()) zeilen.push(`#bild: ${angaben.bild.trim()}`)
  return zeilen.join('\n')
}

/** Ein Zeitpunkt, wie ihn ein Mensch schreibt — und was daraus wird. */
function zeitpunkt(wert: string): string | null {
  const roh = wert.trim()
  // Nur ein Tag: dann beginnt er um Mitternacht, das passt zu „ganztägig"
  const nurTag = /^\d{4}-\d{2}-\d{2}$/.test(roh)
  const d = new Date(nurTag ? `${roh}T00:00:00` : roh)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export function registerTermine(server: McpServer) {
  server.registerTool(
    'termine_liste',
    {
      description:
        'Die kommenden Termine im Kalender, mit dem Hinweis, welche davon öffentlich auf der Website stehen.',
      inputSchema: {
        ab: z.string().optional().describe('Tag im Format 2026-09-12; ohne Angabe: heute'),
        nur_oeffentliche: z.boolean().optional(),
      },
    },
    async ({ ab, nur_oeffentliche }) => {
      const payload = await db()
      const von = ab ? zeitpunkt(ab) : new Date().toISOString()
      if (!von) return fehler('Das Datum konnte ich nicht lesen — bitte als 2026-09-12.')

      const { docs } = await payload.find({
        collection: 'appointments',
        where: { start: { greater_than_equal: von } },
        sort: 'start',
        limit: 100,
        depth: 0,
      })

      const zeilen = docs.map((t) => {
        const m = merkmaleLesen((t as { notiz?: string | null }).notiz)
        return {
          id: t.id,
          titel: t.title,
          beginn: t.start,
          ende: t.ende ?? null,
          ganztaegig: Boolean(t.ganztaegig),
          ort: t.ort ?? m.ort.de ?? null,
          oeffentlich: m.oeffentlich,
          abgesagt: m.abgesagt,
        }
      })
      const gefiltert = nur_oeffentliche ? zeilen.filter((z) => z.oeffentlich) : zeilen
      return ok({ anzahl: gefiltert.length, termine: gefiltert })
    },
  )

  server.registerTool(
    'termin_anlegen',
    {
      description:
        'Legt einen Termin im Kalender an. Mit oeffentlich=true steht er zusätzlich auf der Website — die dafür nötigen Merker in der Notiz entstehen von selbst.',
      inputSchema: {
        titel: z.string().describe('Worum geht es? Steht so im Kalender und auf der Website.'),
        von: z
          .string()
          .describe('Beginn: 2026-09-20 für einen ganzen Tag, oder 2026-09-20T10:00 mit Uhrzeit'),
        bis: z.string().optional().describe('Ende; ohne Angabe endet der Termin am selben Tag'),
        ganztaegig: z.boolean().optional(),
        ort: z.string().optional(),
        oeffentlich: z
          .boolean()
          .optional()
          .describe('Steht der Termin auf der Website? Vorgabe: nein'),
        beschreibung: mehrsprachig.describe(
          'Text für die Website, je Sprache. Ohne fr/en gilt überall der deutsche Text.',
        ),
        link: z.string().optional().describe('Weiterführende Adresse, z.B. die Seite des Marktes'),
        notiz: z.string().optional().describe('Interne Notiz — steht nicht auf der Website'),
        freigabe: z.string().describe('Freigabe aus leitplanken_lesen'),
      },
    },
    async ({ titel, von, bis, ganztaegig, ort, oeffentlich, beschreibung, link, notiz, freigabe }) => {
      const payload = await db()
      const start = zeitpunkt(von)
      if (!start) return fehler('Den Beginn konnte ich nicht lesen — bitte als 2026-09-20T10:00.')
      const ende = bis ? zeitpunkt(bis) : null
      if (bis && !ende) return fehler('Das Ende konnte ich nicht lesen — bitte als 2026-09-20T16:00.')
      if (ende && ende < start) return fehler('Das Ende liegt vor dem Beginn.')

      /*
       * Ein öffentlicher Termin ohne Beschreibung ist eine Zeile ohne Inhalt.
       * Lieber hier nachfragen als später eine Website-Seite, auf der nur ein
       * Datum steht.
       */
      if (oeffentlich && !beschreibung?.de?.trim()) {
        return fehler(
          'Für einen öffentlichen Termin braucht es eine Beschreibung (mindestens auf Deutsch) — sie steht auf der Website unter dem Titel.',
        )
      }

      const merker = merkerBauen({ oeffentlich, beschreibung, ort, link })
      const volleNotiz = [merker, notiz?.trim()].filter(Boolean).join('\n\n')

      const termin = await payload.create({
        collection: 'appointments',
        overrideAccess: true,
        data: {
          title: titel,
          start,
          ende: ende ?? undefined,
          ganztaegig: Boolean(ganztaegig),
          ort: ort || undefined,
          notiz: volleNotiz || undefined,
          quelle: 'mcp',
        },
        context: { freigabe },
      })

      return ok({
        id: termin.id,
        titel: termin.title,
        beginn: termin.start,
        oeffentlich: Boolean(oeffentlich),
        hinweis: oeffentlich
          ? 'Steht ab sofort unter /termine auf der Website.'
          : 'Nur im Kalender des Büros.',
      })
    },
  )

  server.registerTool(
    'termin_loeschen',
    {
      description:
        'Wirft einen Termin in den Papierkorb — für versehentlich angelegte. Was nur ausfällt, gehört abgesagt statt gelöscht (termin_absagen): Der Termin bleibt dann als Absage sichtbar. Ohne bestaetigen=true nur Vorschau.',
      inputSchema: {
        id: z.number().describe('Kennung aus termine_liste'),
        bestaetigen,
        freigabe: z.string().describe('Freigabe aus leitplanken_lesen'),
      },
    },
    async ({ id, bestaetigen: jetzt, freigabe }) => {
      const payload = await db()
      const termin = await payload
        .findByID({ collection: 'appointments', id, depth: 0 })
        .catch(() => null)
      if (!termin) return fehler(`Termin ${id} gibt es nicht.`)
      if (!jetzt) return bestaetigungNoetig({ id, titel: termin.title, beginn: termin.start })

      // In den Papierkorb, nicht endgültig weg — von dort holt die
      // Verwaltung ihn zurück, wenn es doch der falsche war.
      await wegwerfen(payload, 'termine', id)
      void freigabe
      return ok({ ok: true, geloescht: termin.title })
    },
  )

  server.registerTool(
    'termin_absagen',
    {
      description:
        'Sagt einen Termin ab. Er bleibt im Kalender stehen und wird auf der Website als abgesagt gekennzeichnet — gelöscht wird nichts.',
      inputSchema: {
        id: z.number().describe('Kennung aus termine_liste'),
        freigabe: z.string().describe('Freigabe aus leitplanken_lesen'),
      },
    },
    async ({ id, freigabe }) => {
      const payload = await db()
      const termin = await payload
        .findByID({ collection: 'appointments', id, depth: 0 })
        .catch(() => null)
      if (!termin) return fehler(`Termin ${id} gibt es nicht.`)

      const notiz = String((termin as { notiz?: string | null }).notiz ?? '')
      if (merkmaleLesen(notiz).abgesagt) return ok({ id, hinweis: 'War schon abgesagt.' })

      /*
       * Angehängt, nicht ersetzt: Was am Telefon eingetragen wurde, bleibt
       * stehen. Die Absage ist eine Zeile mehr, keine Überschreibung.
       */
      await payload.update({
        collection: 'appointments',
        id,
        overrideAccess: true,
        data: { notiz: [notiz, '#absage'].filter(Boolean).join('\n') },
        context: { freigabe },
      })
      return ok({ id, titel: termin.title, hinweis: 'Als abgesagt gekennzeichnet.' })
    },
  )
}
