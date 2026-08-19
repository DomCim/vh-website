import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { SITZUNGS_COOKIE, sitzungLesen } from '../../../../../lib/kundenportal'
import { vorgaenge } from '../../../../../lib/portalDaten'
import { benachrichtige } from '../../../../../lib/push'
import { ipAus, zuVieleAnfragen } from '../../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

/**
 * Ein Angebot im Kundenportal annehmen.
 *
 * Was das ersetzt: das telefonische Nachfassen — jedenfalls zum Teil. Wer das
 * Angebot ohnehin annehmen will, muss dafür bisher zurückrufen oder eine Mail
 * schreiben, und beides passiert eine Woche später als der Entschluss.
 *
 * Was es zusätzlich bringt: einen Beleg. Eine telefonische Zusage steht danach
 * als Status im Büro; wer später fragt „wann haben Sie zugestimmt?", bekommt
 * keine Antwort. Hier stehen Zeitpunkt, Name und Weg am Angebot.
 *
 * Bewusst entsteht **kein Auftrag** von selbst. Der Auftrag ist die Zusage der
 * Werkstatt, nicht die des Kunden: Termin, Material und Werkstattplatz
 * entscheidet der Betrieb. Das Büro erfährt die Annahme sofort per Meldung und
 * macht den Auftrag daraus.
 */
export async function POST(req: Request) {
  try {
    const email = sitzungLesen((await cookies()).get(SITZUNGS_COOKIE)?.value)
    if (!email) return NextResponse.json({ error: 'nicht-angemeldet' }, { status: 401 })

    if (zuVieleAnfragen(`konto-angebot:${ipAus(req)}`, 20, 10 * 60_000)) {
      return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
    }

    const b = (await req.json()) as { id?: string | number; name?: string }
    if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

    const payload = await payloadClient()

    /*
     * Dieselbe Abfrage wie für die Liste, nur mit einem Angebot als Frage —
     * so wie beim Rechnungs-PDF. Eine eigene, schlankere Prüfung wäre
     * schneller und wäre die Stelle, an der die beiden auseinanderlaufen.
     */
    const meine = await vorgaenge(payload, email)
    const angebot = meine.angebote.find((a) => String(a.id) === String(b.id))
    if (!angebot) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    // Schon angenommen: kein Fehler, nur nichts zu tun. Ein zweiter Klick auf
    // einer wackligen Leitung darf nicht wie ein Fehlschlag aussehen.
    if (angebot.status === 'angenommen') {
      return NextResponse.json({ ok: true, schon: true })
    }
    if (!angebot.annehmbar) {
      return NextResponse.json({ error: 'nicht-annehmbar' }, { status: 409 })
    }

    const name = String(b.name ?? '').trim().slice(0, 120)

    await payload.update({
      collection: 'quotes',
      id: angebot.id as number,
      overrideAccess: true,
      data: {
        status: 'angenommen',
        acceptedAt: new Date().toISOString(),
        acceptedVia: 'portal',
        acceptedName: name || email,
      },
    })

    await benachrichtige(payload, {
      titel: `Angebot ${angebot.nummer} angenommen`,
      text: `${name || email} hat im Kundenportal zugestimmt. Auftrag anlegen und Termin zusagen.`,
      url: `/office/angebote/${angebot.id}`,
      tag: `angebot-angenommen-${angebot.id}`,
    }).catch(() => undefined)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Angebotsannahme fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
