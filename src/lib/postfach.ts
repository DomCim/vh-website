import fs from 'fs'
import path from 'path'

import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { Payload } from 'payload'

import { dkimFuer } from './dkim'
import { briefbogen as briefbogenVorlage, pflichtangaben, type CompanyInfo } from './mail'
import type { MailboxKonfiguration } from './settings'
import { firmenAngaben, getIntegrations } from './settings'

/**
 * Postfach im Büro.
 *
 * Gelesen wird direkt per IMAP beim Anbieter — es wird nichts in die Datenbank
 * kopiert. Damit bleibt der Posteingang die eine Wahrheit, egal ob Vincent
 * hier oder am Telefon draufschaut, und gelöschte Mails bleiben gelöscht.
 *
 * Es kann mehrere Postfächer geben (info@, bestellungen@ …). Die Adresse, mit
 * der die Website selbst verschickt (noreply@), steht getrennt davon in den
 * SMTP-Einstellungen — dorthin antwortet ohnehin niemand.
 *
 * Für jeden Aufruf wird eine eigene Verbindung geöffnet und wieder geschlossen.
 * Eine dauerhaft offene Verbindung wäre schneller, überlebt aber weder einen
 * Neustart des Containers noch mehrere Instanzen.
 */

export type Kopfzeile = {
  uid: number
  betreff: string
  von: string
  vonAdresse: string
  an: string
  datum: string | null
  gelesen: boolean
  markiert: boolean
  anhaenge: boolean
}

export type Nachricht = Kopfzeile & {
  text: string
  html: string | null
  messageId?: string
  antwortAn?: string
  dateien: { name: string; groesse: number; typ: string }[]
}

export type Ordner = { pfad: string; name: string; ungelesen: number; art: string }

/** Alle eingerichteten Postfächer. */
export async function postfaecher(payload: Payload): Promise<MailboxKonfiguration[]> {
  const { mailboxes } = await getIntegrations(payload)
  return mailboxes
}

/** Ein bestimmtes Postfach — ohne Angabe das voreingestellte, sonst das erste. */
export async function postfachFinden(
  payload: Payload,
  id?: string | null,
): Promise<MailboxKonfiguration | null> {
  const faecher = await postfaecher(payload)
  if (!faecher.length) return null
  if (id) return faecher.find((f) => f.id === id) ?? null
  return faecher.find((f) => f.isDefault) ?? faecher[0]
}

async function mitVerbindung<T>(
  fach: MailboxKonfiguration,
  arbeit: (client: ImapFlow) => Promise<T>,
): Promise<T> {
  const client = new ImapFlow({
    host: fach.imapHost,
    port: fach.imapPort,
    secure: fach.imapSecure,
    auth: { user: fach.user, pass: fach.pass },
    logger: false,
  })
  await client.connect()
  try {
    return await arbeit(client)
  } finally {
    await client.logout().catch(() => client.close())
  }
}

const adresse = (a: { name?: string; address?: string }[] | undefined) =>
  (a ?? [])
    .map((x) => x.name || x.address || '')
    .filter(Boolean)
    .join(', ')

const ersteAdresse = (a: { address?: string }[] | undefined) => a?.[0]?.address ?? ''

/** Welche Ordner es gibt, mit der Zahl der ungelesenen Mails. */
export async function ordnerListe(fach: MailboxKonfiguration): Promise<Ordner[]> {
  return mitVerbindung(fach, async (client) => {
    const liste = await client.list()
    const ordner: Ordner[] = []
    for (const o of liste) {
      if (o.flags?.has('\\Noselect')) continue
      let ungelesen = 0
      try {
        const status = await client.status(o.path, { unseen: true })
        ungelesen = status.unseen ?? 0
      } catch {
        // Manche Ordner lassen sich nicht abfragen — dann eben ohne Zähler
      }
      ordner.push({ pfad: o.path, name: o.name, ungelesen, art: o.specialUse ?? '' })
    }
    return ordner
  })
}

/**
 * Die neuesten Nachrichten eines Ordners.
 *
 * Geladen werden nur Kopfzeilen — der volle Text kommt erst, wenn eine Mail
 * geöffnet wird. Sonst würde jeder Aufruf bei großen Postfächern minutenlang
 * dauern.
 */
export async function nachrichtenListe(
  fach: MailboxKonfiguration,
  ordner = 'INBOX',
  anzahl = 40,
  vorSeq?: number,
): Promise<{ nachrichten: Kopfzeile[]; gesamt: number; aeltesteSeq: number }> {
  return mitVerbindung(fach, async (client) => {
    const schloss = await client.getMailboxLock(ordner)
    try {
      const box = client.mailbox
      const gesamt = typeof box === 'object' ? box.exists : 0
      if (!gesamt) return { nachrichten: [], gesamt: 0, aeltesteSeq: 0 }

      // Von hinten nach vorne: das Neueste zuerst
      const bis = vorSeq && vorSeq > 1 ? vorSeq - 1 : gesamt
      const von = Math.max(1, bis - anzahl + 1)
      if (bis < 1) return { nachrichten: [], gesamt, aeltesteSeq: 0 }

      const nachrichten: Kopfzeile[] = []
      for await (const m of client.fetch(
        { seq: `${von}:${bis}` },
        { uid: true, envelope: true, flags: true, bodyStructure: true },
      )) {
        const anhaenge = Boolean(
          m.bodyStructure?.childNodes?.some(
            (n) => n.disposition === 'attachment' || (n.type && !n.type.startsWith('text/')),
          ),
        )
        nachrichten.push({
          uid: m.uid,
          betreff: m.envelope?.subject || '(kein Betreff)',
          von: adresse(m.envelope?.from) || '(unbekannt)',
          vonAdresse: ersteAdresse(m.envelope?.from),
          an: adresse(m.envelope?.to),
          datum: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null,
          gelesen: Boolean(m.flags?.has('\\Seen')),
          markiert: Boolean(m.flags?.has('\\Flagged')),
          anhaenge,
        })
      }
      nachrichten.reverse()
      return { nachrichten, gesamt, aeltesteSeq: von }
    } finally {
      schloss.release()
    }
  })
}

/** Eine einzelne Nachricht mit Text, HTML und Anhangsliste. */
export async function nachrichtLesen(
  fach: MailboxKonfiguration,
  ordner: string,
  uid: number,
): Promise<Nachricht | null> {
  return mitVerbindung(fach, async (client) => {
    const schloss = await client.getMailboxLock(ordner)
    try {
      const roh = await client.download(String(uid), undefined, { uid: true })
      if (!roh?.content) return null
      const mail = await simpleParser(roh.content)

      // Gelesen markieren — wer eine Mail öffnet, hat sie gelesen
      await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true }).catch(() => undefined)

      const zuText = (a: unknown): string => {
        if (!a) return ''
        const wert = a as { text?: string; value?: { name?: string; address?: string }[] }
        if (wert.text) return wert.text
        return adresse(wert.value)
      }

      return {
        uid,
        betreff: mail.subject || '(kein Betreff)',
        von: mail.from?.text || '(unbekannt)',
        vonAdresse: mail.from?.value?.[0]?.address ?? '',
        an: zuText(mail.to),
        datum: mail.date ? mail.date.toISOString() : null,
        gelesen: true,
        markiert: false,
        anhaenge: (mail.attachments ?? []).length > 0,
        text: mail.text ?? '',
        html: typeof mail.html === 'string' ? mail.html : null,
        messageId: mail.messageId,
        antwortAn: mail.replyTo?.value?.[0]?.address ?? mail.from?.value?.[0]?.address,
        dateien: (mail.attachments ?? []).map((a) => ({
          name: a.filename ?? 'Anhang',
          groesse: a.size ?? 0,
          typ: a.contentType ?? 'application/octet-stream',
        })),
      }
    } finally {
      schloss.release()
    }
  })
}

/** Einen Anhang herunterladen. */
export async function anhangLaden(
  fach: MailboxKonfiguration,
  ordner: string,
  uid: number,
  name: string,
): Promise<{ daten: Buffer; typ: string } | null> {
  return mitVerbindung(fach, async (client) => {
    const schloss = await client.getMailboxLock(ordner)
    try {
      const roh = await client.download(String(uid), undefined, { uid: true })
      if (!roh?.content) return null
      const mail = await simpleParser(roh.content)
      const treffer = (mail.attachments ?? []).find((a) => a.filename === name)
      if (!treffer) return null
      return {
        daten: treffer.content as Buffer,
        typ: treffer.contentType ?? 'application/octet-stream',
      }
    } finally {
      schloss.release()
    }
  })
}

/** Gelesen-Markierung setzen oder nehmen, markieren, löschen. */
export async function nachrichtAendern(
  fach: MailboxKonfiguration,
  ordner: string,
  uid: number,
  aktion: 'gelesen' | 'ungelesen' | 'markiert' | 'unmarkiert' | 'loeschen',
): Promise<void> {
  await mitVerbindung(fach, async (client) => {
    const schloss = await client.getMailboxLock(ordner)
    try {
      if (aktion === 'loeschen') {
        // In den Papierkorb verschieben statt endgültig löschen — ein Fehlgriff
        // am Handy soll nicht das Einzige sein, was von einer Mail übrig bleibt
        try {
          await client.messageMove(String(uid), fach.trashMailbox, { uid: true })
        } catch {
          await client.messageFlagsAdd(String(uid), ['\\Deleted'], { uid: true })
        }
        return
      }
      const fahne = aktion === 'gelesen' || aktion === 'ungelesen' ? '\\Seen' : '\\Flagged'
      const setzen = aktion === 'gelesen' || aktion === 'markiert'
      if (setzen) await client.messageFlagsAdd(String(uid), [fahne], { uid: true })
      else await client.messageFlagsRemove(String(uid), [fahne], { uid: true })
    } finally {
      schloss.release()
    }
  })
}

/**
 * Mail aus dem Büro schreiben — über SMTP raus, Kopie in „Gesendet",
 * Eintrag ins Ausgangsprotokoll.
 *
 * Die Kopie ist der Grund, warum das nicht einfach `sendMail` ist: Sonst fehlt
 * die Antwort im Postfach, sobald man am Rechner nachschaut.
 */
/** Fremdtext gehört escaped in eine HTML-Mail, sonst zerlegt ein Preis „<" das Layout */
const sicher = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Getippter Text auf dem gemeinsamen Briefbogen — derselbe wie bei den Website-Mails */
export function briefbogen(rumpf: string, signatur: string, firma?: CompanyInfo): string {
  return briefbogenVorlage(
    `<div style="white-space:pre-wrap">${sicher(rumpf)}</div>` +
      (signatur
        ? `<div style="margin-top:24px;white-space:pre-wrap;color:#444">${sicher(signatur)}</div>`
        : ''),
    firma,
  )
}

/** Signatur aus dem Postfach, sonst aus Absendername und Kontaktdaten */
function signaturText(
  fach: MailboxKonfiguration,
  absenderName: string,
  kontakt: { phone?: string | null; website?: string | null },
): string {
  if (fach.signature?.trim()) return fach.signature.trim()
  return [
    'Mit freundlichen Grüßen',
    absenderName,
    fach.address,
    kontakt.phone || null,
    kontakt.website || null,
  ]
    .filter(Boolean)
    .join('\n')
}

export async function nachrichtSenden(
  payload: Payload,
  fach: MailboxKonfiguration,
  eingabe: {
    an: string
    betreff: string
    text: string
    antwortAufMessageId?: string
    dateien?: { name: string; inhalt: Buffer; typ?: string }[]
  },
): Promise<void> {
  const { email } = await getIntegrations(payload)

  const host = fach.smtpHost || email.smtpHost
  if (!host) throw new Error('Kein SMTP-Server hinterlegt')
  const port = fach.smtpHost ? (fach.smtpPort ?? 587) : email.smtpPort
  const benutzer = fach.smtpHost ? fach.smtpUser : email.smtpUser
  const passwort = fach.smtpHost ? fach.smtpPass : email.smtpPass

  /*
   * Auch die Post aus dem Büro wird unterschrieben, nicht nur das, was die
   * Website selbst verschickt — sonst landet ausgerechnet die persönliche
   * Antwort an die Kundschaft im Spam. Am Postfach eingetragene Angaben
   * gelten; sonst die allgemeine, sofern ihre Domain zur Absenderadresse
   * dieses Postfachs passt (siehe `dkim.ts`).
   */
  const dkim = dkimFuer(fach.address, fach.dkim, email.dkim, (grund) =>
    payload.logger.warn({ postfach: fach.address }, grund),
  )

  const transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: benutzer ? { user: benutzer, pass: passwort } : undefined,
    ...(dkim ? { dkim } : {}),
  })

  // Briefbogen zusammenstellen — Pflichtangaben kommen aus den
  // Website-Einstellungen und lassen sich nicht wegkonfigurieren
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  const firma = firmenAngaben(settings)
  const signatur = signaturText(fach, email.fromName, {
    phone: (settings as Record<string, any>)?.contact?.phone,
    website: (settings as Record<string, any>)?.contact?.website,
  })
  const angaben = pflichtangaben(firma)

  const logoDatei = path.join(process.cwd(), 'public', 'logo.png')
  const logoAnhang = fs.existsSync(logoDatei)
    ? [{ filename: 'logo.png', path: logoDatei, cid: 'vh-logo' }]
    : []

  const nachricht = {
    from: `"${email.fromName}" <${fach.address}>`,
    to: eingabe.an,
    subject: eingabe.betreff,
    // Nur-Text-Fassung bleibt dabei: Manche lesen so, und Spamfilter mögen es
    text: [eingabe.text, signatur, angaben.join(' · ')].filter(Boolean).join('\n\n--\n'),
    html: briefbogen(eingabe.text, signatur, firma),
    inReplyTo: eingabe.antwortAufMessageId,
    references: eingabe.antwortAufMessageId,
    attachments: [
      ...logoAnhang,
      ...(eingabe.dateien ?? []).map((d) => ({
        filename: d.name,
        content: d.inhalt,
        contentType: d.typ,
      })),
    ],
  }

  // Einmal bauen, zweimal verwenden: einmal verschicken, einmal ablegen —
  // sonst steht im Ordner „Gesendet" eine andere Mail als beim Empfänger
  const roh = await new MailComposer(nachricht).compile().build()

  try {
    await transport.sendMail(nachricht)
  } catch (err) {
    await protokoll(payload, fach, eingabe, 'fehler', err instanceof Error ? err.message : String(err))
    throw err
  }
  await protokoll(payload, fach, eingabe, 'gesendet')

  try {
    await mitVerbindung(fach, async (client) => {
      await client.append(fach.sentMailbox, roh, ['\\Seen'])
    })
  } catch (err) {
    payload.logger.warn({ err }, 'Kopie der gesendeten Mail konnte nicht abgelegt werden')
  }
}

async function protokoll(
  payload: Payload,
  fach: MailboxKonfiguration,
  eingabe: { an: string; betreff: string; dateien?: { name: string }[] },
  status: 'gesendet' | 'fehler',
  fehler?: string,
): Promise<void> {
  try {
    await payload.create({
      collection: 'mail-log',
      overrideAccess: true,
      data: {
        to: eingabe.an,
        from: fach.address,
        subject: eingabe.betreff,
        status,
        kind: 'postfach',
        error: fehler,
        attachments: (eingabe.dateien ?? []).map((d) => d.name).join(', ') || undefined,
      },
    })
  } catch (err) {
    payload.logger.error({ err }, 'Ausgangsprotokoll konnte nicht geschrieben werden')
  }
}

/** Anzahl ungelesener Mails im Posteingang — für Anzeige und Benachrichtigung. */
export async function ungeleseneAnzahl(fach: MailboxKonfiguration): Promise<number> {
  return mitVerbindung(fach, async (client) => {
    const status = await client.status('INBOX', { unseen: true })
    return status.unseen ?? 0
  })
}
