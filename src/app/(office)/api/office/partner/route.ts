import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { passwortErzeugen, passwortVerwahren } from '../../../../../lib/uebergabe'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/** Geschäftspartner anlegen oder ändern — Lieferanten, Kunden, Dienstleister. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'partner.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as Record<string, any>

    /*
     * PIN für den Laufmarken-Zugang erzeugen oder erneuern — ein enger Weg,
     * wie `termin` am Auftrag: Er fasst nur den Zugang an, nichts sonst.
     *
     * Der Klartext steht **nur in dieser Antwort**. Gespeichert wird der
     * scrypt-Abdruck; wer den PIN verliert, bekommt hier einen neuen — den
     * alten kennt danach niemand mehr, auch die Datenbank nicht. Der PIN ist
     * dauerhaft: Erneuert wird nur auf diesen Knopf, nie von selbst.
     */
    if (b.aktion === 'markenPin') {
      if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })
      const pin = passwortErzeugen(8)
      await payload.update({
        collection: 'contacts',
        id: b.id,
        overrideAccess: true,
        data: {
          markenZugang: { pin: passwortVerwahren(pin), gesetztAm: new Date().toISOString() },
        },
      })
      return NextResponse.json({ ok: true, pin })
    }

    if (!b.name?.trim()) return NextResponse.json({ error: 'name-fehlt' }, { status: 400 })

    const daten = {
      name: b.name,
      role: b.role || 'beides',
      email: b.email || undefined,
      phone: b.phone || undefined,
      line1: b.line1 || undefined,
      postalCode: b.postalCode || undefined,
      city: b.city || undefined,
      country: b.country || 'Frankreich',
      vatId: b.vatId || undefined,
      siret: b.siret || undefined,
      defaultCategory: b.defaultCategory || undefined,
      // Sprache der Statusmails — auswerten tut sie lib/auftragsmeldung.ts
      sprache: b.sprache || undefined,
      notes: b.notes || undefined,
    }

    const doc = b.id
      ? await payload.update({ collection: 'contacts', id: b.id, overrideAccess: true, data: daten })
      : await payload.create({ collection: 'contacts', overrideAccess: true, data: daten })

    return NextResponse.json({ ok: true, id: doc.id })
  } catch (err) {
    console.error('Geschäftspartner speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
