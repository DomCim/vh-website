import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 10 * 1024 * 1024
const ERLAUBT = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic']

/**
 * Nimmt Skizzen und Fotos zu einer Maßanfertigungs-Anfrage entgegen.
 * Bewusst eng gefasst: nur Bilder, höchstens 10 MB, drei Uploads je Viertelstunde.
 */
export async function POST(req: Request) {
  try {
    if (zuVieleAnfragen(`upload:${ipAus(req)}`, 6, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
    }

    const formular = await req.formData()
    const datei = formular.get('datei')
    if (!(datei instanceof File)) {
      return NextResponse.json({ error: 'keine-datei' }, { status: 400 })
    }
    if (!ERLAUBT.includes(datei.type)) {
      return NextResponse.json({ error: 'dateityp' }, { status: 400 })
    }
    if (datei.size > MAX_BYTES) {
      return NextResponse.json({ error: 'zu-gross' }, { status: 400 })
    }

    const payload = await payloadClient()
    const daten = Buffer.from(await datei.arrayBuffer())
    const doc = await payload.create({
      collection: 'media',
      overrideAccess: true,
      locale: 'de',
      data: { alt: `Anfrage: ${datei.name}`.slice(0, 200) },
      file: {
        data: daten,
        mimetype: datei.type,
        name: datei.name.replace(/[^\w.\-]/g, '_').slice(0, 100),
        size: daten.byteLength,
      },
    })

    return NextResponse.json({ id: doc.id, datei: doc.filename })
  } catch (err) {
    console.error('Upload fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
