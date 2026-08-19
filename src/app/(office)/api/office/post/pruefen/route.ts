import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../lib/data'
import { postfachPruefen } from '../../../../../../lib/wartung'
import { darf } from '../../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Schaut in den Postfächern nach und meldet neue Post.
 *
 * Im laufenden Betrieb macht das der Server von selbst (siehe
 * src/instrumentation.ts). Dieser Endpunkt bleibt für zwei Fälle: von Hand
 * anstoßen, wenn man nicht warten will, und für einen Takt von außen — etwa
 * aus Home Assistant.
 *
 * Zugang entweder als angemeldeter Inhaber oder mit dem Schlüssel aus
 * CRON_SECRET im Kopf `Authorization: Bearer …`.
 */
export async function GET(req: Request) {
  const payload = await payloadClient()

  const geheim = process.env.CRON_SECRET
  const kopf = req.headers.get('authorization') ?? ''
  const perSchluessel = Boolean(geheim && kopf === `Bearer ${geheim}`)

  if (!perSchluessel) {
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'postfach.lesen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }
  }

  const ergebnis = await postfachPruefen(payload)
  return NextResponse.json({ ok: true, faecher: ergebnis.length, ergebnis })
}
