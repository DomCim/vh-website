import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../../../lib/data'
import { darf } from '../../../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/*
 * Ein Kamerafoto vom Telefon, nicht mehr.
 *
 * Derselbe Wert wie beim Beleg-Foto aus der Werkstatt: Ein iPhone liefert je
 * Bild ein bis vier Megabyte, und für den Zweck — Zustand und Verpackung —
 * braucht niemand mehr.
 */
const MAX_BYTES = 25 * 1024 * 1024

/*
 * HEIC steht mit in der Liste, und das ist kein Beiwerk.
 *
 * Ein iPhone nimmt in HEIC auf, und genau daran scheiterten die Fotos an den
 * Meldungen monatelang (#43): Bildschirmfotos gingen durch, Kamerafotos
 * nicht — was nach Zufall aussah und keiner war. Wer hier eine Endungsliste
 * ohne HEIC hinschreibt, baut denselben Fehler ein zweites Mal.
 */
const ERLAUBT = /^image\/(jpeg|png|webp|avif|heic|heif)$/

/**
 * Ein Foto zum Zustand bei der Übergabe.
 *
 * Vor dem Verladen: Auftrag öffnen, „Foto hinzufügen", Kamera. Das Bild
 * landet in der Mediathek, der Auftrag merkt sich den Verweis samt Bemerkung,
 * und auf dem Lieferschein steht es später mit auf dem Blatt.
 *
 * **Warum in die Mediathek und nicht zu den Werkstattdateien.** Dort liegen
 * Zeichnungen — große Dateien, die keiner umrechnet und die als Anhang
 * herausgehen. Ein Foto, das aufs Papier soll, braucht das Gegenteil: eine
 * kleine Fassung. Die rechnet die Mediathek beim Hochladen aus, und nur die
 * kommt ins PDF (siehe lib/artikelbild.ts). Andernfalls wöge ein Lieferschein
 * mit vier Fotos zwanzig Megabyte, und niemand könnte ihn mailen.
 *
 * Gerechnet wird mit Netz. Ohne Empfang ist das kein Fall für die
 * Warteschlange: Ein Foto von mehreren Megabyte gehört nicht in den
 * Zwischenspeicher des Browsers, und die Übergabe wartet ohnehin nicht auf
 * ein Blatt Papier.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const { id } = await params
    const formular = await req.formData()
    const datei = formular.get('datei')
    const bemerkung = String(formular.get('bemerkung') ?? '')
      .trim()
      .slice(0, 200)

    if (!(datei instanceof File)) return NextResponse.json({ error: 'keine-datei' }, { status: 400 })
    if (!ERLAUBT.test(datei.type)) return NextResponse.json({ error: 'dateityp' }, { status: 400 })
    if (datei.size > MAX_BYTES) return NextResponse.json({ error: 'zu-gross' }, { status: 400 })

    const auftrag = await payload
      .findByID({ collection: 'jobs', id, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!auftrag) return NextResponse.json({ error: 'nicht-gefunden' }, { status: 404 })

    const daten = Buffer.from(await datei.arrayBuffer())
    const bild = await payload.create({
      collection: 'media',
      overrideAccess: true,
      locale: 'de',
      data: {
        alt: `Übergabe ${auftrag.jobNumber ?? id}${bemerkung ? `: ${bemerkung}` : ''}`.slice(0, 200),
        // intern: Der Kunde bekommt die Fotos im Lieferschein-PDF, nie per Link
        intern: true,
      },
      file: {
        data: daten,
        mimetype: datei.type,
        name: `uebergabe-${auftrag.jobNumber ?? id}-${Date.now()}-${datei.name.replace(
          /[^\w.\-]/g,
          '_',
        )}`.slice(0, 120),
        size: daten.byteLength,
      },
    })

    /*
     * Angehängt, nicht ersetzt — und deshalb wird der Stand vorher gelesen.
     *
     * Zwei Leute, die gleichzeitig fotografieren, sind bei einer Verladung
     * der Normalfall und nicht die Ausnahme. Wer die Liste blind überschreibt,
     * nimmt dem anderen sein Foto weg.
     */
    const bisher = (auftrag.uebergabefotos ?? []) as {
      bild: number | { id: number }
      bemerkung?: string | null
    }[]

    await payload.update({
      collection: 'jobs',
      id,
      overrideAccess: true,
      data: {
        uebergabefotos: [
          ...bisher.map((f) => ({
            bild: typeof f.bild === 'object' ? f.bild.id : f.bild,
            bemerkung: f.bemerkung ?? undefined,
          })),
          { bild: Number(bild.id), bemerkung: bemerkung || undefined },
        ],
      },
    })

    return NextResponse.json({ ok: true, bild: bild.id, url: bild.url })
  } catch (err) {
    console.error('Übergabefoto fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
