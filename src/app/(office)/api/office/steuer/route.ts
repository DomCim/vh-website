import { payloadClient } from '../../../../../lib/data'
import { alsCsv, steuerbericht } from '../../../../../lib/steuerexport'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Steuer-Export als CSV für den Steuerberater. */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'zahlen.sehen'))) {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const jahr = Number(new URL(req.url).searchParams.get('jahr')) || new Date().getFullYear()
  const bericht = await steuerbericht(payload, jahr)

  return new Response(alsCsv(bericht), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vh-buchungen-${jahr}.csv"`,
    },
  })
}
