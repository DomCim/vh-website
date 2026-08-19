import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX_BYTES = 25 * 1024 * 1024
const ERLAUBT = /^(image\/(jpeg|png|webp|avif|heic|heif)|application\/pdf)$/

/** Nimmt den fotografierten oder eingescannten Beleg entgegen. */
export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const formular = await req.formData()
    const datei = formular.get('datei')
    if (!(datei instanceof File)) return NextResponse.json({ error: 'keine-datei' }, { status: 400 })
    if (!ERLAUBT.test(datei.type)) return NextResponse.json({ error: 'dateityp' }, { status: 400 })
    if (datei.size > MAX_BYTES) return NextResponse.json({ error: 'zu-gross' }, { status: 400 })

    const daten = Buffer.from(await datei.arrayBuffer())
    const doc = await payload.create({
      collection: 'media',
      overrideAccess: true,
      locale: 'de',
      data: { alt: `Beleg: ${datei.name}`.slice(0, 200) },
      file: {
        data: daten,
        mimetype: datei.type,
        name: `beleg-${Date.now()}-${datei.name.replace(/[^\w.\-]/g, '_')}`.slice(0, 120),
        size: daten.byteLength,
      },
    })

    return NextResponse.json({ id: doc.id, url: doc.url, datei: doc.filename })
  } catch (err) {
    console.error('Beleg-Upload fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
