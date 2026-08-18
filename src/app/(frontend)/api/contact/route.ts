import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { contactEmail } from '../../../../lib/mail'
import { ipAus, zuVieleAnfragen } from '../../../../lib/rateLimit'
import { sendMail } from '../../../../lib/sendMail'
import { getIntegrations } from '../../../../lib/settings'

export const dynamic = 'force-dynamic'

type Eingang = {
  name?: string
  email?: string
  phone?: string
  message?: string
  productTitle?: string
  productUrl?: string
  locale?: string
  /** Honigtopf: für Menschen unsichtbar, Bots füllen ihn aus */
  website?: string
  custom?: {
    width?: number
    depth?: number
    height?: number
    color?: string
    purpose?: string
    desiredDate?: string
  }
  attachmentIds?: number[]
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Eingang

    // Honigtopf: still mit ok antworten, damit der Bot nichts lernt
    if (body.website?.trim()) return NextResponse.json({ ok: true })

    if (zuVieleAnfragen(`kontakt:${ipAus(req)}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: 'zu-viele-anfragen' }, { status: 429 })
    }

    const name = body.name?.trim()
    const email = body.email?.trim()
    const message = body.message?.trim()

    if (!name || !email || !message || name.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }

    const payload = await payloadClient()
    const istMassanfertigung = Boolean(
      body.custom && Object.values(body.custom).some((v) => v !== undefined && v !== ''),
    )
    const art = istMassanfertigung ? 'massanfertigung' : body.productTitle ? 'produkt' : 'kontakt'

    // Zuerst speichern: ein Lead darf nicht verloren gehen, nur weil die Mail scheitert.
    let anfrageId: number | string | null = null
    try {
      const doc = await payload.create({
        collection: 'inquiries',
        overrideAccess: true,
        data: {
          type: art,
          status: 'neu',
          name,
          email,
          phone: body.phone?.trim(),
          message,
          productTitle: body.productTitle?.trim().slice(0, 200),
          productUrl: body.productUrl?.trim().slice(0, 500),
          locale: body.locale?.slice(0, 5),
          ...(istMassanfertigung ? { custom: body.custom } : {}),
          ...(body.attachmentIds?.length ? { attachments: body.attachmentIds } : {}),
        },
      })
      anfrageId = doc.id
    } catch (err) {
      console.error('Anfrage konnte nicht gespeichert werden:', err)
    }

    const integrations = await getIntegrations(payload)
    const to = integrations.email.notificationEmail || integrations.email.fromAddress
    if (!to || to === 'noreply@localhost') {
      console.error('Kontaktformular: keine Empfänger-Adresse konfiguriert (Admin → Integrationen)')
      // Gespeichert ist sie trotzdem — im Admin unter „Anfragen" sichtbar.
      return NextResponse.json(
        anfrageId ? { ok: true, hinweis: 'nur-gespeichert' } : { error: 'not-configured' },
        { status: anfrageId ? 200 : 500 },
      )
    }

    try {
      await sendMail(payload, {
        ...contactEmail(
          {
            name,
            email,
            phone: body.phone?.trim(),
            message: istMassanfertigung ? `${message}\n\n${massText(body)}` : message,
            productTitle: body.productTitle?.trim().slice(0, 200),
            productUrl: body.productUrl?.trim().slice(0, 500),
          },
          to,
        ),
        art: 'anfrage',
        bezug: anfrageId ? { inquiry: anfrageId } : undefined,
      })
    } catch (err) {
      console.error('Kontakt-Mail konnte nicht gesendet werden:', err)
      if (!anfrageId) return NextResponse.json({ error: 'send-failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Kontaktformular fehlgeschlagen:', err)
    return NextResponse.json({ error: 'send-failed' }, { status: 500 })
  }
}

/** Maß-Angaben lesbar an die Benachrichtigungs-Mail anhängen */
function massText(body: Eingang): string {
  const c = body.custom ?? {}
  const zeilen = [
    c.width || c.depth || c.height
      ? `Maße: ${[c.width, c.depth, c.height].map((v) => v ?? '?').join(' × ')} cm (B × T × H)`
      : null,
    c.color ? `Wunschfarbe: ${c.color}` : null,
    c.purpose ? `Verwendung: ${c.purpose}` : null,
    c.desiredDate ? `Wunschtermin: ${c.desiredDate}` : null,
    body.attachmentIds?.length ? `${body.attachmentIds.length} Bild(er) angehängt` : null,
  ].filter(Boolean)
  return ['— Angaben zur Maßanfertigung —', ...zeilen].join('\n')
}
