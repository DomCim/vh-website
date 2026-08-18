import { payloadClient } from '../../../../../../../lib/data'
import { lieferscheinDokument } from '../../../../../../../lib/dokumente'

export const dynamic = 'force-dynamic'

/** Lieferschein zum Auftrag — zum Ausdrucken und Mitgeben. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  try {
    const unterlage = await lieferscheinDokument(payload, id)
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
