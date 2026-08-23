import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { ABLAGE } from '../../../../lib/dateiAblage'
import { darfHerunterladen, downloadGueltig } from '../../../../lib/digitaleware'

export const dynamic = 'force-dynamic'

/**
 * Die Abholstelle für gekaufte Dateien.
 *
 * Hier klickt jemand aus seiner Bestätigungsmail, meist nicht angemeldet und
 * oft am Handy. Deshalb kein Anmeldefenster, sondern eine Unterschrift in der
 * Adresse — und im Fehlerfall ein Satz, den ein Mensch versteht.
 *
 * **Drei Riegel, jeder mit eigenem Grund.** Die Unterschrift sagt, dass diese
 * Adresse von uns stammt und zu genau dieser Bestellung gehört. Der
 * Bestellstatus sagt, dass bezahlt wurde — eine offene Bestellung liefert
 * nichts, eine stornierte auch nicht mehr. Und das Häkchen an der Datei sagt,
 * dass sie wirklich verkauft wird: An einem Bauplan hängen Fertigungsdaten,
 * die im Haus bleiben, und die liegen in derselben Ablage.
 *
 * Ausgeliefert wird als Strom von der Platte und immer als Anhang: Was hier
 * herausgeht, gehört auf die Maschine des Käufers und nicht in ein
 * Vorschaufenster.
 */

const alsText = (text: string, status: number) =>
  new NextResponse(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

const ABGELAUFEN =
  'Dieser Download-Link ist abgelaufen oder ungültig. Im Kundenkonto steht er neu bereit.'

export async function GET(req: Request) {
  const adresse = new URL(req.url)
  const bestellung = adresse.searchParams.get('bestellung') ?? ''
  const datei = adresse.searchParams.get('datei') ?? ''
  const bis = Number(adresse.searchParams.get('bis'))
  const sig = adresse.searchParams.get('sig') ?? ''

  if (!downloadGueltig(bestellung, datei, bis, sig)) return alsText(ABGELAUFEN, 403)

  try {
    const payload = await payloadClient()

    const auftrag = await payload
      .findByID({ collection: 'orders', id: bestellung, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!auftrag) return alsText('Diese Bestellung gibt es nicht mehr.', 404)
    if (!darfHerunterladen(auftrag.status)) {
      return alsText(
        'Diese Bestellung ist noch nicht bezahlt. Sobald die Zahlung da ist, steht die Datei bereit.',
        403,
      )
    }

    const doc = await payload
      .findByID({ collection: 'product-files', id: datei, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!doc?.filename) return alsText('Diese Datei gibt es nicht mehr.', 404)
    if (!doc.download) return alsText(ABGELAUFEN, 403)

    const pfad = path.join(ABLAGE, doc.filename)
    const angaben = await fs.promises.stat(pfad).catch(() => null)
    if (!angaben) return alsText('Diese Datei gibt es nicht mehr.', 404)

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
    console.error('Download einer gekauften Datei fehlgeschlagen:', err)
    return alsText('Das hat nicht geklappt — bitte später erneut versuchen.', 500)
  }
}
