import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { liveKarteErzeugen } from '../../../../../lib/live'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Eintrittskarte für die Live-Verbindung.
 *
 * Der Server, der die Verbindungen hält, kennt Payload nicht und kann eine
 * Anmeldung nicht selbst prüfen. Also passiert das hier — an einer ganz
 * normalen, geprüften Stelle — und die Seite legt die kurzlebige Karte beim
 * Verbinden vor.
 */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  return NextResponse.json({ karte: liveKarteErzeugen(user.id) })
}
