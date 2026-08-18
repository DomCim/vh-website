import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'

/**
 * Stoppuhr und Zeitbuchungen an einem Auftrag.
 *
 * Bewusst eine einzige laufende Uhr je Auftrag: Wer in der Werkstatt steht,
 * arbeitet an einem Stück, nicht an dreien gleichzeitig. Beim Stoppen wird
 * die Zeit auf volle Minuten gerundet und als Buchung abgelegt — die Uhr
 * selbst hält nichts fest, sie merkt sich nur den Beginn.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      id?: string | number
      aktion?: 'start' | 'stop' | 'nachtragen' | 'loeschen'
      minuten?: number
      notiz?: string
      index?: number
    }
    if (!b.id || !b.aktion) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

    const auftrag = (await payload.findByID({
      collection: 'jobs',
      id: b.id,
      depth: 0,
      overrideAccess: true,
    })) as Record<string, any>
    if (!auftrag) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    // Payload will beim Schreiben keine Nullwerte in den optionalen Feldern
    const buchungen: { day?: string; minutes: number; note?: string }[] = (
      auftrag.timeEntries ?? []
    ).map((b: Record<string, unknown>) => ({
      day: (b.day as string) ?? undefined,
      minutes: (b.minutes as number) ?? 0,
      note: (b.note as string) ?? undefined,
    }))

    if (b.aktion === 'start') {
      await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: { runningSince: new Date().toISOString() },
      })
      return NextResponse.json({ ok: true, laeuftSeit: new Date().toISOString() })
    }

    if (b.aktion === 'stop') {
      if (!auftrag.runningSince) return NextResponse.json({ error: 'laeuft-nicht' }, { status: 409 })
      const minuten = Math.max(
        1,
        Math.round((Date.now() - new Date(auftrag.runningSince).getTime()) / 60000),
      )
      buchungen.push({
        day: new Date().toISOString(),
        minutes: minuten,
        note: b.notiz?.trim() || undefined,
      })
      await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: { runningSince: null, timeEntries: buchungen },
      })
      return NextResponse.json({ ok: true, minuten })
    }

    if (b.aktion === 'nachtragen') {
      const minuten = Math.round(Number(b.minuten) || 0)
      if (minuten < 1) return NextResponse.json({ error: 'keine-zeit' }, { status: 400 })
      buchungen.push({
        day: new Date().toISOString(),
        minutes: minuten,
        note: b.notiz?.trim() || undefined,
      })
      await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: { timeEntries: buchungen },
      })
      return NextResponse.json({ ok: true, minuten })
    }

    if (b.aktion === 'loeschen' && typeof b.index === 'number') {
      buchungen.splice(b.index, 1)
      await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: { timeEntries: buchungen },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Zeitbuchung fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
