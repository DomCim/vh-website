import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Inventur anlegen, zählen und abschließen.
 *
 * Beim Abschließen schreibt die Sammlung die gezählten Mengen ins Inventar
 * zurück und friert den Wert ein — deshalb geht danach keine Änderung mehr.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'inventar.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    if (!b.title?.trim()) return NextResponse.json({ error: 'titel-fehlt' }, { status: 400 })

    const daten = {
      title: b.title,
      date: b.date || new Date().toISOString(),
      status: (b.status === 'abgeschlossen' ? 'abgeschlossen' : 'offen') as
        | 'offen'
        | 'abgeschlossen',
      notes: b.notes || undefined,
      lines: (b.lines ?? [])
        .filter((z: { item?: number }) => z.item)
        .map((z: Record<string, unknown>) => ({
          item: Number(z.item),
          expected: z.expected === null || z.expected === undefined ? undefined : Number(z.expected),
          counted: Number(z.counted) || 0,
          unitValue: z.unitValue === null || z.unitValue === undefined ? undefined : Number(z.unitValue),
          note: (z.note as string) || undefined,
        })),
    }

    if (b.id) {
      const vorher = await payload
        .findByID({ collection: 'stocktakes', id: b.id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (vorher?.status === 'abgeschlossen') {
        return NextResponse.json({ error: 'abgeschlossen' }, { status: 409 })
      }
      const doc = await payload.update({
        collection: 'stocktakes',
        id: b.id,
        overrideAccess: true,
        data: daten,
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    const doc = await payload.create({ collection: 'stocktakes', overrideAccess: true, data: daten })
    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Inventur speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
