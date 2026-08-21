import fs from 'fs/promises'
import path from 'path'

import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../../lib/data'
import { ABLAGE, ablageName, dateiEintragen } from '../../../../../../../lib/dateiAblage'
import { lieferscheinDokument } from '../../../../../../../lib/dokumente'
import { darf } from '../../../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/*
 * Eine Unterschrift ist ein paar Striche — mehr als ein Viertel Megabyte
 * PNG ist keine Unterschrift, sondern ein Foto.
 */
const MAX_BYTES = 400 * 1024

/**
 * Die Abnahme mit Unterschrift auf dem Telefon.
 *
 * Beim Kunden vor Ort: Auftrag öffnen, „Abnahme", der Kunde unterschreibt mit
 * dem Finger. Daraus entsteht das Abnahmeprotokoll — der Lieferschein mit der
 * Unterschrift auf der Empfangslinie — als PDF bei den Vorgangsdateien, und
 * der Auftrag merkt sich Zeitpunkt, Name und Ort. Ab dann läuft die
 * Gewährleistung, und bei Streit liegt das eine Blatt vor, das zählt.
 *
 * Das braucht Netz: Das Protokoll entsteht am Server, und eine Abnahme, die
 * erst Stunden später aus einer Warteschlange auftaucht, trüge den falschen
 * Zeitpunkt. Der Zeitpunkt kommt deshalb vom Gerät mit — wie bei der
 * Zeiterfassung — und wird nur grob plausibilisiert.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const { id } = await params
    const b = (await req.json()) as {
      unterschrift?: string
      name?: string
      ort?: string
      zeitpunkt?: string
    }

    const treffer = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(b.unterschrift ?? '')
    if (!treffer) return NextResponse.json({ error: 'keine-unterschrift' }, { status: 400 })
    const bild = Buffer.from(treffer[1], 'base64')
    if (bild.length < 200 || bild.length > MAX_BYTES) {
      return NextResponse.json({ error: 'keine-unterschrift' }, { status: 400 })
    }

    const gemeldet = b.zeitpunkt ? new Date(b.zeitpunkt) : new Date()
    const datum =
      Number.isFinite(gemeldet.getTime()) && gemeldet.getTime() <= Date.now() + 60_000
        ? gemeldet
        : new Date()

    const auftrag = await payload.findByID({
      collection: 'jobs',
      id,
      depth: 0,
      overrideAccess: true,
    })
    if (!auftrag) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })
    if (auftrag.abnahme?.am) {
      // Eine zweite Unterschrift überschriebe das Protokoll der ersten —
      // und genau das darf ein Abnahmeprotokoll nie.
      return NextResponse.json({ error: 'schon-abgenommen' }, { status: 409 })
    }

    const name = (b.name ?? '').trim().slice(0, 120) || null
    const ort = (b.ort ?? '').trim().slice(0, 120) || null

    const unterlage = await lieferscheinDokument(payload, id, { bild, name, ort, datum })

    // Das Protokoll zu den Vorgangsdateien — dort liegt es beim Auftrag,
    // sichtbar für die Werkstatt, und übersteht jede weitere Änderung.
    const datei = ablageName(unterlage.dateiname)
    await fs.mkdir(ABLAGE, { recursive: true })
    await fs.writeFile(path.join(ABLAGE, datei), unterlage.datei)
    await dateiEintragen(payload, datei, unterlage.datei.length, unterlage.dateiname, {
      auftrag: auftrag.id,
      herkunft: 'haus',
      folder: 'Abnahme',
      note: [`Abnahme${name ? ` durch ${name}` : ''}`, ort].filter(Boolean).join(', '),
    })

    await payload.update({
      collection: 'jobs',
      id,
      overrideAccess: true,
      data: { abnahme: { am: datum.toISOString(), name, ort } },
    })

    return NextResponse.json({ ok: true, dateiname: unterlage.dateiname })
  } catch (err) {
    console.error('Abnahme fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
