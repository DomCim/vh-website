import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** Inventar-Posten anlegen oder ändern. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'inventar.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    if (!b.name?.trim()) return NextResponse.json({ error: 'name-fehlt' }, { status: 400 })

    const daten = {
      name: b.name,
      type: b.type || 'material',
      quantity: Number(b.quantity) || 0,
      unit: b.unit || 'Stück',
      minQuantity: b.minQuantity ?? undefined,
      unitValue: b.unitValue ?? undefined,
      location: b.location || undefined,
      purchaseDate: b.purchaseDate || undefined,
      purchaseValue: b.purchaseValue ?? undefined,
      notes: b.notes || undefined,
    }

    const doc = b.id
      ? await payload.update({
          collection: 'inventory-items',
          id: b.id,
          overrideAccess: true,
          data: daten,
        })
      : await payload.create({ collection: 'inventory-items', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Inventar speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
