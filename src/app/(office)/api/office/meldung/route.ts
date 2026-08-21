import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Meldungen abhaken.
 *
 * Angelegt werden sie nur vom Programm (siehe `lib/push.ts`); von Hand gibt es
 * hier nichts zu schreiben. Was bleibt, ist der Haken — und der geht denselben
 * engen Weg wie das Abhaken einer Wiedervorlage: `{ aktion, id }` und sonst
 * nichts, damit eine Liste nicht versehentlich Text überschreibt.
 *
 * Das Recht ist `buero.oeffnen` und nicht enger: Seine eigenen Meldungen zu
 * lesen ist keine Befugnis, die man jemandem entzieht.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    if (b.aktion === 'gelesen' || b.aktion === 'ungelesen') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const gelesen = b.aktion === 'gelesen'
      const doc = await payload.update({
        collection: 'notifications',
        id: b.id,
        overrideAccess: true,
        data: { gelesen, gelesenAm: gelesen ? new Date().toISOString() : null },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    /*
     * Alles abhaken, aber nur bis zu einem Zeitpunkt.
     *
     * Ohne `bis` verschluckte der Knopf eine Meldung, die eintraf, während das
     * Blatt offen stand — sie wäre gelesen, ohne je gelesen worden zu sein.
     */
    if (b.aktion === 'allesGelesen') {
      const jetzt = new Date().toISOString()
      const ergebnis = await payload.update({
        collection: 'notifications',
        where: {
          and: [
            { gelesen: { equals: false } },
            ...(b.bis ? [{ zuletztAm: { less_than_equal: String(b.bis) } }] : []),
          ],
        },
        overrideAccess: true,
        data: { gelesen: true, gelesenAm: jetzt },
      })
      return NextResponse.json({ ok: true, anzahl: ergebnis.docs?.length ?? 0 })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Meldung ändern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
