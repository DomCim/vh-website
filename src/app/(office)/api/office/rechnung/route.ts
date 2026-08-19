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

    /*
     * Stornieren — der Weg, den das Formular selbst nennt.
     *
     * Eine gestellte Rechnung wird nicht mehr angefasst: Sie liegt beim
     * Kunden, steht in dessen Buchhaltung und hat eine Nummer, die in der
     * Reihe steht. Korrigiert wird deshalb über eine **eigene** Rechnung mit
     * negativen Beträgen, die aufs Original zeigt. Bisher stand dieser Satz
     * als Hinweis im Formular, und getippt werden musste die Gegenrechnung
     * von Hand — mit jeder Position, jedem Steuersatz und der Gefahr, dass
     * ein Cent abweicht und die Reihe nicht mehr aufgeht.
     *
     * Das Original wird dabei nicht gelöscht und nicht geleert, sondern steht
     * auf „storniert" und zeigt auf sein Storno. Beide Papiere bleiben.
     */
    if (b.aktion === 'stornieren') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

      const original = await payload.findByID({
        collection: 'outgoing-invoices',
        id: b.id,
        depth: 0,
        overrideAccess: true,
      })
      if (!original) return NextResponse.json({ error: 'unbekannt' }, { status: 404 })

      // Ein Entwurf wird verworfen, nicht storniert — er hat keine Nummer,
      // also gibt es nichts aufzuheben.
      if (!original.invoiceNumber) {
        return NextResponse.json({ error: 'entwurf' }, { status: 409 })
      }
      if (original.status === 'storniert' || original.storniertDurch) {
        return NextResponse.json({ error: 'schon-storniert' }, { status: 409 })
      }
      if (original.stornoVon) {
        return NextResponse.json({ error: 'ist-storno' }, { status: 409 })
      }

      const grund = typeof b.grund === 'string' ? b.grund.trim() : ''

      const storno = await payload.create({
        collection: 'outgoing-invoices',
        overrideAccess: true,
        data: {
          status: 'gestellt',
          /*
           * Eine eigene Nummer aus der laufenden Reihe, keine Stufennummer.
           * Das Storno ist keine weitere Rate eines Zahlplans — es hebt eine
           * auf. Als Stufe gezählt verschöbe es den Nenner aller anderen.
           */
          stufe: 'vollstaendig',
          auftrag: original.auftrag as number,
          customer: original.customer as number,
          customerName: original.customerName,
          customerAddress: original.customerAddress,
          customerSiret: original.customerSiret,
          customerVatId: original.customerVatId,
          deliveryAddress: original.deliveryAddress,
          deliveryDate: original.deliveryDate,
          businessType: original.businessType,
          buyerReference: original.buyerReference,
          issueDate: new Date().toISOString(),
          // Spiegelbild: dieselben Positionen, dasselbe Vorzeichen umgedreht.
          // Der Nachlass kommt unverändert mit und dreht sich mit ihnen.
          items: (original.items ?? []).map((p) => ({
            description: p.description,
            quantity: p.quantity,
            unit: p.unit,
            unitPrice: -(Number(p.unitPrice) || 0),
            vatRate: p.vatRate,
          })),
          discountKind: original.discountKind,
          discountValue: original.discountValue,
          discountReason: original.discountReason,
          reverseCharge: Boolean(original.reverseCharge),
          stornoVon: Number(original.id),
          stornoGrund: grund || undefined,
          note: `Storniert die Rechnung ${original.invoiceNumber}${
            grund ? ` — ${grund}` : ''
          }. Aus dieser Rechnung ist nichts zu zahlen.`,
          project: original.project as number,
        },
      })

      await payload.update({
        collection: 'outgoing-invoices',
        id: original.id,
        overrideAccess: true,
        data: {
          status: 'storniert',
          storniertDurch: Number(storno.id),
          stornoGrund: grund || undefined,
        },
      })

      return NextResponse.json({
        ok: true,
        id: storno.id,
        invoiceNumber: storno.invoiceNumber,
        storniert: original.invoiceNumber,
      })
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
