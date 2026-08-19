import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** Fertigungsauftrag anlegen oder ändern. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    /*
     * Termin verschieben ist ein eigener, enger Weg.
     *
     * Alles darunter baut den vollständigen Datensatz und schreibt ihn. Wer
     * von einer Leiste aus nur `{ id, dueDate }` schickte, träfe damit auch
     * `positions: []` und `material: []` — und löschte Stückliste und
     * Positionen des Auftrags. Ein Klick, und der Auftrag ist leer.
     *
     * Dieselbe Falle wie bei den Rechnungen; weitere schmale Änderungen
     * gehören genauso hier oben angelegt und nicht unten drangehängt.
     */
    if (b.aktion === 'termin') {
      if (!b.id || !b.dueDate) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const doc = await payload.update({
        collection: 'jobs',
        id: b.id,
        overrideAccess: true,
        data: { dueDate: b.dueDate },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    if (!b.title?.trim()) return NextResponse.json({ error: 'titel-fehlt' }, { status: 400 })

    const daten = {
      title: b.title,
      status: b.status || 'geplant',
      customerName: b.customerName || undefined,
      startDate: b.startDate || undefined,
      dueDate: b.dueDate || undefined,
      // Leer heißt „nicht geschätzt" und nicht „null Stunden" — sonst zählte
      // ein Auftrag ohne Angabe als kostenlos in der Auslastung
      plannedMinutes:
        b.plannedMinutes === '' || b.plannedMinutes == null ? null : Number(b.plannedMinutes) || 0,
      notes: b.notes || undefined,
      positions: (b.positions ?? [])
        .filter((p: { description?: string }) => p.description?.trim())
        .map((p: Record<string, unknown>) => ({
          description: p.description,
          quantity: Number(p.quantity) || 1,
          price: p.price ?? undefined,
          // Nur für das Bild auf den Papieren — siehe Jobs.positions.product
          product: Number(p.product) || undefined,
        })),
      material: (b.material ?? [])
        .filter((m: { item?: number }) => m.item)
        .map((m: Record<string, unknown>) => ({
          item: Number(m.item),
          quantity: Number(m.quantity) || 0,
        })),
      source: b.source || 'manuell',
      customerOrderRef: b.customerOrderRef || undefined,
      orderedAt: b.orderedAt || undefined,
      zahlplan: {
        anzahlungProzent: Number(b.anzahlungProzent) || 0,
        zwischenProzent: Number(b.zwischenProzent) || 0,
      },
      /*
       * Das Datum am Meilenstein legt die Zwischenrechnung an. Es kommt
       * deshalb genauso aus dem Formular wie alles andere — der Auslöser sitzt
       * am Datenmodell, nicht hier, damit er auch greift, wenn die Änderung
       * aus dem Admin oder vom KI-Zugang kommt.
       */
      meilenstein: {
        bezeichnung: b.meilensteinBezeichnung || undefined,
        erreichtAm: b.meilensteinErreichtAm || undefined,
      },
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
