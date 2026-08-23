import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * „Gelesen bis hier" — die Marke für den Neuerungen-Banner.
 *
 * Gesetzt wird sie, wenn jemand die Seite „Neuerungen" öffnet oder den Banner
 * wegklickt. Geschrieben wird ausschließlich am **eigenen** Konto: Die Nummer
 * kommt aus dem Aufruf, das Konto aus der Anmeldung — es gibt hier keine
 * Kennung, mit der sich ein fremdes Konto ansprechen ließe.
 *
 * Sie geht nur vorwärts. Zwei offene Geräte melden sonst gegeneinander: Das
 * Tablet, das noch einen älteren Stand im Speicher hat, setzte die Marke des
 * Rechners zurück, und der Banner käme wieder.
 *
 * Das Recht ist `buero.oeffnen` und nicht enger — zu wissen, was sich am Haus
 * geändert hat, ist keine Befugnis, die man jemandem entzieht.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const koerper = (await req.json()) as { gesehen?: unknown }
    const gesehen = Number(koerper.gesehen)
    if (!Number.isFinite(gesehen) || gesehen < 0) {
      return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
    }

    const bisher = Number((user as { neuerungGesehen?: number | null }).neuerungGesehen ?? 0)
    if (gesehen <= bisher) return NextResponse.json({ ok: true, gesehen: bisher })

    await payload.update({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      data: { neuerungGesehen: gesehen },
    })
    return NextResponse.json({ ok: true, gesehen })
  } catch (err) {
    console.error('Neuerungen abhaken fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
