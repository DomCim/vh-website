import fs from 'node:fs'
import path from 'node:path'

import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { darf } from '../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Die Verfahrensdokumentation als Datei — für die Kanzlei oder die Prüfung.
 *
 * Dieselbe Datei, die im Repository liegt und die Seite `/office/verfahren`
 * anzeigt. Kein zweiter Text, der auseinanderlaufen könnte.
 */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'zahlen.sehen'))) {
    return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
  }

  try {
    const text = fs.readFileSync(path.join(process.cwd(), 'VERFAHRENSDOKUMENTATION.md'), 'utf8')
    return new NextResponse(text, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="Verfahrensdokumentation.md"',
      },
    })
  } catch {
    return NextResponse.json({ error: 'nicht-vorhanden' }, { status: 404 })
  }
}
