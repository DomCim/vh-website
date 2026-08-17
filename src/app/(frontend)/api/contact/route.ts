import { NextResponse } from 'next/server'

import { payloadClient } from '../../../../lib/data'
import { contactEmail } from '../../../../lib/mail'
import { sendMail } from '../../../../lib/sendMail'
import { getIntegrations } from '../../../../lib/settings'

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

    const payload = await payloadClient()
    const integrations = await getIntegrations(payload)
    const to = integrations.email.notificationEmail || integrations.email.fromAddress
    if (!to || to === 'noreply@localhost') {
      console.error('Kontaktformular: keine Empfänger-Adresse konfiguriert (Admin → Integrationen)')
      return NextResponse.json({ error: 'not-configured' }, { status: 500 })
    }

    await sendMail(payload, contactEmail({ name, email, phone: body.phone?.trim(), message }, to))

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Kontaktformular fehlgeschlagen:', err)
    return NextResponse.json({ error: 'send-failed' }, { status: 500 })
  }
}
