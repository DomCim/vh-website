import { cookies } from 'next/headers'

import { payloadClient } from '../../../../../../../lib/data'
import { angebotDokument } from '../../../../../../../lib/dokumente'
import { SITZUNGS_COOKIE, sitzungLesen } from '../../../../../../../lib/kundenportal'
import { darfAngebotSehen } from '../../../../../../../lib/portalDaten'
import { ipAus, zuVieleAnfragen } from '../../../../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Das eigene Angebot als PDF — für die Kundschaft.
 *
 * Wie bei der Rechnung: Nicht ein Recht entscheidet, sondern ob dieses
 * Angebot zur angemeldeten Adresse gehört. Und wie dort „nicht gefunden"
 * statt „nicht erlaubt", wenn es einem anderen gehört — wer Nummern
 * durchprobiert, soll nicht auch noch erfahren, welche es gibt.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const email = sitzungLesen((await cookies()).get(SITZUNGS_COOKIE)?.value)
  if (!email) return new Response('Nicht angemeldet', { status: 401 })

  // Eine Bremse, weil hinter jedem Aufruf ein gebautes PDF steht
  if (zuVieleAnfragen(`konto-pdf:${ipAus(req)}`, 30, 10 * 60_000)) {
    return new Response('Zu viele Anfragen', { status: 429 })
  }

  const { id } = await params
  const payload = await payloadClient()

  if (!(await darfAngebotSehen(payload, email, id))) {
    return new Response('Nicht gefunden', { status: 404 })
  }

  try {
    const unterlage = await angebotDokument(payload, id)
    return new Response(new Uint8Array(unterlage.datei), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${unterlage.dateiname}"`,
      },
    })
  } catch (err) {
    // Der Grund gehört ins Protokoll, nach draußen geht nur „nicht gefunden"
    console.error('Portal-Angebot fehlgeschlagen:', err)
    return new Response('Nicht gefunden', { status: 404 })
  }
}
