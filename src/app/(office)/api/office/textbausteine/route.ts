import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'

/**
 * Die Textbausteine fürs Schreibfeld.
 *
 * Bewusst nur Titel und Inhalt und nur für Angemeldete: Die Bausteine liegen
 * in den Integrationen, aber der Rest davon (Zugangsdaten!) hat im Browser
 * nichts verloren. Gepflegt wird unter Einstellungen → Integrationen —
 * dafür braucht es das Einstellungsrecht, benutzen darf sie jeder im Büro.
 */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const integrationen = await payload.findGlobal({ slug: 'integrations', depth: 0 })
  const bausteine = (integrationen.textbausteine ?? [])
    .filter((b) => b.titel && b.inhalt)
    .map((b) => ({ titel: b.titel, inhalt: b.inhalt }))

  return NextResponse.json({ bausteine })
}
