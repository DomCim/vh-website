import fs from 'node:fs/promises'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../lib/data'
import { darf } from '../../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Eine Werkstattdatei herunterladen.
 *
 * Warum eine eigene Route und nicht der übliche Weg über die Mediathek:
 *
 * **Zugang.** Die Mediathek ist öffentlich lesbar — sie liefert die Bilder
 * der Website aus. Eine Laserdatei unter einer ratbaren Adresse ist die
 * Arbeit von Wochen, frei zum Mitnehmen. Hier wird geprüft, dass jemand im
 * Büro angemeldet ist; ein Recht darüber hinaus braucht es nicht, denn wer
 * das Teil baut, braucht die Zeichnung.
 *
 * **Der Name.** Auf der Platte trägt die Datei einen Zeitstempel, damit zwei
 * Varianten ihre gleichnamige `zuschnitt.dxf` nicht gegenseitig
 * überschreiben. Heruntergeladen wird sie unter dem Namen, unter dem sie
 * hereinkam — sonst landet in der Werkstatt eine
 * `1755641234567-zuschnitt.dxf` auf dem USB-Stick.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'buero.oeffnen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const doc = await payload.findByID({
      collection: 'product-files',
      id,
      depth: 0,
      overrideAccess: true,
    })
    if (!doc?.filename) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    const datei = path.join(process.cwd(), 'media', 'werkstattdateien', doc.filename)
    const inhalt = await fs.readFile(datei)

    /*
     * `octet-stream` statt des gemeldeten Typs: Eine DXF meldet sich je nach
     * Betriebssystem als `image/vnd.dxf`, und der Browser versucht dann, sie
     * anzuzeigen. Was hier herausgeht, gehört auf die Maschine und nicht in
     * ein Vorschaufenster.
     */
    const name = (doc.label || doc.filename).replace(/["\\]/g, '')
    return new NextResponse(new Uint8Array(inhalt), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(inhalt.byteLength),
        'Content-Disposition': `attachment; filename="${name}"`,
        // Zeichnungen ändern sich; ein zwischengespeicherter Zuschnitt von
        // gestern ist genau der Fehler, den niemand sucht.
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Werkstattdatei herunterladen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
