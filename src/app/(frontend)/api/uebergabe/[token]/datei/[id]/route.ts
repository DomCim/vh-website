import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../../lib/data'
import { ABLAGE } from '../../../../../../../lib/dateiAblage'
import { zugriffZuToken } from '../../../../../../../lib/mappenZugang'
import { fuerKunden, mappenSitzungLesen, UEBERGABE_COOKIE } from '../../../../../../../lib/uebergabe'

export const dynamic = 'force-dynamic'

/**
 * Eine Datei aus der Mappe herunterladen — die Seite des Auftraggebers.
 *
 * Drei Prüfungen, und keine davon ist entbehrlich:
 *
 * 1. Der Zugang gilt (Kennung, Ablauf, nicht zurückgezogen).
 * 2. Der Besucher hat sich mit dem Passwort angemeldet.
 * 3. Die Datei gehört zu **dieser** Mappe und ist für ihn bestimmt —
 *    entweder von ihm selbst hochgeladen oder ausdrücklich freigegeben.
 *
 * Ohne Punkt 3 wäre die Nummer in der Adresse ein Schlüssel zu jeder
 * Werkstattdatei im Haus; die Nummern liegen dicht beieinander und sind in
 * einer Minute durchprobiert.
 *
 * Ausgeliefert wird als Strom von der Platte, nicht über den
 * Arbeitsspeicher — bei 500 MB wäre alles andere ein Rechenzentrumsproblem.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
) {
  try {
    const { token, id } = await params
    const payload = await payloadClient()

    const zugriff = await zugriffZuToken(payload, token)
    if (!zugriff) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })
    if (mappenSitzungLesen((await cookies()).get(UEBERGABE_COOKIE)?.value) !== token) {
      return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })
    }

    const doc = await payload
      .findByID({ collection: 'product-files', id, depth: 0, overrideAccess: true })
      .catch(() => null)

    const gehoertDazu = String((doc as { mappe?: unknown })?.mappe ?? '') === String(zugriff.mappe.id)
    if (!doc?.filename || !gehoertDazu || !fuerKunden(doc as never)) {
      // Gleiche Antwort wie für „gibt es nicht" — was im Haus bleibt, soll
      // sich nicht einmal durch einen anderen Fehlercode verraten
      return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })
    }

    const pfad = path.join(ABLAGE, doc.filename)
    const angaben = await fs.promises.stat(pfad).catch(() => null)
    if (!angaben) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    const name = (doc.label || doc.filename).replace(/["\\\r\n]/g, '')
    return new NextResponse(Readable.toWeb(fs.createReadStream(pfad)) as ReadableStream, {
      headers: {
        // Immer als Anhang und immer als `octet-stream`: Was hier herausgeht,
        // gehört auf die Maschine und nicht in ein Vorschaufenster — und eine
        // Datei, die der Browser selbst ausführt, gibt es damit gar nicht erst
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(angaben.size),
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Download aus der Übergabemappe fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
