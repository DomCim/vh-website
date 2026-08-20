import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../lib/data'
import { dateiEintragen, stromAblegen, ZuGross } from '../../../../../../lib/dateiAblage'
import {
  dateiName,
  endungErlaubt,
  MAX_BYTES,
  MAX_DATEIEN,
  ordnerName,
} from '../../../../../../lib/uebergabe'
import { darf } from '../../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

/**
 * Eine Datei aus dem Haus in eine Übergabemappe legen.
 *
 * Die Mappe geht in beide Richtungen: Was der Auftraggeber schickt, kommt über
 * seinen Link herein; was zu ihm zurückgeht — Fertigungszeichnung zur
 * Freigabe, Prüfprotokoll, Messschrieb — geht hier hinein.
 *
 * Die Datei steht **unverpackt** im Rumpf der Anfrage, alles Weitere in der
 * Adresszeile. Kein Formular: Bei 500 MB läge die Datei sonst vollständig im
 * Arbeitsspeicher, ehe auch nur ein Byte auf der Platte ist (siehe
 * `lib/dateiAblage.ts`).
 *
 * `freigabe=1` heißt: Der Auftraggeber darf sie herunterladen. Ohne das
 * Kennzeichen liegt sie in der Mappe und bleibt im Haus — praktisch für den
 * Zwischenstand, der noch niemanden etwas angeht.
 */
export async function POST(req: Request) {
  let abgelegt: string | null = null
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'angebote.schreiben'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const adresse = new URL(req.url)
    const mappeId = adresse.searchParams.get('mappe')
    if (!mappeId) return NextResponse.json({ error: 'keine-mappe' }, { status: 400 })

    const mappe = await payload.findByID({
      collection: 'customer-uploads',
      id: mappeId,
      depth: 0,
      overrideAccess: true,
    })
    if (!mappe) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    const name = dateiName(adresse.searchParams.get('name'))
    if (!name) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
    if (!endungErlaubt(name)) return NextResponse.json({ error: 'dateityp' }, { status: 400 })

    const drin = await payload.count({
      collection: 'product-files',
      where: { mappe: { equals: mappe.id } },
      overrideAccess: true,
    })
    if (drin.totalDocs >= MAX_DATEIEN) {
      return NextResponse.json({ error: 'mappe-voll' }, { status: 400 })
    }

    const { datei, bytes } = await stromAblegen(req.body, name, MAX_BYTES)
    abgelegt = datei

    /*
     * Die Anker der Mappe wandern mit an die Datei.
     *
     * Damit taucht die Zeichnung auch dort auf, wo die Werkstatt sucht — am
     * Auftrag — und nicht nur in einer Mappe, an die sich niemand erinnert.
     */
    const eintrag = await dateiEintragen(payload, datei, bytes, name, {
      mappe: mappe.id,
      anfrage: mappe.anfrage ?? undefined,
      angebot: mappe.angebot ?? undefined,
      auftrag: mappe.auftrag ?? undefined,
      folder: ordnerName(adresse.searchParams.get('ordner')) || undefined,
      herkunft: 'haus',
      freigabe: adresse.searchParams.get('freigabe') === '1',
    })

    return NextResponse.json({ ok: true, id: eintrag.id, label: eintrag.label, groesse: bytes })
  } catch (err) {
    if (err instanceof ZuGross) {
      return NextResponse.json({ error: 'zu-gross' }, { status: 413 })
    }
    if (abgelegt) {
      const { ablageAufraeumen } = await import('../../../../../../lib/dateiAblage')
      await ablageAufraeumen(abgelegt)
    }
    console.error('Datei in die Übergabemappe legen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
