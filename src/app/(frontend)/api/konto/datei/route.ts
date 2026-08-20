import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { dateiEintragen, stromAblegen, ZuGross } from '../../../../../lib/dateiAblage'
import { SITZUNGS_COOKIE, sitzungLesen } from '../../../../../lib/kundenportal'
import { darfAngebotSehen, darfAuftragSehen } from '../../../../../lib/portalDaten'
import {
  dateiName,
  endungErlaubt,
  fuerKunden,
  MAX_BYTES,
  MAX_DATEIEN,
} from '../../../../../lib/uebergabe'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

/**
 * Unterlagen zu einem Vorgang — für die angemeldete Kundschaft.
 *
 * Der Übergabelink ist für die, die noch kein Konto haben: Er gilt sieben Tage
 * und kommt per Mail. Wer angemeldet ist, braucht ihn nicht — er sieht seine
 * Aufträge ohnehin und soll dort nachreichen können, was noch fehlt, und
 * abholen, was bereitliegt.
 *
 * Wem was gehört, entscheidet ausschließlich `lib/portalDaten.ts`. Diese Route
 * fragt dort nach und filtert nicht selbst; eine zweite Stelle, die das
 * entscheidet, wäre die, die es irgendwann anders entscheidet.
 */

type Bezug = { feld: 'auftrag' | 'angebot'; id: number }

function bezugAus(suche: URLSearchParams): Bezug | null {
  const auftrag = Number(suche.get('auftrag'))
  if (auftrag) return { feld: 'auftrag', id: auftrag }
  const angebot = Number(suche.get('angebot'))
  if (angebot) return { feld: 'angebot', id: angebot }
  return null
}

/** Angemeldet **und** der Vorgang gehört dieser Adresse — sonst `null`. */
async function zugriff(req: Request) {
  const email = sitzungLesen((await cookies()).get(SITZUNGS_COOKIE)?.value)
  if (!email) return null

  const bezug = bezugAus(new URL(req.url).searchParams)
  if (!bezug) return null

  const payload = await payloadClient()
  const erlaubt =
    bezug.feld === 'auftrag'
      ? await darfAuftragSehen(payload, email, bezug.id)
      : await darfAngebotSehen(payload, email, bezug.id)
  if (!erlaubt) return null

  return { payload, email, bezug }
}

export async function GET(req: Request) {
  try {
    const sitzung = await zugriff(req)
    if (!sitzung) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })

    const { docs } = await sitzung.payload.find({
      collection: 'product-files',
      where: { [sitzung.bezug.feld]: { equals: sitzung.bezug.id } },
      limit: 1000,
      sort: 'createdAt',
      depth: 0,
      overrideAccess: true,
    })

    return NextResponse.json({
      dateien: docs
        .filter((d) => fuerKunden(d as never))
        .map((d) => ({
          id: d.id,
          name: d.label || d.filename || 'Datei',
          groesse: d.filesize ?? 0,
          vonUns: d.herkunft !== 'kunde',
          am: d.createdAt ?? null,
        })),
    })
  } catch (err) {
    console.error('Unterlagen im Portal lesen fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  let abgelegt: string | null = null
  try {
    const sitzung = await zugriff(req)
    if (!sitzung) return NextResponse.json({ error: 'kein-zugang' }, { status: 401 })

    const suche = new URL(req.url).searchParams
    const name = dateiName(suche.get('name'))
    if (!name) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
    if (!endungErlaubt(name)) return NextResponse.json({ error: 'dateityp' }, { status: 400 })

    const drin = await sitzung.payload.count({
      collection: 'product-files',
      where: { [sitzung.bezug.feld]: { equals: sitzung.bezug.id } },
      overrideAccess: true,
    })
    if (drin.totalDocs >= MAX_DATEIEN) {
      return NextResponse.json({ error: 'vorgang-voll' }, { status: 400 })
    }

    const { datei, bytes } = await stromAblegen(req.body, name, MAX_BYTES)
    abgelegt = datei

    const eintrag = await dateiEintragen(sitzung.payload, datei, bytes, name, {
      [sitzung.bezug.feld]: sitzung.bezug.id,
      herkunft: 'kunde',
      // Was er selbst hochlädt, sieht er ohnehin — siehe `fuerKunden`
      freigabe: false,
      note: `Nachgereicht von ${sitzung.email}`,
    })

    const { benachrichtige } = await import('../../../../../lib/push')
    await benachrichtige(sitzung.payload, {
      titel: 'Kundschaft hat eine Datei nachgereicht',
      text: `„${eintrag.label}" liegt am ${sitzung.bezug.feld === 'auftrag' ? 'Auftrag' : 'Angebot'}.`,
      url: `/office/${sitzung.bezug.feld === 'auftrag' ? 'auftraege' : 'angebote'}/${sitzung.bezug.id}`,
      tag: `vorgangsdatei-${sitzung.bezug.feld}-${sitzung.bezug.id}`,
    }).catch(() => undefined)

    return NextResponse.json({ ok: true, id: eintrag.id, name: eintrag.label, groesse: bytes })
  } catch (err) {
    if (err instanceof ZuGross) return NextResponse.json({ error: 'zu-gross' }, { status: 413 })
    if (abgelegt) {
      const { ablageAufraeumen } = await import('../../../../../lib/dateiAblage')
      await ablageAufraeumen(abgelegt)
    }
    console.error('Nachreichen im Portal fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
