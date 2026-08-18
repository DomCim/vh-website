import nodemailer from 'nodemailer'
import type { Payload } from 'payload'

import { getIntegrations } from './settings'

export type MailInput = {
  to: string
  subject: string
  html: string
  replyTo?: string
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
}

/**
 * Versendet E-Mails über die im Admin hinterlegten SMTP-Einstellungen
 * (Fallback: Umgebungsvariablen). Ohne SMTP-Server wird die Mail nur geloggt.
 */
export async function sendMail(payload: Payload, mail: MailInput): Promise<void> {
  const { email } = await getIntegrations(payload)

  if (!email.smtpHost) {
    payload.logger.info(
      { to: mail.to, subject: mail.subject },
      'Kein SMTP-Server konfiguriert — E-Mail wird nur geloggt',
    )
    return
  }

  const transport = nodemailer.createTransport({
    host: email.smtpHost,
    port: email.smtpPort,
    secure: email.smtpPort === 465,
    auth: email.smtpUser ? { user: email.smtpUser, pass: email.smtpPass } : undefined,
  })

  await transport.sendMail({
    from: `"${email.fromName}" <${email.fromAddress}>`,
    to: mail.to,
    replyTo: mail.replyTo,
    subject: mail.subject,
    html: mail.html,
    attachments: mail.attachments,
  })
}
