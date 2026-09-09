import { payloadClient } from '../../../../../../../lib/data'
import { mahnungDokument } from '../../../../../../../lib/dokumente'
import { darf } from '../../../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Eine bereits verschickte Mahnung noch einmal.
 *
 * Nicht die nächste Stufe — die entsteht beim Verschicken —, sondern genau
 * das Schreiben, das damals hinausgegangen ist, mit seiner Stufe, seiner
 * Frist und seiner Pauschale. Wer wissen will, was gefordert wurde, soll es
 * nachlesen können, ohne eine neue Mahnung auszulösen.
 *
 * `zeile` ist die Stelle in der Liste der verschickten Mahnungen, von null an.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'rechnungen.schreiben'))) {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const zeile = Number(new URL(req.url).searchParams.get('zeile'))
  if (!Number.isInteger(zeile) || zeile < 0) {
    return new Response('Welche Mahnung?', { status: 400 })
  }

  const { id } = await params
  try {
    const unterlage = await mahnungDokument(payload, id, zeile)
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
