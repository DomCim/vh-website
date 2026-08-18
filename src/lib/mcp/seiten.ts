import type { GlobalSlug } from 'payload'
import { z } from 'zod'

import { db, fehler, type McpServer, ohneRueckfall, ok, sprache } from './helpers'

/**
 * Die redaktionell pflegbaren Seitentexte (Payload-Globals).
 *
 * Bewusst NICHT dabei: das Global "integrations" — dort liegen SMTP-, Stripe-,
 * PayPal- und Facebook-Zugangsdaten.
 */
const SEITEN = {
  startseite: 'homepage',
  'ueber-uns': 'about',
  einstellungen: 'site-settings',
  rechtliches: 'legal',
} as const

type SeitenName = keyof typeof SEITEN

const seiteEnum = z
  .enum(['startseite', 'ueber-uns', 'einstellungen', 'rechtliches'])
  .describe(
    'startseite = Hero-Slider/Mission/Highlights, ueber-uns = Werkstatt-Geschichte/Zeitleiste, einstellungen = Kontakt/Social/SEO/Handarbeits-Hinweis, rechtliches = Impressum/Datenschutz/AGB',
  )

export function registerSeiten(server: McpServer) {
  // ── Seitentexte ───────────────────────────────────────────────────────────
  server.registerTool(
    'seite_lesen',
    {
      description:
        'Liest den kompletten Inhalt einer Seite. Vor jedem seite_schreiben aufrufen — sonst gehen beim Speichern Felder verloren.',
      inputSchema: { seite: seiteEnum, sprache, ohneRueckfall },
    },
    async ({ seite, sprache: locale, ohneRueckfall: ohne }) => {
      const payload = await db()
      const slug = SEITEN[seite as SeitenName] as GlobalSlug
      const doc = await payload.findGlobal({
        slug,
        locale,
        depth: 0,
        ...(ohne ? { fallbackLocale: false as const } : {}),
      })
      const { id, updatedAt, createdAt, globalType, ...felder } = doc as unknown as Record<
        string,
        unknown
      >
      void id
      void updatedAt
      void createdAt
      void globalType
      return ok({ seite, sprache: locale, felder })
    },
  )

  server.registerTool(
    'seite_schreiben',
    {
      description:
        'Überschreibt Felder einer Seite. WICHTIG: vorher seite_lesen aufrufen und nur die geänderten Felder mitschicken — Listen (Hero-Slider, Zeitleiste, Highlights, Werte) müssen immer vollständig übergeben werden, weil sie komplett ersetzt werden. Mit sprache=fr/en wird die jeweilige Sprachfassung geschrieben.',
      inputSchema: {
        seite: seiteEnum,
        sprache,
        felder: z
          .record(z.string(), z.unknown())
          .describe('Die zu setzenden Felder mit den Namen aus seite_lesen'),
      },
    },
    async ({ seite, sprache: locale, felder }) => {
      if (!felder || Object.keys(felder).length === 0) {
        return fehler('Keine Felder angegeben — erst seite_lesen aufrufen.')
      }
      const payload = await db()
      const slug = SEITEN[seite as SeitenName] as GlobalSlug
      await payload.updateGlobal({
        slug,
        locale,
        data: felder as never,
      })
      return ok({
        ok: true,
        seite,
        sprache: locale,
        gesetzteFelder: Object.keys(felder),
      })
    },
  )
}
