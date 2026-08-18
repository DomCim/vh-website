import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'

export const dynamic = 'force-dynamic'

/** Stand, mit dem das Image gebaut wurde — beim Bauen als GIT_SHA gesetzt */
const version = (process.env.APP_VERSION || 'unbekannt').slice(0, 7)

/**
 * Health-Check für Monitoring (z.B. Home Assistant, Uptime-Kuma).
 * Prüft App UND Datenbank; gleiches Antwortformat wie das FWG-Portal.
 *
 * `version` verrät, welcher Stand gerade läuft. Damit kann Home Assistant
 * nach einem Ausrollen warten, bis wirklich die neue Fassung antwortet —
 * der Portainer-Webhook ist ja sofort zurück, während drinnen noch gebaut,
 * migriert und gestartet wird.
 */
export async function GET() {
  try {
    const payload = await payloadClient()
    await payload.count({ collection: 'users', overrideAccess: true })
    return NextResponse.json({ status: 'ok', db: true, version })
  } catch {
    return NextResponse.json({ status: 'error', db: false, version }, { status: 503 })
  }
}
