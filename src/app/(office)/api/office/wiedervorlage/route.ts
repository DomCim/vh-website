import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Wiedervorlagen anlegen, ändern, abhaken.
 *
 * Das Recht ist `buero.oeffnen` und nicht enger: Sich selbst etwas
 * aufzuschreiben ist keine Befugnis, die man jemandem entzieht. Wer die Tür
 * zum Büro hat, darf sich einen Zettel schreiben.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    /*
     * Abhaken ist ein eigener, enger Weg — wie bei Rechnungen und Aufträgen.
     * Wer von einer Liste aus nur `{ id, done }` schickte, träfe sonst auch
     * `title` und `dueDate` und leerte damit die Wiedervorlage.
     */
    if (b.aktion === 'erledigt' || b.aktion === 'offen') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const erledigt = b.aktion === 'erledigt'
      const doc = await payload.update({
        collection: 'follow-ups',
        id: b.id,
        overrideAccess: true,
        data: { done: erledigt, doneAt: erledigt ? new Date().toISOString() : null },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    if (b.aktion === 'loeschen') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      await payload.delete({ collection: 'follow-ups', id: b.id, overrideAccess: true })
      return NextResponse.json({ ok: true, id: b.id })
    }

    if (!b.title?.trim()) return NextResponse.json({ error: 'titel-fehlt' }, { status: 400 })
    if (!b.dueDate) return NextResponse.json({ error: 'datum-fehlt' }, { status: 400 })

    const daten = {
      title: String(b.title).trim(),
      dueDate: b.dueDate,
      note: b.note || undefined,
      done: Boolean(b.done),
      contact: b.contact ? Number(b.contact) : null,
      job: b.job ? Number(b.job) : null,
      quote: b.quote ? Number(b.quote) : null,
      invoice: b.invoice ? Number(b.invoice) : null,
      /*
       * Ein neu gesetztes Datum soll wieder melden dürfen. Ohne dieses
       * Zurücksetzen bliebe eine verschobene Wiedervorlage für den Rest des
       * Tages stumm — genau an dem Tag, auf den jemand sie gerade gelegt hat.
       */
      remindedAt: null,
    }

    const doc = b.id
      ? await payload.update({
          collection: 'follow-ups',
          id: b.id,
          overrideAccess: true,
          data: daten,
        })
      : await payload.create({
          collection: 'follow-ups',
          overrideAccess: true,
          data: { ...daten, createdBy: (user as { id: number }).id },
        })

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Wiedervorlage speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
