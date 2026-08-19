import { payloadClient } from '../../../../../../../lib/data'
import { rechnungFacturX } from '../../../../../../../lib/dokumente'

export const dynamic = 'force-dynamic'

/**
 * Die Rechnung als reine Factur-X-XML.
 *
 * Im PDF steckt sie ohnehin; hier liegt sie einzeln, weil manche Plattform
 * und mancher Steuerberater genau das haben will.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  try {
    const { xml, dateiname } = await rechnungFacturX(payload, id)
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${dateiname}"`,
      },
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'entwurf') {
      return new Response('Diese Rechnung ist noch ein Entwurf und hat keine Nummer.', {
        status: 409,
      })
    }
    return new Response('Nicht gefunden', { status: 404 })
  }
}
