import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { dateiEintragen, stromAblegen, ZuGross } from '../../../../../lib/dateiAblage'
import { dateiName, endungErlaubt, MAX_BYTES, ordnerName } from '../../../../../lib/uebergabe'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 900

/**
 * Dateien an einem Vorgang — Anfrage, Angebot, Auftrag.
 *
 * Bis hierher hingen Dateien am **Artikel**: die Laserdatei zur eigenen
 * Variante. Bei Lohnfertigung gibt es keinen Artikel. Was der Auftraggeber
 * schickt, gehört an den Vorgang, und zwar schon bevor es einen Auftrag gibt —
 * die Zeichnung ist ja der Grund, aus dem überhaupt gerechnet wird.
 *
 * Dieselbe Sammlung wie die Werkstattdateien, nur ein anderer Anker. Damit
 * gilt auch dieselbe Regel: nicht öffentlich, kein Verkleinern, Download unter
 * dem Namen, unter dem die Datei hereinkam.
 *
 * Hochgeladen wird wie in der Übergabemappe — unverpackt im Rumpf, stückweise
 * auf die Platte (siehe `lib/dateiAblage.ts`).
 */

const ANKER = ['anfrage', 'angebot', 'auftrag'] as const
type Anker = (typeof ANKER)[number]

/** Der eine Vorgang, an dem die Datei hängt — genau einer, sonst nichts. */
function ankerAus(quelle: URLSearchParams | Record<string, unknown>): {
  feld: Anker
  id: number
} | null {
  for (const feld of ANKER) {
    const roh = quelle instanceof URLSearchParams ? quelle.get(feld) : quelle[feld]
    const id = Number(roh)
    if (id) return { feld, id }
  }
  return null
}

export async function POST(req: Request) {
  let abgelegt: string | null = null
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const typ = req.headers.get('content-type') ?? ''

    // ── Hochladen ─────────────────────────────────────────────────────────
    if (!typ.includes('application/json')) {
      const adresse = new URL(req.url)
      const anker = ankerAus(adresse.searchParams)
      if (!anker) return NextResponse.json({ error: 'kein-bezug' }, { status: 400 })

      const name = dateiName(adresse.searchParams.get('name'))
      if (!name) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
      if (!endungErlaubt(name)) return NextResponse.json({ error: 'dateityp' }, { status: 400 })

      const { datei, bytes } = await stromAblegen(req.body, name, MAX_BYTES)
      abgelegt = datei

      const eintrag = await dateiEintragen(payload, datei, bytes, name, {
        [anker.feld]: anker.id,
        folder: ordnerName(adresse.searchParams.get('ordner')) || undefined,
        herkunft: 'haus',
        // Am Vorgang liegt sie erst einmal im Haus. Hinaus geht sie über eine
        // Übergabemappe, und dort ausdrücklich.
        freigabe: false,
      })
      return NextResponse.json({ ok: true, id: eintrag.id, label: eintrag.label, groesse: bytes })
    }

    const b = (await req.json()) as Record<string, any>

    const datei = await payload
      .findByID({ collection: 'product-files', id: b.id, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!datei) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    /*
     * Nur Dateien, die an genau diesem Vorgang hängen.
     *
     * Ohne diese Prüfung wäre die Nummer in der Anfrage ein Generalschlüssel
     * auf jede Werkstattdatei im Haus — und die Nummern liegen dicht
     * beieinander.
     */
    const anker = ankerAus(b)
    const gehoertDazu =
      anker && String((datei as unknown as Record<string, unknown>)[anker.feld] ?? '') === String(anker.id)
    if (!gehoertDazu) return NextResponse.json({ error: 'gehoert-nicht-dazu' }, { status: 400 })

    if (b.aktion === 'loeschen') {
      await payload.delete({ collection: 'product-files', id: b.id, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'aendern') {
      await payload.update({
        collection: 'product-files',
        id: b.id,
        overrideAccess: true,
        data: {
          ...(b.label !== undefined ? { label: b.label || null } : {}),
          ...(b.note !== undefined ? { note: b.note || null } : {}),
          ...(b.folder !== undefined ? { folder: ordnerName(b.folder) || null } : {}),
        },
      })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    if (err instanceof ZuGross) return NextResponse.json({ error: 'zu-gross' }, { status: 413 })
    if (abgelegt) {
      const { ablageAufraeumen } = await import('../../../../../lib/dateiAblage')
      await ablageAufraeumen(abgelegt)
    }
    console.error('Vorgangsdatei fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
