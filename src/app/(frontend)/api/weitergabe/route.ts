import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { NextResponse } from 'next/server'

import { ABLAGE } from '../../../../lib/dateiAblage'
import { payloadClient } from '../../../../lib/data'
import { weitergabeGueltig } from '../../../../lib/weitergabe'

export const dynamic = 'force-dynamic'

/**
 * Die Abholstelle für weitergegebene Werkstattdateien.
 *
 * Hier klickt kein Büro-Konto, sondern der Laserschneider — deshalb kein
 * Anmeldefenster und im Fehlerfall ein Satz, den ein Mensch versteht, statt
 * eines Fehlercodes.
 *
 * Der Link trägt seine Berechtigung selbst (siehe `lib/weitergabe.ts`): Datei
 * und Ablaufzeit sind mit dem Geheimnis der Anwendung unterschrieben. Wer die
 * Nummer in der Adresse hochzählt, kommt damit keinen Schritt weiter — die
 * Signatur passt dann nicht mehr, und ohne sie gibt es keine Datei.
 *
 * Ausgeliefert wird als Strom von der Platte: Eine Zeichnung von 500 MB
 * dürfte nicht erst vollständig in den Arbeitsspeicher.
 */

const ABGELAUFEN =
  'Dieser Abhol-Link ist abgelaufen oder ungültig. Bitte lassen Sie sich einen neuen zuschicken.'

const alsText = (text: string, status: number) =>
  new NextResponse(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

export async function GET(req: Request) {
  const adresse = new URL(req.url)
  const datei = adresse.searchParams.get('datei') ?? ''
  const bis = Number(adresse.searchParams.get('bis'))
  const sig = adresse.searchParams.get('sig') ?? ''

  if (!weitergabeGueltig(datei, bis, sig)) return alsText(ABGELAUFEN, 403)

  try {
    const payload = await payloadClient()
    const doc = await payload
      .findByID({ collection: 'product-files', id: datei, depth: 0, overrideAccess: true })
      .catch(() => null)

    /*
     * Eine gelöschte Datei ist die vorgesehene Art, einen Link vorzeitig
     * loszuwerden — sie muss deshalb ins Leere laufen und nicht in einen
     * Serverfehler.
     */
    if (!doc?.filename) return alsText('Diese Datei gibt es nicht mehr.', 404)

    const pfad = path.join(ABLAGE, doc.filename)
    const angaben = await fs.promises.stat(pfad).catch(() => null)
    if (!angaben) return alsText('Diese Datei gibt es nicht mehr.', 404)

    const name = (doc.label || doc.filename).replace(/["\\\r\n]/g, '')
    return new NextResponse(Readable.toWeb(fs.createReadStream(pfad)) as ReadableStream, {
      headers: {
        // Immer als Anhang und immer `octet-stream`: Was hier herausgeht,
        // gehört auf die Maschine und nicht in ein Vorschaufenster
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(angaben.size),
        'Content-Disposition': `attachment; filename="${name}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Abholung einer weitergegebenen Datei fehlgeschlagen:', err)
    return alsText('Das hat nicht geklappt — bitte später erneut versuchen.', 500)
  }
}
