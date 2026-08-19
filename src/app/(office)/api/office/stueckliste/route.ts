import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Stückliste und Dienstleister eines Artikels speichern.
 *
 * Der Artikel selbst wird in der Website-Verwaltung gepflegt — hier geht es
 * nur um Materialbedarf und Fremdleistung, die ins Büro gehören.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'website.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      produktId?: number
      zeilen?: { item?: number; quantity?: number; note?: string }[]
      dienstleister?: {
        contact?: number
        service?: string
        cost?: number
        leadTime?: string
        note?: string
      }[]
      arbeitsminuten?: number
    }
    if (!b.produktId) return NextResponse.json({ error: 'produktId fehlt' }, { status: 400 })

    await payload.update({
      collection: 'products',
      id: b.produktId,
      overrideAccess: true,
      data: {
        productionMinutes:
          typeof b.arbeitsminuten === 'number' ? Math.max(0, Math.round(b.arbeitsminuten)) : undefined,
        billOfMaterials: (b.zeilen ?? [])
          .filter((z) => z.item && z.quantity)
          .map((z) => ({ item: z.item as number, quantity: z.quantity as number, note: z.note })),
        serviceProviders: (b.dienstleister ?? [])
          .filter((d) => d.contact && d.service?.trim())
          .map((d) => ({
            contact: d.contact as number,
            service: d.service as string,
            cost: d.cost,
            leadTime: d.leadTime,
            note: d.note,
          })),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Stückliste speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
