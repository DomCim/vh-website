import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'

/** Angebot anlegen, ändern oder in Auftrag bzw. Rechnung umwandeln. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    // ── Umwandeln ───────────────────────────────────────────────────────────
    if (b.aktion === 'in-auftrag' || b.aktion === 'in-rechnung') {
      const angebot = await payload
        .findByID({ collection: 'quotes', id: b.id, depth: 0, overrideAccess: true })
        .catch(() => null)
      if (!angebot) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

      if (b.aktion === 'in-auftrag') {
        const auftrag = await payload.create({
          collection: 'jobs',
          overrideAccess: true,
          data: {
            title: angebot.title || `Angebot ${angebot.quoteNumber}`,
            status: 'geplant',
            source: 'angebot',
            customerName: angebot.customerName ?? undefined,
            contact: (angebot.customer as number) ?? undefined,
            quote: angebot.id as number,
            positions: (angebot.items ?? []).map((p) => ({
              description: p.description,
              quantity: p.quantity,
              price: p.unitPrice,
            })),
          },
        })
        return NextResponse.json({ ok: true, auftragId: auftrag.id, nummer: auftrag.jobNumber })
      }

      const rechnung = await payload.create({
        collection: 'outgoing-invoices',
        overrideAccess: true,
        data: {
          status: 'entwurf',
          customerName: angebot.customerName ?? undefined,
          customer: (angebot.customer as number) ?? undefined,
          customerAddress: angebot.customerAddress ?? undefined,
          items: (angebot.items ?? []).map((p) => ({
            description: p.description,
            quantity: p.quantity,
            unit: p.unit ?? 'Stück',
            unitPrice: p.unitPrice,
            vatRate: p.vatRate,
          })),
          note: angebot.note ?? undefined,
          quote: angebot.id as number,
        },
      })
      return NextResponse.json({ ok: true, rechnungId: rechnung.id })
    }

    // ── Anlegen und Ändern ──────────────────────────────────────────────────
    const daten = {
      status: b.status || 'entwurf',
      title: b.title || undefined,
      customerName: b.customerName || undefined,
      customerAddress: b.customerAddress || undefined,
      issueDate: b.issueDate || undefined,
      validUntil: b.validUntil || undefined,
      productionTime: b.productionTime || undefined,
      items: (b.items ?? [])
        .filter((p: { description?: string }) => p.description?.trim())
        .map((p: Record<string, unknown>) => ({
          description: p.description,
          quantity: Number(p.quantity) || 0,
          unit: p.unit || 'Stück',
          unitPrice: Number(p.unitPrice) || 0,
          vatRate: Number(p.vatRate) || 0,
        })),
      note: b.note || undefined,
    }

    const doc = b.id
      ? await payload.update({ collection: 'quotes', id: b.id, overrideAccess: true, data: daten })
      : await payload.create({ collection: 'quotes', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id, quoteNumber: doc.quoteNumber })
  } catch (err) {
    console.error('Angebot speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
