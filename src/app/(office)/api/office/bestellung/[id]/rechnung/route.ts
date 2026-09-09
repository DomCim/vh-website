import { bestellungRechnung } from '../../../../../../../lib/dokumente'
import { payloadClient } from '../../../../../../../lib/data'
import { darf } from '../../../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Die Rechnung zu einer Shop-Bestellung — die, die der Kunde bekommen hat.
 *
 * Sie ging bisher nur als Mailanhang hinaus und war im Büro nirgends zu
 * öffnen. Wer sie brauchte, musste im Postfach nach der Bestätigungsmail
 * suchen.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'anfragen.bearbeiten'))) {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  try {
    const unterlage = await bestellungRechnung(payload, id)
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
