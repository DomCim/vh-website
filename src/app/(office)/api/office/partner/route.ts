import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'

/** Geschäftspartner anlegen oder ändern — Lieferanten, Kunden, Dienstleister. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    if (!b.name?.trim()) return NextResponse.json({ error: 'name-fehlt' }, { status: 400 })

    const daten = {
      name: b.name,
      role: b.role || 'beides',
      email: b.email || undefined,
      phone: b.phone || undefined,
      line1: b.line1 || undefined,
      postalCode: b.postalCode || undefined,
      city: b.city || undefined,
      country: b.country || 'Frankreich',
      vatId: b.vatId || undefined,
      siret: b.siret || undefined,
      defaultCategory: b.defaultCategory || undefined,
      notes: b.notes || undefined,
    }

    const doc = b.id
      ? await payload.update({ collection: 'contacts', id: b.id, overrideAccess: true, data: daten })
      : await payload.create({ collection: 'contacts', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Geschäftspartner speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
