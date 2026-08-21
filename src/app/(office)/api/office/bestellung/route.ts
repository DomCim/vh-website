import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { BESTELL_STATUS, werteVon } from '../../../../../lib/listen'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Bestellung im Büro ändern — Status, Sendungsnummer, Termin.
 *
 * Die Mails an die Kundschaft hängen an den Hooks der Sammlung; hier wird
 * nur der Datensatz gesetzt, den Rest macht Payload.
 */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'anfragen.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>
    if (!b.id) return NextResponse.json({ error: 'id-fehlt' }, { status: 400 })

    // Ein Tippfehler im Status liefe sonst bis in die Datenbank durch.
    if (b.status && !werteVon(BESTELL_STATUS).includes(b.status)) {
      return NextResponse.json({ error: 'status-unbekannt' }, { status: 400 })
    }

    // Versand ohne Sendungsnummer wäre für die Kundschaft eine leere Mail
    if (b.status === 'shipped' && !b.trackingNumber?.trim()) {
      return NextResponse.json({ error: 'sendungsnummer-fehlt' }, { status: 400 })
    }

    const doc = await payload.update({
      collection: 'orders',
      id: b.id,
      overrideAccess: true,
      data: {
        status: b.status || undefined,
        trackingNumber: b.trackingNumber || undefined,
        trackingUrl: b.trackingUrl || undefined,
        expectedReady: b.expectedReady || undefined,
      },
    })

    return NextResponse.json({ ok: true, id: doc.id, status: doc.status })
  } catch (err) {
    console.error('Bestellung ändern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
