import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { zustandMerken } from '../../../../lib/sicherung'
import { wartungslauf } from '../../../../lib/wartung'

export const dynamic = 'force-dynamic'
// Der Lauf kann die nächtliche Sicherung enthalten — die braucht Zeit.
export const maxDuration = 3600

/** Bearer-Schlüssel prüfen; ohne CRON_SECRET ist der Endpunkt zu. */
function erlaubt(req: Request): boolean {
  const geheim = process.env.CRON_SECRET
  if (!geheim) return false
  const kopf = req.headers.get('authorization') ?? ''
  return kopf === `Bearer ${geheim}`
}

/**
 * Wartungslauf — gedacht für einen Cron im Viertelstundentakt, der ihn mit
 * `curl -fsS -H "Authorization: Bearer $CRON_SECRET" .../api/wartung` aufruft.
 *
 * Was ansteht, entscheidet der Lauf selbst: nächtliche Sicherung, Erinnerung
 * an fällige Belege, Aufräumen kurzlebiger Daten und die Frage, ob irgendwo
 * etwas stillsteht.
 */
export async function GET(req: Request) {
  if (!erlaubt(req)) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 401 })

  const payload = await payloadClient()
  const bericht = await wartungslauf(payload)
  return NextResponse.json({ ok: true, ...bericht })
}

/**
 * Lebenszeichen von außen — für Aufgaben, die nicht in der App laufen.
 * Beispiel: `POST /api/wartung?aufgabe=sicherung&ok=true`.
 */
export async function POST(req: Request) {
  if (!erlaubt(req)) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 401 })

  const url = new URL(req.url)
  const aufgabe = (url.searchParams.get('aufgabe') ?? '').replace(/[^a-z0-9-]/gi, '')
  if (!aufgabe) return NextResponse.json({ error: 'aufgabe-fehlt' }, { status: 400 })

  const ok = url.searchParams.get('ok') !== 'false'
  const rumpf = (await req.json().catch(() => ({}))) as { hinweis?: string }
  const payload = await payloadClient()
  await zustandMerken(payload, aufgabe, { ok, note: rumpf.hinweis?.slice(0, 300) })
  return NextResponse.json({ ok: true })
}
