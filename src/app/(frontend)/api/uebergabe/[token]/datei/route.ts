import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../lib/data'
import { dateiEintragen, stromAblegen, ZuGross } from '../../../../../../lib/dateiAblage'
import { zugriffZuToken } from '../../../../../../lib/mappenZugang'
import { benachrichtige } from '../../../../../../lib/push'
import {
  dateiName,
  endungErlaubt,
  mappenSitzungLesen,
  MAX_BYTES,
  MAX_DATEIEN,
  ordnerName,
  UEBERGABE_COOKIE,
} from '../../../../../../lib/uebergabe'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

/**
 * Der Auftraggeber legt eine Datei in seine Mappe.
 *
 * Eine Datei je Anfrage, unverpackt im Rumpf — der Browser schickt mehrere
 * nacheinander. Damit steht auf dem Server nie mehr als ein Strom, der
 * stückweise auf die Platte geht; ein Formular mit fünf Dateien läge dagegen
 * vollständig im Arbeitsspeicher, ehe die erste Zeile Code läuft.
 *
 * Warum eine Liste erlaubter Endungen: Der Ordner steht im Netz und nimmt
 * entgegen, was hereingereicht wird. Was nicht auf der Liste steht, wird
 * abgelehnt — mit dem Hinweis, es zu packen. Das versteht jeder, und es hält
 * ausführbare Dateien und alles vom Browser Ausführbare draußen.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  let abgelegt: string | null = null
  try {
    const { token } = await params
    const payload = await payloadClient()

    const zugriff = await zugriffZuToken(payload, token)
    if (!zugriff) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })
    if (mappenSitzungLesen((await cookies()).get(UEBERGABE_COOKIE)?.value) !== token) {
      return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })
    }
    if (zugriff.mappe.geschlossen) {
      return NextResponse.json({ error: 'geschlossen' }, { status: 400 })
    }

    const adresse = new URL(req.url)
    const name = dateiName(adresse.searchParams.get('name'))
    if (!name) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
    if (!endungErlaubt(name)) return NextResponse.json({ error: 'dateityp' }, { status: 400 })

    const drin = await payload.count({
      collection: 'product-files',
      where: { mappe: { equals: zugriff.mappe.id } },
      overrideAccess: true,
    })
    if (drin.totalDocs >= MAX_DATEIEN) {
      return NextResponse.json({ error: 'mappe-voll' }, { status: 400 })
    }

    const { datei, bytes } = await stromAblegen(req.body, name, MAX_BYTES)
    abgelegt = datei

    const mappe = zugriff.mappe as typeof zugriff.mappe & {
      anfrage?: number | null
      angebot?: number | null
      auftrag?: number | null
    }

    const eintrag = await dateiEintragen(payload, datei, bytes, name, {
      mappe: mappe.id,
      // Die Anker der Mappe wandern mit: Die Zeichnung soll später am Auftrag
      // stehen und nicht nur in einer Mappe, an die sich niemand erinnert
      anfrage: mappe.anfrage ?? undefined,
      angebot: mappe.angebot ?? undefined,
      auftrag: mappe.auftrag ?? undefined,
      folder: ordnerName(adresse.searchParams.get('ordner')) || undefined,
      herkunft: 'kunde',
      // Was er selbst hochlädt, sieht er ohnehin — das Häkchen ist für den
      // umgekehrten Weg da (siehe `fuerKunden`)
      freigabe: false,
    })

    /*
     * Eine Zeichnung, die niemand bemerkt, ist so gut wie keine.
     *
     * Bei Lohnfertigung wartet der Auftraggeber auf eine Zusage; die Meldung
     * ist der Anlass nachzusehen. Sie darf den Upload nie aufhalten — er ist
     * das Wichtigere, und ein fehlender Hinweis ist kein Datenverlust.
     */
    await benachrichtige(payload, {
      titel: 'Neue Datei in der Übergabemappe',
      text: `„${eintrag.label}" liegt in ${mappe.title ?? 'einer Mappe'}.`,
      url: `/office/uebergabe/${mappe.id}`,
      tag: `mappe-${mappe.id}`,
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, id: eintrag.id, name: eintrag.label, groesse: bytes })
  } catch (err) {
    if (err instanceof ZuGross) {
      return NextResponse.json({ error: 'zu-gross' }, { status: 413 })
    }
    if (abgelegt) {
      const { ablageAufraeumen } = await import('../../../../../../lib/dateiAblage')
      await ablageAufraeumen(abgelegt)
    }
    console.error('Upload in die Übergabemappe fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
