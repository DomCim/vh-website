import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** `2026-38` — Jahr und ISO-Woche, sonst nichts. */
const WOCHE = /^\d{4}-\d{2}$/

/**
 * Wie viele Stunden in einer bestimmten Woche zur Verfügung stehen.
 *
 * Ein Datensatz je Woche, und nur für die Wochen, die von der Faustregel
 * abweichen. Leere Stundenangabe heißt: Der Eintrag verschwindet und es gilt
 * wieder die Voreinstellung — das ist etwas anderes als eine Null, die
 * ausdrücklich „diese Woche geht nichts" bedeutet.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as { woche?: string; stunden?: number | string | null; notiz?: string }
    const woche = String(b.woche ?? '')
    if (!WOCHE.test(woche)) return NextResponse.json({ error: 'woche-ungueltig' }, { status: 400 })

    const { docs } = await payload.find({
      collection: 'workshop-weeks',
      where: { woche: { equals: woche } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const vorhanden = docs[0]

    // Zurück zur Faustregel: Der Eintrag wird entfernt, nicht auf null gesetzt
    if (b.stunden === null || b.stunden === '' || b.stunden === undefined) {
      if (vorhanden) {
        await payload.delete({ collection: 'workshop-weeks', id: vorhanden.id, overrideAccess: true })
      }
      return NextResponse.json({ ok: true, entfernt: true, woche })
    }

    const stunden = Math.min(Math.max(Number(b.stunden) || 0, 0), 168)
    const daten = { woche, stunden, notiz: b.notiz?.trim() || undefined }

    const doc = vorhanden
      ? await payload.update({
          collection: 'workshop-weeks',
          id: vorhanden.id,
          overrideAccess: true,
          data: daten,
        })
      : await payload.create({ collection: 'workshop-weeks', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id, woche, stunden })
  } catch (err) {
    console.error('Werkstattwoche speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
