import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { ABLAGE } from '../../../../../lib/dateiAblage'
import { bildGueltig, istBild, FEHLERMELDUNGS_ORDNER } from '../../../../../lib/fehlermeldung'

export const dynamic = 'force-dynamic'

/**
 * Das Foto zu einer Fehlermeldung — für GitHub sichtbar, sonst für niemanden.
 *
 * Hier klopft kein Büro-Konto an, sondern GitHubs Bilddienst: Er holt das Bild
 * einmal ab und zeigt es im Eintrag. Deshalb keine Anmeldung, sondern eine
 * Unterschrift in der Adresse (siehe `lib/fehlermeldung.ts`).
 *
 * **Drei Riegel, und jeder hat seinen eigenen Grund.** Die Unterschrift sagt,
 * dass diese Adresse von uns stammt. Der Ordner sagt, dass die Datei zu einer
 * Meldung gehört — eine Fertigungszeichnung soll auch mit gültiger
 * Unterschrift nicht über diesen Weg hinausgehen. Und die Bildart sagt, dass
 * es wirklich ein Bild ist: Was hier ausgeliefert wird, geht mit seinem
 * eigenen Inhaltstyp und ohne Anhang-Vermerk hinaus, damit GitHub es anzeigen
 * kann. Genau das ist der Unterschied zur Weitergabe an Zulieferer, die
 * bewusst immer als Anhang ausliefert — und genau deshalb sind es zwei
 * Routen und nicht ein Schalter an einer.
 */

const alsText = (text: string, status: number) =>
  new NextResponse(text, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

export async function GET(req: Request) {
  const adresse = new URL(req.url)
  const datei = adresse.searchParams.get('datei') ?? ''
  const sig = adresse.searchParams.get('sig') ?? ''

  if (!bildGueltig(datei, sig)) return alsText('Kein gültiger Link.', 403)

  try {
    const payload = await payloadClient()
    const doc = await payload
      .findByID({ collection: 'product-files', id: datei, depth: 0, overrideAccess: true })
      .catch(() => null)

    // Eine gelöschte Datei ist der vorgesehene Weg, ein Foto zurückzuziehen —
    // sie muss deshalb ins Leere laufen und nicht in einen Serverfehler.
    if (!doc?.filename) return alsText('Dieses Foto gibt es nicht mehr.', 404)
    if (doc.folder !== FEHLERMELDUNGS_ORDNER || !istBild(doc.mimeType)) {
      return alsText('Kein gültiger Link.', 403)
    }

    const pfad = path.join(ABLAGE, doc.filename)
    const angaben = await fs.promises.stat(pfad).catch(() => null)
    if (!angaben) return alsText('Dieses Foto gibt es nicht mehr.', 404)

    return new NextResponse(Readable.toWeb(fs.createReadStream(pfad)) as ReadableStream, {
      headers: {
        'Content-Type': doc.mimeType as string,
        'Content-Length': String(angaben.size),
        /*
         * Lange zwischenspeichern lassen: Ein Eintrag im Repository wird über
         * Monate gelesen, und jeder Aufruf ginge sonst durch unseren Server.
         * Der Inhalt ändert sich nie — eine neue Datei bekommt eine neue
         * Nummer und damit eine neue Adresse.
         */
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    console.error('Foto einer Meldung ausliefern fehlgeschlagen:', err)
    return alsText('Das hat nicht geklappt.', 500)
  }
}
