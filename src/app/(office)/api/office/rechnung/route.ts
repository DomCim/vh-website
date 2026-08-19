import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** Rechnung anlegen oder ändern. Die Nummer vergibt der beforeChange-Hook. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'rechnungen.schreiben'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    /*
     * „Zahlung eingegangen" ist ein eigener, enger Weg.
     *
     * Alles darunter baut den vollständigen Datensatz und schreibt ihn. Wer
     * von einer Liste aus nur `{ id, status }` schickte, träfe damit auch
     * `items: []` — und löschte sämtliche Positionen der Rechnung. Ein Klick,
     * und eine festgeschriebene Rechnung ist leer.
     *
     * Deshalb hier oben abgefangen: Es wird genau das gesetzt, worum es geht.
     */
    if (b.aktion === 'bezahlt') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const doc = await payload.update({
        collection: 'outgoing-invoices',
        id: b.id,
        overrideAccess: true,
        data: { status: 'bezahlt', paidDate: b.paidDate || new Date().toISOString() },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    const daten = {
      status: b.status || 'entwurf',
      customerName: b.customerName || undefined,
      customerAddress: b.customerAddress || undefined,
      customerSiret: b.customerSiret || undefined,
      customerVatId: b.customerVatId || undefined,
      deliveryAddress: b.deliveryAddress || undefined,
      deliveryDate: b.deliveryDate || undefined,
      businessType: b.businessType || 'lieferung',
      buyerReference: b.buyerReference || undefined,
      issueDate: b.issueDate || undefined,
      dueDate: b.dueDate || undefined,
      paidDate: b.status === 'bezahlt' ? (b.paidDate ?? new Date().toISOString()) : b.paidDate,
      items: (b.items ?? [])
        .filter((p: { description?: string }) => p.description?.trim())
        .map((p: Record<string, unknown>) => ({
          description: p.description,
          quantity: Number(p.quantity) || 0,
          unit: p.unit || 'Stück',
          unitPrice: Number(p.unitPrice) || 0,
          vatRate: Number(p.vatRate) || 0,
        })),
      reverseCharge: Boolean(b.reverseCharge),
      note: b.note || undefined,
    }

    const doc = b.id
      ? await payload.update({
          collection: 'outgoing-invoices',
          id: b.id,
          overrideAccess: true,
          data: daten,
        })
      : await payload.create({
          collection: 'outgoing-invoices',
          overrideAccess: true,
          data: daten,
        })

    return NextResponse.json({ ok: true, id: doc.id, invoiceNumber: doc.invoiceNumber })
  } catch (err) {
    console.error('Rechnung speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
