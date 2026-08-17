import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { contactEmail } from '../../../../lib/mail'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string
      email?: string
      phone?: string
      message?: string
    }

    const name = body.name?.trim()
    const email = body.email?.trim()
    const message = body.message?.trim()

    if (!name || !email || !message || name.length > 200 || message.length > 5000) {
      return NextResponse.json({ error: 'invalid' }, { status: 400 })
    }

    const to = process.env.NOTIFICATION_EMAIL || process.env.EMAIL_FROM
    if (!to) {
      console.error('Kontaktformular: NOTIFICATION_EMAIL ist nicht konfiguriert')
      return NextResponse.json({ error: 'not-configured' }, { status: 500 })
    }

    const payload = await payloadClient()
    await payload.sendEmail(contactEmail({ name, email, phone: body.phone?.trim(), message }, to))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Kontaktformular fehlgeschlagen:', err)
    return NextResponse.json({ error: 'send-failed' }, { status: 500 })
  }
}
