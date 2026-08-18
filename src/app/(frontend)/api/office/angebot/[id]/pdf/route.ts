import { payloadClient } from '../../../../../../../lib/data'
import { angebotDokument } from '../../../../../../../lib/dokumente'

export const dynamic = 'force-dynamic'

/** Angebot als PDF — erst ab „Versendet", vorher gibt es keine Nummer. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  try {
    const unterlage = await angebotDokument(payload, id)
    return new Response(new Uint8Array(unterlage.datei), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${unterlage.dateiname}"`,
      },
    })
  } catch (err) {
    const grund = err instanceof Error ? err.message : ''
    if (grund === 'entwurf') {
      return new Response('Dieses Angebot ist noch ein Entwurf und hat keine Nummer.', {
        status: 409,
      })
    }
    return new Response('Nicht gefunden', { status: 404 })
  }
}
