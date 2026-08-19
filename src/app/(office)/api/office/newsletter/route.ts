import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../../lib/data'
import { newsletterVersenden, type Sprache } from '../../../../../lib/newsletter'

export const dynamic = 'force-dynamic'
// Ein paar hundert Empfänger nacheinander brauchen Zeit
export const maxDuration = 900

/** Absätze aus dem Eingabefeld in schlichtes HTML — kein Editor, keine Überraschungen. */
function absaetze(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((a) => a.trim())
    .filter(Boolean)
    .map(
      (a) =>
        `<p style="margin:0 0 14px">${a
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/\n/g, '<br />')}</p>`,
    )
    .join('\n')
}

export async function POST(req: Request) {
  try {
    const payload = await payloadClient()
    const { user } = await payload.auth({ headers: req.headers })
    if (!user || (user as { role?: string }).role !== 'inhaber') {
      return NextResponse.json({ error: 'nicht-erlaubt' }, { status: 403 })
    }

    const b = (await req.json()) as {
      betreff?: string
      text?: string
      link?: string
      linkText?: string
      testAn?: string
      sprachen?: Sprache[]
    }

    const betreff = b.betreff?.trim()
    const text = b.text?.trim()
    if (!betreff || !text) return NextResponse.json({ error: 'unvollstaendig' }, { status: 400 })

    const knopf = b.link?.trim()
      ? `<p style="margin:24px 0"><a href="${b.link.trim()}" style="background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 22px;display:inline-block;font-size:13px">${
          b.linkText?.trim() || 'Ansehen'
        }</a></p>`
      : ''

    const bericht = await newsletterVersenden(
      payload,
      { betreff, html: `${absaetze(text)}${knopf}` },
      { nurAn: b.testAn?.trim() || undefined, sprachen: b.sprachen },
    )

    return NextResponse.json({ ok: true, ...bericht, test: Boolean(b.testAn?.trim()) })
  } catch (err) {
    console.error('Newsletter-Versand fehlgeschlagen:', err)
    return NextResponse.json({ error: 'fehlgeschlagen' }, { status: 500 })
  }
}
