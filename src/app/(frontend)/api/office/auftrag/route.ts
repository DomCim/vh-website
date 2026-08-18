import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'

/** Fertigungsauftrag anlegen oder ändern. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    if (!b.title?.trim()) return NextResponse.json({ error: 'titel-fehlt' }, { status: 400 })

    const daten = {
      title: b.title,
      status: b.status || 'geplant',
      customerName: b.customerName || undefined,
      startDate: b.startDate || undefined,
      dueDate: b.dueDate || undefined,
      notes: b.notes || undefined,
      positions: (b.positions ?? [])
        .filter((p: { description?: string }) => p.description?.trim())
        .map((p: Record<string, unknown>) => ({
          description: p.description,
          quantity: Number(p.quantity) || 1,
          price: p.price ?? undefined,
        })),
      material: (b.material ?? [])
        .filter((m: { item?: number }) => m.item)
        .map((m: Record<string, unknown>) => ({
          item: Number(m.item),
          quantity: Number(m.quantity) || 0,
        })),
      source: b.source || 'manuell',
    }

    const doc = b.id
      ? await payload.update({ collection: 'jobs', id: b.id, overrideAccess: true, data: daten })
      : await payload.create({ collection: 'jobs', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id, jobNumber: doc.jobNumber })
  } catch (err) {
    console.error('Auftrag speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
