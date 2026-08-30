import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { neueKennung } from '../../../../../lib/kalender/ical'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Termine anlegen, ändern, löschen — der Weg aus dem Büro.
 *
 * Das Gegenstück zu CalDAV: Was hier entsteht, steht Sekunden später auch am
 * Telefon, und was am Telefon entsteht, steht hier. Dieselbe Sammlung, zwei
 * Türen.
 */

/** Was für einen Termin genügen muss. */
function geprueft(b: Record<string, any>) {
  const titel = String(b.title ?? '').trim()
  if (!titel) return { fehler: 'Ohne Titel geht es nicht' as const }
  if (!b.start) return { fehler: 'Ohne Beginn geht es nicht' as const }

  const start = new Date(b.start)
  if (Number.isNaN(start.getTime())) return { fehler: 'Der Beginn ist kein Datum' as const }

  const ende = b.ende ? new Date(b.ende) : null
  if (ende && Number.isNaN(ende.getTime())) return { fehler: 'Das Ende ist kein Datum' as const }

  /*
   * Ein Ende vor dem Beginn ist kein Termin, sondern ein Vertipper. Am
   * Telefon erschiene er gar nicht — iCalendar wirft solche Einträge
   * wortlos weg, und niemand wüsste, warum der Termin fehlt.
   */
  if (ende && ende.getTime() < start.getTime()) {
    return { fehler: 'Das Ende liegt vor dem Beginn' as const }
  }

  return {
    daten: {
      title: titel,
      start: start.toISOString(),
      ende: ende ? ende.toISOString() : null,
      ganztaegig: Boolean(b.ganztaegig),
      ort: b.ort ? String(b.ort).trim() : null,
      notiz: b.notiz ? String(b.notiz).trim() : null,
      contact: b.contact ?? null,
      job: b.job ?? null,
    },
  }
}

export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    const { fehler, daten } = geprueft(b)
    if (fehler || !daten) return NextResponse.json({ error: fehler }, { status: 400 })

    if (b.id) {
      const doc = await payload.update({
        collection: 'appointments',
        id: b.id,
        overrideAccess: true,
        data: daten,
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    const doc = await payload.create({
      collection: 'appointments',
      overrideAccess: true,
      data: {
        ...daten,
        // Die Kennung entsteht beim Anlegen und bleibt dann, was sie ist —
        // das Telefon erkennt den Termin daran wieder
        uid: neueKennung(),
        quelle: 'buero',
        createdBy: user.id,
      },
    })
    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

    await payload.delete({ collection: 'appointments', id, overrideAccess: true })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
