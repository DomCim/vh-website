import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'

export const dynamic = 'force-dynamic'

/**
 * Health-Check für Monitoring (z.B. Home Assistant, Uptime-Kuma).
 * Prüft App UND Datenbank; gleiches Antwortformat wie das FWG-Portal.
 */
export async function GET() {
  try {
    const payload = await payloadClient()
    await payload.count({ collection: 'users', overrideAccess: true })
    return NextResponse.json({ status: 'ok', db: true })
  } catch {
    return NextResponse.json({ status: 'error', db: false }, { status: 503 })
  }
}
