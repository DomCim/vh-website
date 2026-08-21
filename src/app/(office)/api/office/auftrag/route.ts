import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { AUFTRAG_STATUS, werteVon } from '../../../../../lib/listen'
import { darf } from '../../../../../lib/wache'
import { nurGesendete } from '../../../../../lib/teilaenderung'

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

    // Pflicht nur beim Anlegen: Eine Änderung, die den Titel nicht anfasst,
    // muss ihn auch nicht mitschicken.
    if (!b.id && !b.title?.trim()) {
      return NextResponse.json({ error: 'titel-fehlt' }, { status: 400 })
    }

    // Ein Tippfehler im Status liefe sonst bis in die Datenbank durch —
    // und die Übersichten wüssten nicht, in welche Spalte damit.
    if (b.status && !werteVon(AUFTRAG_STATUS).includes(b.status)) {
      return NextResponse.json({ error: 'status-unbekannt' }, { status: 400 })
    }

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
          beigestellt: Boolean(m.beigestellt),
        })),
      /*
       * Der Ablauf kommt vollständig aus dem Formular, wie Positionen und
       * Material. Die Reihenfolge ist die Aussage — deshalb wird die Liste
       * ersetzt und nicht ergänzt.
       */
      arbeitsplan: (b.arbeitsplan ?? [])
        .filter((s: { was?: string }) => s.was?.trim())
        .map((s: Record<string, unknown>) => ({
          was: s.was,
          art: s.art === 'fremd' ? 'fremd' : 'eigen',
          minuten: s.minuten === '' || s.minuten == null ? null : Number(s.minuten) || 0,
          dienstleister: Number(s.dienstleister) || undefined,
          kosten: s.kosten === '' || s.kosten == null ? null : Number(s.kosten) || 0,
          vorlaufTage:
            s.vorlaufTage === '' || s.vorlaufTage == null ? null : Number(s.vorlaufTage) || 0,
          stand: ['offen', 'laeuft', 'erledigt'].includes(String(s.stand)) ? s.stand : 'offen',
          erledigtAm: s.erledigtAm || undefined,
          notiz: s.notiz || undefined,
        })),
      /*
       * Was über die Meldungen entscheidet. `gemeldet` steht bewusst **nicht**
       * dabei: Das schreibt der Auslöser am Datenmodell, und ein Formular, das
       * es mitschickte, könnte einen Versand ungeschehen machen, der längst
       * stattgefunden hat.
       */
      lieferart: (b.lieferart === 'abholung' ? 'abholung' : 'versand') as 'versand' | 'abholung',
      trackingNumber: b.trackingNumber || undefined,
      trackingUrl: b.trackingUrl || undefined,
      kundeEmail: b.kundeEmail || undefined,
      kundeBenachrichtigen: b.kundeBenachrichtigen !== false,
      // Abwahl (`null` bzw. '') muss durchgehen — sonst wird man einen
      // einmal verknüpften Partner nie wieder los.
      contact: b.contact === null || b.contact === '' ? null : Number(b.contact) || undefined,
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

    /* Beim Ändern nur das Gesendete — siehe lib/teilaenderung.ts */
    const doc = b.id
      ? await payload.update({
          collection: 'jobs',
          id: b.id,
          overrideAccess: true,
          data: nurGesendete(b, daten, {
            zahlplan: ['anzahlungProzent', 'zwischenProzent'],
            meilenstein: ['meilensteinBezeichnung', 'meilensteinErreichtAm'],
          }),
        })
      : await payload.create({ collection: 'jobs', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id, jobNumber: doc.jobNumber })
  } catch (err) {
    console.error('Auftrag speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
