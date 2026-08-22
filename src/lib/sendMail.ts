import nodemailer from 'nodemailer'
import type { Payload, PayloadRequest } from 'payload'

import { dkimFuer } from './dkim'
import { logoAnhang } from './mail'
import { benachrichtige } from './push'
import { getIntegrations } from './settings'

export type MailArt =
  | 'bestellung'
  | 'fertigung'
  | 'versand'
  | 'auftrag-fertigung'
  | 'auftrag-fertig'
  | 'auftrag-geliefert'
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
  bezug?: { order?: number | string; inquiry?: number | string; job?: number | string }
  /*
   * Die laufende Anfrage, wenn die Mail aus einem Hook kommt.
   *
   * Ohne sie schreibt das Ausgangsprotokoll auf einer **eigenen** Verbindung —
   * und das ist keine Feinheit, sondern eine Sperre: Der Protokolleintrag
   * verweist auf Bestellung, Anfrage oder Auftrag, und für diesen Verweis
   * braucht die Datenbank die betreffende Zeile. Hält die noch offene
   * Transaktion des Hooks genau diese Zeile fest, wartet das Protokoll auf sie
   * — und der Hook wartet auf das Protokoll. Beide warten, bis der Browser
   * aufgibt.
   *
   * Mit `req` läuft das Protokoll in derselben Transaktion mit, und die Frage
   * stellt sich nicht.
   */
  req?: PayloadRequest
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
        job: mail.bezug?.job as number | undefined,
      },
      ...(mail.req ? { req: mail.req } : {}),
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

  const dkim = dkimFuer(email.fromAddress, undefined, email.dkim, (grund) =>
    payload.logger.warn({ absender: email.fromAddress }, grund),
  )

  const transport = nodemailer.createTransport({
    host: email.smtpHost,
    port: email.smtpPort,
    secure: email.smtpPort === 465,
    auth: email.smtpUser ? { user: email.smtpUser, pass: email.smtpPass } : undefined,
    /*
     * DKIM unterschreibt die Mail, damit sie nicht im Spam landet. Nodemailer
     * kann das von Haus aus; hinterlegt wird es im Admin unter Integrationen.
     * Ohne vollständige Angaben bleibt das Feld leer und es wird wie bisher
     * unsigniert verschickt. Passt die hinterlegte Domain nicht zur
     * Absenderadresse, wird ebenfalls nicht signiert — eine Unterschrift im
     * Namen einer fremden Domain zählt beim Empfänger nicht (siehe `dkim.ts`).
     */
    ...(dkim ? { dkim } : {}),
  })

  // Das Logo reist als Anhang mit — nachgeladene Bilder blockieren die
  // meisten Mailprogramme, und dann stünde die Mail ohne Kopf da
  const anhangLogo = logoAnhang(mail.html)

  try {
    await transport.sendMail({
      from: `"${email.fromName}" <${email.fromAddress}>`,
      to: mail.to,
      replyTo: mail.replyTo,
      subject: mail.subject,
      html: mail.html,
      attachments: [...anhangLogo, ...(mail.attachments ?? [])],
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
