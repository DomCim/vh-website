import nodemailer from 'nodemailer'
import type { Payload } from 'payload'

import { benachrichtige } from './push'
import { getIntegrations } from './settings'

export type MailArt =
  | 'bestellung'
  | 'fertigung'
  | 'versand'
  | 'anfrage'
  | 'zugangscode'
  | 'postfach'
  | 'sonstiges'

export type MailInput = {
  to: string
  subject: string
  html: string
  replyTo?: string
  attachments?: { filename: string; content: Buffer; contentType?: string }[]
  /** Wofür die Mail steht — landet im Ausgangsprotokoll */
  art?: MailArt
  /** Bezug für die Nachverfolgung */
  bezug?: { order?: number | string; inquiry?: number | string }
}

/**
 * Trägt einen Versuch ins Ausgangsprotokoll ein.
 *
 * Das Protokoll darf den Versand nie aufhalten: Wenn das Schreiben scheitert,
 * ist die Mail trotzdem raus, und das ist das Wichtigere.
 */
async function protokollieren(
  payload: Payload,
  mail: MailInput,
  absender: string,
  status: 'gesendet' | 'fehler' | 'ohneVersand',
  fehler?: string,
): Promise<void> {
  try {
    await payload.create({
      collection: 'mail-log',
      overrideAccess: true,
      data: {
        to: mail.to,
        from: absender,
        subject: mail.subject,
        status,
        kind: mail.art ?? 'sonstiges',
        error: fehler,
        attachments: (mail.attachments ?? []).map((a) => a.filename).join(', ') || undefined,
        order: mail.bezug?.order as number | undefined,
        inquiry: mail.bezug?.inquiry as number | undefined,
      },
    })
  } catch (err) {
    payload.logger.error({ err }, 'Ausgangsprotokoll konnte nicht geschrieben werden')
  }

  // Eine nicht zugestellte Bestellbestätigung merkt sonst niemand
  if (status === 'fehler') {
    await benachrichtige(payload, {
      titel: 'E-Mail nicht zugestellt',
      text: `„${mail.subject}" an ${mail.to} ging nicht raus.`,
      url: '/office/post/protokoll?filter=fehler',
      tag: 'mail-fehler',
    }).catch(() => undefined)
  }
}

/**
 * Versendet E-Mails über die im Admin hinterlegten SMTP-Einstellungen
 * (Fallback: Umgebungsvariablen). Ohne SMTP-Server wird die Mail nur geloggt.
 *
 * Jeder Versuch steht danach im Ausgangsprotokoll — auch der gescheiterte.
 */
export async function sendMail(payload: Payload, mail: MailInput): Promise<void> {
  const { email } = await getIntegrations(payload)
  const absender = `${email.fromName} <${email.fromAddress}>`

  if (!email.smtpHost) {
    payload.logger.info(
      { to: mail.to, subject: mail.subject },
      'Kein SMTP-Server konfiguriert — E-Mail wird nur geloggt',
    )
    await protokollieren(payload, mail, absender, 'ohneVersand')
    return
  }

  const transport = nodemailer.createTransport({
    host: email.smtpHost,
    port: email.smtpPort,
    secure: email.smtpPort === 465,
    auth: email.smtpUser ? { user: email.smtpUser, pass: email.smtpPass } : undefined,
  })

  try {
    await transport.sendMail({
      from: `"${email.fromName}" <${email.fromAddress}>`,
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      attachments: mail.attachments,
    })
    await protokollieren(payload, mail, absender, 'gesendet')
  } catch (err) {
    await protokollieren(
      payload,
      mail,
      absender,
      'fehler',
      err instanceof Error ? err.message : String(err),
    )
    throw err
  }
}
