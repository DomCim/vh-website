import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Wareneingang anlegen.
 *
 * Gebucht wird nicht hier, sondern am Datenmodell (collections/GoodsReceipts):
 * So greift es auch, wenn ein Wareneingang aus dem Admin-Panel oder über den
 * KI-Zugang entsteht — und es passiert genau einmal.
 *
 * Geändert wird ein bestehender Wareneingang nur in seinen Angaben
 * (Lieferscheinnummer, Foto, Notiz, zugehöriger Beleg). Die Zeilen bleiben,
 * wie sie gebucht wurden: Wer sich vertan hat, bucht am Posten eine
 * Korrektur — dann steht im Verlauf, dass korrigiert wurde, statt dass eine
 * Zahl still eine andere wird.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'inventar.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    const angaben = {
      receivedAt: b.receivedAt || new Date().toISOString(),
      deliveryNote: b.deliveryNote || undefined,
      supplier: b.supplier ? Number(b.supplier) : null,
      supplierName: b.supplierName || undefined,
      document: b.document ? Number(b.document) : null,
      expense: b.expense ? Number(b.expense) : null,
      note: b.note || undefined,
    }

    if (b.id) {
      const doc = await payload.update({
        collection: 'goods-receipts',
        id: b.id,
        overrideAccess: true,
        data: angaben,
      })
      return NextResponse.json({ ok: true, id: doc.id, receiptNumber: doc.receiptNumber })
    }

    const zeilen = (b.lines ?? [])
      .filter((z: { item?: number; quantity?: number }) => z.item && Number(z.quantity) > 0)
      .map((z: { item: number; quantity: number; note?: string }) => ({
        item: Number(z.item),
        quantity: Number(z.quantity),
        note: z.note || undefined,
      }))

    if (!zeilen.length) return NextResponse.json({ error: 'keine-posten' }, { status: 400 })

    const doc = await payload.create({
      collection: 'goods-receipts',
      overrideAccess: true,
      data: { ...angaben, lines: zeilen },
    })

    return NextResponse.json({ ok: true, id: doc.id, receiptNumber: doc.receiptNumber })
  } catch (err) {
    console.error('Wareneingang speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
