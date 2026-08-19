import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'

/** Anfrage im Büro bearbeiten — Status und interne Notiz. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    if (!b.id) return NextResponse.json({ error: 'id-fehlt' }, { status: 400 })

    const doc = await payload.update({
      collection: 'inquiries',
      id: b.id,
      overrideAccess: true,
      data: {
        status: b.status || undefined,
        internalNote: b.internalNote ?? undefined,
      },
    })

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Anfrage ändern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
