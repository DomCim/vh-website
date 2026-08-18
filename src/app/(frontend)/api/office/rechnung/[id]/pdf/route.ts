import { payloadClient } from '../../../../../../../lib/data'
import { rechnungDokument } from '../../../../../../../lib/dokumente'

export const dynamic = 'force-dynamic'

/** Ausgangsrechnung als PDF — nur für festgeschriebene Rechnungen. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  try {
    const unterlage = await rechnungDokument(payload, id)
    return new Response(new Uint8Array(unterlage.datei), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${unterlage.dateiname}"`,
      },
    })
  } catch (err) {
    const grund = err instanceof Error ? err.message : ''
    if (grund === 'entwurf') {
      return new Response('Diese Rechnung ist noch ein Entwurf und hat keine Nummer.', {
        status: 409,
      })
    }
    return new Response('Nicht gefunden', { status: 404 })
  }
}
