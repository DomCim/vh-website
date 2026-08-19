import { payloadClient } from '../../../../../../lib/data'
import { anhangLaden, postfachFinden } from '../../../../../../lib/postfach'
import { darf } from '../../../../../../lib/wache'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Einen Anhang aus einer Mail herunterladen. */
export async function GET(req: Request) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || !(await darf(payload, user, 'postfach.lesen'))) {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const url = new URL(req.url)
  const uid = Number(url.searchParams.get('uid'))
  const name = url.searchParams.get('name')
  if (!uid || !name) return new Response('Fehlende Angaben', { status: 400 })

  const fach = await postfachFinden(payload, url.searchParams.get('fach'))
  if (!fach) return new Response('Postfach unbekannt', { status: 404 })

  try {
    const datei = await anhangLaden(fach, url.searchParams.get('ordner') || 'INBOX', uid, name)
    if (!datei) return new Response('Nicht gefunden', { status: 404 })

    return new Response(new Uint8Array(datei.daten), {
      headers: {
        'Content-Type': datei.typ,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(name)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('Anhang laden fehlgeschlagen:', err)
    return new Response('Postfach nicht erreichbar', { status: 502 })
  }
}
