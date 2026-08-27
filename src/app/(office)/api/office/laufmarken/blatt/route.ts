import { payloadClient } from '../../../../../../lib/data'
import { markenBlatt } from '../../../../../../lib/markenblatt'
import { darf } from '../../../../../../lib/wache'

export const dynamic = 'force-dynamic'

/**
 * Das Druckblatt der Laufmarken als PDF.
 *
 * Ohne `codes`-Parameter kommen alle Marken — das ist der Weg beim ersten
 * Einrichten der Tafel. `?codes=M-001,M-002` druckt gezielt nach, wenn eine
 * Marke verloren ging.
 */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'auftraege.bearbeiten'))) {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  try {
    const gewuenscht = new URL(req.url).searchParams
      .get('codes')
      ?.split(',')
      .map((c) => c.trim())
      .filter(Boolean)

    const { docs } = await payload.find({
      collection: 'job-tags',
      where: gewuenscht?.length ? { code: { in: gewuenscht } } : {},
      limit: 200,
      depth: 0,
      overrideAccess: true,
      sort: 'code',
    })
    const codes = docs.map((d) => d.code).filter((c): c is string => Boolean(c))
    if (!codes.length) return new Response('Keine Marken angelegt', { status: 404 })

    const basis = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const blatt = await markenBlatt(codes, basis)
    return new Response(new Uint8Array(blatt), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="Laufmarken.pdf"',
      },
    })
  } catch (err) {
    console.error('Markenblatt fehlgeschlagen:', err)
    return new Response('Fehlgeschlagen', { status: 500 })
  }
}
