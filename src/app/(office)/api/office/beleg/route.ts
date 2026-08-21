import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** Beleg anlegen oder ändern — aus der Büro-Oberfläche. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'belege.erfassen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    // 0,00 € ist ein gültiger Beleg — Gutschrift, Ersatzlieferung, Nullrechnung.
    // Ein schlichtes `!b.grossAmount` hatte genau die abgewiesen. Leer bleibt
    // leer: Ein Beleg ganz ohne Betrag ist weiterhin unvollständig.
    if (
      b.grossAmount == null ||
      b.grossAmount === '' ||
      !Number.isFinite(Number(b.grossAmount)) ||
      !b.invoiceDate
    ) {
      return NextResponse.json({ error: 'pflichtfelder' }, { status: 400 })
    }

    const daten = {
      title: b.title || undefined,
      supplierName: b.supplierName || undefined,
      invoiceNumber: b.invoiceNumber || undefined,
      invoiceDate: b.invoiceDate,
      dueDate: b.dueDate || null,
      netAmount: b.netAmount ?? undefined,
      vatRate: b.vatRate ?? undefined,
      vatAmount: b.vatAmount ?? undefined,
      grossAmount: b.grossAmount,
      category: b.category || 'sonstiges',
      paymentMethod: b.paymentMethod || undefined,
      paid: Boolean(b.paid),
      deductible: Boolean(b.deductible),
      notes: b.notes || undefined,
      document: b.documentId ?? null,
      ...(b.extraction ? { extraction: b.extraction } : {}),
    }

    const doc = b.id
      ? await payload.update({ collection: 'expenses', id: b.id, overrideAccess: true, data: daten })
      : await payload.create({ collection: 'expenses', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Beleg speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
