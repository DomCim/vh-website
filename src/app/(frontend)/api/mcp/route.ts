import { timingSafeEqual } from 'crypto'
import { createMcpHandler } from 'mcp-handler'

import { registerAktionen } from '../../../../lib/mcp/aktionen'
import { registerAnalyse } from '../../../../lib/mcp/analyse'
import { registerAnfragen } from '../../../../lib/mcp/anfragen'
import { registerBestellungen } from '../../../../lib/mcp/bestellungen'
import { registerKategorien } from '../../../../lib/mcp/kategorien'
import { registerKundenstimmen } from '../../../../lib/mcp/kundenstimmen'
import { registerMedien } from '../../../../lib/mcp/medien'
import { registerNews } from '../../../../lib/mcp/news'
import { registerProdukte } from '../../../../lib/mcp/produkte'
import { registerReferenzen } from '../../../../lib/mcp/referenzen'
import { registerSeiten } from '../../../../lib/mcp/seiten'
import { payloadClient } from '../../../../lib/data'
import { type McpServer, nurLesenderServer } from '../../../../lib/mcp/helpers'
import { getIntegrations } from '../../../../lib/settings'

/**
 * MCP-Server zur Verwaltung der Website per KI-Assistent (z.B. Claude).
 *
 * Endpunkt:  POST /api/mcp   (Streamable HTTP)
 * Auth:      Authorization: Bearer <Schlüssel>  oder  ?key=<Schlüssel>
 *
 * Die Schlüssel werden im Admin unter Verwaltung → Integrationen gepflegt;
 * leere Felder fallen auf MCP_API_KEY / MCP_READONLY_API_KEY zurück.
 * Ohne jeden Schlüssel ist der Server deaktiviert.
 *
 * Die Werkzeuge liegen nach Bereichen getrennt in src/lib/mcp/.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function alleWerkzeuge(server: McpServer) {
  registerProdukte(server)
  registerKategorien(server)
  registerReferenzen(server)
  registerKundenstimmen(server)
  registerNews(server)
  registerAktionen(server)
  registerBestellungen(server)
  registerAnfragen(server)
  registerMedien(server)
  registerSeiten(server)
  registerAnalyse(server)
}

const handler = createMcpHandler(
  (server) => alleWerkzeuge(server),
  {
    serverInfo: { name: 'vh-website', version: '2.0.0' },
    instructions: [
      'Verwaltung der Vincent-Hellmann-Website: Produkte, Kategorien, Referenzen (Projekte),',
      'Kundenstimmen, News (inkl. Facebook-/Instagram-Autopost), Rabatt-Aktionen, Bestellungen,',
      'Anfragen, Mediathek, Seitentexte und Auswertungen.',
      '',
      'Sprachen: Die Website ist dreisprachig (de/fr/en). Neue Inhalte entstehen immer auf Deutsch;',
      'Französisch und Englisch danach über dasselbe *_aendern-Werkzeug mit sprache: "fr" bzw. "en"',
      'nachtragen. uebersetzungen_pruefen zeigt, was noch fehlt.',
      '',
      'Seitentexte: vor jedem seite_schreiben zuerst seite_lesen aufrufen — Listen werden komplett ersetzt.',
      '',
      'Fertigung: Es gibt keine Serienfertigung, jedes Stück entsteht einzeln. Produkte tragen eine',
      'Fertigungszeit; Bestellungen durchlaufen bezahlt → in Fertigung (bestellung_in_fertigung) →',
      'versendet (bestellung_versenden, immer mit Sendungsnummer).',
      '',
      'Löschen ist absichtlich zweistufig: ohne bestaetigen: true gibt es nur eine Vorschau.',
    ].join('\n'),
  },
)

/** Zweiter Server für den Nur-Lese-Schlüssel: registriert nur lesende Werkzeuge. */
const nurLeseHandler = createMcpHandler(
  (server) => alleWerkzeuge(nurLesenderServer(server)),
  {
    serverInfo: { name: 'vh-website (nur lesend)', version: '2.0.0' },
    instructions:
      'Nur-Lese-Zugang zur Vincent-Hellmann-Website: Inhalte, Bestellungen, Anfragen und Auswertungen einsehen. Änderungen sind mit diesem Schlüssel nicht möglich.',
  },
)

/** Zeitkonstanter Vergleich, damit sich der Schlüssel nicht erraten lässt */
function gleich(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function schluesselAusAnfrage(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return new URL(req.url).searchParams.get('key')
}

const guarded = async (req: Request) => {
  let vollzugriff: string | undefined
  let nurLesen: string | undefined
  try {
    const { mcp } = await getIntegrations(await payloadClient())
    vollzugriff = mcp.apiKey
    nurLesen = mcp.readonlyKey
  } catch {
    // Datenbank noch nicht bereit → nur Umgebungsvariablen
    vollzugriff = process.env.MCP_API_KEY
    nurLesen = process.env.MCP_READONLY_API_KEY
  }

  if (!vollzugriff && !nurLesen) {
    return new Response(
      'MCP ist deaktiviert — Schlüssel im Admin unter Integrationen hinterlegen.',
      { status: 503 },
    )
  }

  const angeboten = schluesselAusAnfrage(req)
  if (!angeboten) return new Response('Unauthorized', { status: 401 })

  if (vollzugriff && gleich(angeboten, vollzugriff)) return handler(req)
  if (nurLesen && gleich(angeboten, nurLesen)) return nurLeseHandler(req)
  return new Response('Unauthorized', { status: 401 })
}

export { guarded as GET, guarded as POST, guarded as DELETE }
