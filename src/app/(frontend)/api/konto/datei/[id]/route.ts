import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../lib/data'
import { ABLAGE } from '../../../../../../lib/dateiAblage'
import { SITZUNGS_COOKIE, sitzungLesen } from '../../../../../../lib/kundenportal'
import { darfAngebotSehen, darfAuftragSehen } from '../../../../../../lib/portalDaten'
import { fuerKunden } from '../../../../../../lib/uebergabe'

export const dynamic = 'force-dynamic'

/**
 * Eine Unterlage aus dem Portal herunterladen.
 *
 * Zwei Prüfungen, und beide sind nötig: Die Datei muss an einem Vorgang
 * hängen, der dieser Adresse gehört, **und** für die Kundschaft bestimmt sein.
 * Ohne die zweite wäre die Nummer in der Adresse ein Schlüssel auf das
 * Kalkulationsblatt zum eigenen Auftrag.
 *
 * Ausgeliefert wird als Strom von der Platte — eine Zeichnung kann groß sein,
 * und über den Arbeitsspeicher zu gehen wäre bei 500 MB ein Ausfall.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const email = sitzungLesen((await cookies()).get(SITZUNGS_COOKIE)?.value)
    if (!email) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })

    const payload = await payloadClient()
    const doc = await payload
      .findByID({ collection: 'product-files', id, depth: 0, overrideAccess: true })
      .catch(() => null)

    const auftrag = (doc as { auftrag?: unknown })?.auftrag
    const angebot = (doc as { angebot?: unknown })?.angebot
    const erlaubt =
      doc && fuerKunden(doc as never)
        ? auftrag
          ? await darfAuftragSehen(payload, email, Number(auftrag))
          : angebot
            ? await darfAngebotSehen(payload, email, Number(angebot))
            : false
        : false

    // Ein einziger Fehlercode für „gibt es nicht", „gehört jemand anderem" und
    // „bleibt im Haus" — sonst verrät die Antwort, was es gibt
    if (!erlaubt || !doc?.filename) {
      return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })
    }

    const pfad = path.join(ABLAGE, doc.filename)
    const angaben = await fs.promises.stat(pfad).catch(() => null)
    if (!angaben) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    const name = (doc.label || doc.filename).replace(/["\\\r\n]/g, '')
    return new NextResponse(Readable.toWeb(fs.createReadStream(pfad)) as ReadableStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(angaben.size),
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Download im Portal fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
