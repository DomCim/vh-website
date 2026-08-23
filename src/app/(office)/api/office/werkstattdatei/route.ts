import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'
import { wegwerfen } from '@/lib/wegwerfen'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/*
 * Wie groß darf eine Werkstattdatei sein?
 *
 * Eine DXF ist ein paar hundert Kilobyte, ein NC-Programm noch weniger. Groß
 * werden nur Zusammenbauzeichnungen als PDF und gelegentlich ein STEP-Modell.
 * 60 MB lässt beides durch und hält zugleich davon ab, ein ganzes CAD-Archiv
 * über die Warteschlange zu schieben.
 */
const MAX_BYTES = 60 * 1024 * 1024

/**
 * Werkstattdateien an einer Artikelvariante.
 *
 * Hochladen, umbenennen, verschieben, löschen — und die Ordner dazu, die am
 * Artikel stehen (`fileFolders`).
 *
 * Zwei Rechte, nicht eines: **Lesen und Herunterladen** darf jeder im Büro,
 * denn die Werkstatt braucht die Zeichnung und muss dafür keine Preise ändern
 * dürfen. **Ändern** verlangt `website.pflegen` — dasselbe Recht wie für den
 * Artikel selbst, an dem die Datei hängt.
 */

/** Ein Ordnername, der als Dateiname und in einer Liste funktioniert */
function ordnerName(wert: unknown): string {
  return String(wert ?? '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)
}

export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || !(await darf(payload, user, 'website.pflegen'))) {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const typ = req.headers.get('content-type') ?? ''

    // ── Datei hochladen ───────────────────────────────────────────────────
    if (typ.includes('multipart/form-data')) {
      const formular = await req.formData()
      const datei = formular.get('datei')
      if (!(datei instanceof File)) {
        return NextResponse.json({ error: 'keine-datei' }, { status: 400 })
      }
      if (datei.size > MAX_BYTES) return NextResponse.json({ error: 'zu-gross' }, { status: 400 })

      const produkt = Number(formular.get('product'))
      if (!produkt) return NextResponse.json({ error: 'kein-artikel' }, { status: 400 })

      const daten = Buffer.from(await datei.arrayBuffer())

      /*
       * Der Dateiname auf der Platte bekommt einen Zeitstempel.
       *
       * Zwei Varianten desselben Artikels heißen ihre Laserdatei gern gleich
       * („zuschnitt.dxf"). Ohne eigenen Namen überschriebe die zweite die
       * erste — und im Büro stünden zwei Einträge, hinter denen dieselbe
       * Datei liegt. Wie sie heißt, steht in `label`; heruntergeladen wird
       * unter diesem Namen.
       */
      const sauber = datei.name.replace(/[^\w.\- ]/g, '_').slice(0, 90)
      const doc = await payload.create({
        collection: 'product-files',
        overrideAccess: true,
        data: {
          product: produkt,
          variantId: String(formular.get('variantId') ?? '') || undefined,
          variantTitle: String(formular.get('variantTitle') ?? '') || undefined,
          folder: ordnerName(formular.get('folder')) || undefined,
          label: datei.name.slice(0, 200),
          note: String(formular.get('note') ?? '') || undefined,
        },
        file: {
          data: daten,
          mimetype: datei.type || 'application/octet-stream',
          name: `${Date.now()}-${sauber}`,
          size: daten.byteLength,
        },
      })

      return NextResponse.json({ ok: true, id: doc.id, label: doc.label })
    }

    const b = (await req.json()) as Record<string, any>

    // ── Ordner am Artikel ─────────────────────────────────────────────────
    if (['ordner-anlegen', 'ordner-umbenennen', 'ordner-loeschen'].includes(b.aktion)) {
      const artikel = await payload.findByID({
        collection: 'products',
        id: b.product,
        depth: 0,
        overrideAccess: true,
      })
      const bisher = (artikel.fileFolders ?? []) as { variantId?: string | null; name: string }[]
      const variante = String(b.variantId ?? '')
      const passt = (o: { variantId?: string | null }) => String(o.variantId ?? '') === variante

      if (b.aktion === 'ordner-anlegen') {
        const name = ordnerName(b.name)
        if (!name) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
        if (bisher.some((o) => passt(o) && o.name === name)) {
          return NextResponse.json({ error: 'gibt-es-schon' }, { status: 400 })
        }
        await payload.update({
          collection: 'products',
          id: b.product,
          overrideAccess: true,
          data: { fileFolders: [...bisher, { variantId: variante || undefined, name }] },
        })
        return NextResponse.json({ ok: true, name })
      }

      if (b.aktion === 'ordner-umbenennen') {
        const alt = ordnerName(b.name)
        const neu = ordnerName(b.neuerName)
        if (!alt || !neu) return NextResponse.json({ error: 'kein-name' }, { status: 400 })
        if (bisher.some((o) => passt(o) && o.name === neu)) {
          return NextResponse.json({ error: 'gibt-es-schon' }, { status: 400 })
        }
        await payload.update({
          collection: 'products',
          id: b.product,
          overrideAccess: true,
          data: {
            fileFolders: bisher.map((o) => (passt(o) && o.name === alt ? { ...o, name: neu } : o)),
          },
        })
        /*
         * Die Dateien ziehen mit.
         *
         * Sie tragen den Ordner als Namen und nicht als Verweis — ohne dieses
         * Nachziehen läge nach dem Umbenennen alles in einem Ordner, den es
         * nicht mehr gibt, und wäre im Büro unsichtbar.
         */
        const dateien = await payload.find({
          collection: 'product-files',
          where: { product: { equals: b.product }, folder: { equals: alt } },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        })
        for (const d of dateien.docs) {
          if (String(d.variantId ?? '') !== variante) continue
          await payload.update({
            collection: 'product-files',
            id: d.id,
            overrideAccess: true,
            data: { folder: neu },
          })
        }
        return NextResponse.json({ ok: true, name: neu })
      }

      // Löschen: nur ein leerer Ordner. Ein Ordner, der beim Verschwinden
      // Zeichnungen mitnimmt, ist keine Aufräumhilfe, sondern ein Unfall.
      const name = ordnerName(b.name)
      const drin = await payload.count({
        collection: 'product-files',
        where: { product: { equals: b.product }, folder: { equals: name } },
        overrideAccess: true,
      })
      if (drin.totalDocs > 0) return NextResponse.json({ error: 'nicht-leer' }, { status: 400 })
      await payload.update({
        collection: 'products',
        id: b.product,
        overrideAccess: true,
        data: { fileFolders: bisher.filter((o) => !(passt(o) && o.name === name)) },
      })
      return NextResponse.json({ ok: true })
    }

    // ── Datei ändern oder löschen ─────────────────────────────────────────
    if (b.aktion === 'datei-aendern') {
      const doc = await payload.update({
        collection: 'product-files',
        id: b.id,
        overrideAccess: true,
        data: {
          label: b.label || undefined,
          note: b.note ?? undefined,
          ...(b.folder !== undefined ? { folder: ordnerName(b.folder) || null } : {}),
        },
      })
      return NextResponse.json({ ok: true, id: doc.id })
    }

    if (b.aktion === 'datei-loeschen') {
      await wegwerfen(payload, 'werkstattdateien', b.id)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'unbekannte-aktion' }, { status: 400 })
  } catch (err) {
    console.error('Werkstattdatei fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
