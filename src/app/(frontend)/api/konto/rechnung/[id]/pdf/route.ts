import { cookies } from 'next/headers'

import { payloadClient } from '../../../../../../../lib/data'
import { rechnungDokument } from '../../../../../../../lib/dokumente'
import { SITZUNGS_COOKIE, sitzungLesen } from '../../../../../../../lib/kundenportal'
import { darfRechnungSehen } from '../../../../../../../lib/portalDaten'
import { ipAus, zuVieleAnfragen } from '../../../../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Die eigene Rechnung als PDF — für die Kundschaft.
 *
 * Der Weg ist derselbe wie im Büro, die Prüfung eine andere: Nicht ein Recht
 * entscheidet, sondern ob diese Rechnung zur angemeldeten Adresse gehört. Die
 * Antwort darauf gibt `lib/portalDaten.ts` und sonst niemand.
 *
 * „Nicht gefunden" statt „nicht erlaubt", wenn die Rechnung einem anderen
 * gehört: Wer Nummern durchprobiert, soll nicht auch noch erfahren, welche es
 * gibt. Für den rechtmäßigen Besitzer macht es keinen Unterschied — der kommt
 * ohnehin über die Liste im Portal hierher.
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

  if (!(await darfRechnungSehen(payload, email, id))) {
    return new Response('Nicht gefunden', { status: 404 })
  }

  try {
    const unterlage = await rechnungDokument(payload, id)
    return new Response(new Uint8Array(unterlage.datei), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${unterlage.dateiname}"`,
      },
    })
  } catch (err) {
    /*
     * Der Grund gehört ins Protokoll, nach draußen geht nur „nicht gefunden".
     * Ohne das Protokoll wäre der nächste stille Fehler dieser Route wieder
     * eine Stunde Suche — genau so wurde der PDFKit-Bündelfehler gefunden.
     */
    console.error('Portal-Rechnung fehlgeschlagen:', err)
    return new Response('Nicht gefunden', { status: 404 })
  }
}
