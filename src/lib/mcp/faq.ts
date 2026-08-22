import { z } from 'zod'

import { db, type McpServer, ok, ohneRueckfall, sprache } from './helpers'

/**
 * Die häufigen Fragen — eigene Werkzeuge statt „ganze Seite schreiben".
 *
 * Die FAQ liegt in den Website-Einstellungen und ließe sich deshalb schon über
 * `seite_lesen`/`seite_schreiben` pflegen. Nur ist das dort ein Feld unter
 * vierzig: Wer eine Frage ergänzen will, muss die ganze Seite lesen, die Liste
 * vollständig zurückschicken und darf dabei nichts verlieren. Beim ersten
 * Versehen fehlt die Anschrift auf der Seite.
 *
 * Hier geht es um eine Liste, also gibt es Werkzeuge für eine Liste: lesen,
 * eine Frage anhängen, die Liste ersetzen. Angefasst wird ausschließlich das
 * Feld `faq` — alles andere in den Einstellungen bleibt, wie es ist.
 *
 * **Die Fragen sind übersetzt, nicht sprachneutral.** Eine deutsche Frage in
 * der französischen Fassung wäre schlimmer als gar keine; deshalb steht die
 * Sprache an jedem Werkzeug, und geschrieben wird genau in diese Fassung.
 */

const frageSchema = z.object({
  frage: z.string().min(3).describe('Die Frage, wie sie jemand wirklich stellt'),
  antwort: z
    .string()
    .min(3)
    .describe('Die Antwort in ganzen Sätzen — sie soll die Frage beantworten, nicht zum Anruf auffordern'),
})

type Frage = { frage: string; antwort: string }

async function faqLesen(locale: string, ohne?: boolean): Promise<Frage[]> {
  const payload = await db()
  const doc = (await payload.findGlobal({
    slug: 'site-settings',
    locale: locale as 'de',
    depth: 0,
    ...(ohne ? { fallbackLocale: false as const } : {}),
  })) as { faq?: { frage?: string | null; antwort?: string | null }[] | null }

  return (doc.faq ?? [])
    .map((f) => ({ frage: String(f.frage ?? ''), antwort: String(f.antwort ?? '') }))
    .filter((f) => f.frage && f.antwort)
}

async function faqSchreiben(locale: string, fragen: Frage[]): Promise<void> {
  const payload = await db()
  await payload.updateGlobal({
    slug: 'site-settings',
    locale: locale as 'de',
    // Nur dieses eine Feld — der Rest der Einstellungen wird nicht berührt
    data: { faq: fragen } as never,
  })
}

export function registerFaq(server: McpServer) {
  server.registerTool(
    'faq_liste',
    {
      description:
        'Listet die häufigen Fragen der Website (Seite „Maßanfertigung" und aufklappbar im Google-Ergebnis).',
      inputSchema: { sprache, ohneRueckfall },
    },
    async ({ sprache: locale, ohneRueckfall: ohne }) => {
      const fragen = await faqLesen(locale, ohne)
      return ok({ sprache: locale, anzahl: fragen.length, fragen })
    },
  )

  server.registerTool(
    'faq_ergaenzen',
    {
      description:
        'Hängt eine Frage samt Antwort an die FAQ an. Für den Normalfall — die übrigen Fragen bleiben unangetastet.',
      inputSchema: { sprache, frage: frageSchema.shape.frage, antwort: frageSchema.shape.antwort },
    },
    async ({ sprache: locale, frage, antwort }) => {
      const fragen = await faqLesen(locale)
      // Dieselbe Frage nicht zweimal — sie stünde sonst doppelt im Ergebnis
      if (fragen.some((f) => f.frage.trim().toLowerCase() === frage.trim().toLowerCase())) {
        return ok({ sprache: locale, unveraendert: true, grund: 'Diese Frage steht schon da.' })
      }
      const neu = [...fragen, { frage: frage.trim(), antwort: antwort.trim() }]
      await faqSchreiben(locale, neu)
      return ok({ sprache: locale, anzahl: neu.length, fragen: neu })
    },
  )

  server.registerTool(
    'faq_setzen',
    {
      description:
        'Ersetzt die gesamte FAQ-Liste — zum Umsortieren, Umformulieren oder Löschen. Vorher faq_liste aufrufen: Was hier fehlt, ist danach weg.',
      inputSchema: {
        sprache,
        fragen: z
          .array(frageSchema)
          .max(30)
          .describe('Die vollständige neue Liste. Eine leere Liste löscht alle Fragen.'),
      },
    },
    async ({ sprache: locale, fragen }) => {
      const sauber = fragen.map((f) => ({ frage: f.frage.trim(), antwort: f.antwort.trim() }))
      await faqSchreiben(locale, sauber)
      return ok({ sprache: locale, anzahl: sauber.length, fragen: sauber })
    },
  )
}
