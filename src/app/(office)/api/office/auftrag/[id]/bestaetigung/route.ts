import { payloadClient } from '../../../../../../../lib/data'
import { bestaetigungDokument } from '../../../../../../../lib/dokumente'
import { darf } from '../../../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Auftragsbestätigung als PDF.
 *
 * Das Gegenstück zur Bestellung des Kunden: Er bestellt auf Grundlage des
 * Angebots, hier wird bestätigt, was zu welchem Preis und bis wann gebaut
 * wird. Das Erzeugen hält fest, wann zugesagt wurde.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  try {
    const unterlage = await bestaetigungDokument(payload, id)
    return new Response(new Uint8Array(unterlage.datei), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${unterlage.dateiname}"`,
      },
    })
  } catch {
    return new Response('Nicht gefunden', { status: 404 })
  }
}
