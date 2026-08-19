import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { ALLE_RECHTE, INHABER, RECHTE } from '../../../../../lib/rechte'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Rollen im Büro verwalten.
 *
 * Das Datenmodell stand schon, die Oberfläche fehlte: Rollen ließen sich nur
 * im Admin-Panel anlegen, und die Benutzerverwaltung kannte weiterhin nur
 * „Inhaber" und „Redaktion". Wer eine Werkstattrolle ohne Umsätze wollte,
 * musste dafür in eine andere Anwendung wechseln — und wusste das nicht.
 *
 * Drei Sperren bleiben, und alle drei schützen vor demselben Missgeschick:
 * Die Inhaberrolle lässt sich nicht entwaffnen, eingebaute Rollen nicht
 * löschen, und eine Rolle mit Konten daran auch nicht. Ein Betrieb, der sich
 * beim Umbauen der Rechte aussperrt, steht am Freitagabend vor einer
 * verschlossenen Tür, und niemand kann ihn hereinlassen.
 */

async function wache(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'benutzer.verwalten'))) return { payload, user: null }
  return { payload, user }
}

/** Aus „Werkstatt Süd" wird „werkstatt-sued" — der Schlüssel bleibt, der Name darf sich ändern. */
function schluesselAus(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'rolle'
  )
}

export async function GET(req: Request) {
  const { payload, user } = await wache(req)
  if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  const { docs } = await payload.find({
    collection: 'roles',
    sort: 'name',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })

  // Wie viele Konten hängen dran? Danach entscheidet die Oberfläche, ob sie
  // den Löschknopf überhaupt anbietet.
  const rollen = []
  for (const r of docs) {
    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { rolle: { equals: r.id } },
      overrideAccess: true,
    })
    rollen.push({
      id: r.id,
      name: r.name,
      schluessel: r.schluessel,
      rechte: r.rechte ?? [],
      eingebaut: Boolean(r.eingebaut),
      konten: totalDocs,
      allmaechtig: r.schluessel === INHABER,
    })
  }

  return NextResponse.json({
    rollen,
    // Der Katalog kommt vom Server, damit die Oberfläche ihn nicht zweimal führt
    katalog: ALLE_RECHTE.map((wert) => ({ wert, text: RECHTE[wert] })),
  })
}

export async function POST(req: Request) {
  const { payload, user } = await wache(req)
  if (!user) return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })

  try {
    const b = (await req.json()) as {
      aktion?: 'anlegen' | 'aendern' | 'loeschen'
      id?: number | string
      name?: string
      rechte?: string[]
    }

    const rechte = (b.rechte ?? []).filter((r): r is (typeof ALLE_RECHTE)[number] =>
      (ALLE_RECHTE as readonly string[]).includes(r),
    )

    if (b.aktion === 'anlegen') {
      const name = b.name?.trim()
      if (!name) return NextResponse.json({ error: 'name-fehlt' }, { status: 400 })

      /*
       * Bei gleichem Namen hinten eine Zahl anhängen, statt abzuweisen. Der
       * Schlüssel ist eindeutig, der Name muss es nicht sein — und „Werkstatt"
       * zweimal ist ein Ordnungsproblem, kein Fehler.
       */
      const stamm = schluesselAus(name)
      let schluessel = stamm
      for (let n = 2; n < 50; n++) {
        const { totalDocs } = await payload.count({
          collection: 'roles',
          where: { schluessel: { equals: schluessel } },
          overrideAccess: true,
        })
        if (!totalDocs) break
        schluessel = `${stamm}-${n}`
      }

      const doc = await payload.create({
        collection: 'roles',
        overrideAccess: true,
        data: { name, schluessel, rechte, eingebaut: false },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    if (!b.id) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

    const rolle = await payload
      .findByID({ collection: 'roles', id: b.id, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!rolle) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    if (b.aktion === 'loeschen') {
      if (rolle.eingebaut) return NextResponse.json({ error: 'eingebaut' }, { status: 400 })
      const { totalDocs } = await payload.count({
        collection: 'users',
        where: { rolle: { equals: rolle.id } },
        overrideAccess: true,
      })
      if (totalDocs > 0) return NextResponse.json({ error: 'noch-belegt' }, { status: 400 })
      await payload.delete({ collection: 'roles', id: rolle.id, overrideAccess: true })
      return NextResponse.json({ ok: true })
    }

    if (b.aktion === 'aendern') {
      const daten: Record<string, unknown> = {}
      if (typeof b.name === 'string' && b.name.trim()) daten.name = b.name.trim()

      /*
       * An den Haken der Inhaberrolle wird nicht gerührt. Sie darf alles, weil
       * sie am Schlüssel erkannt wird; eine Liste dort wäre nicht nur wirkungslos,
       * sondern irreführend — beim nächsten neuen Recht stünde ausgerechnet der
       * Inhaber ohne da.
       */
      if (Array.isArray(b.rechte) && rolle.schluessel !== INHABER) daten.rechte = rechte

      await payload.update({ collection: 'roles', id: rolle.id, overrideAccess: true, data: daten })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Rolle speichern fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
