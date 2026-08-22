import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import nodemailer from 'nodemailer'
import MailComposer from 'nodemailer/lib/mail-composer'
import type { Payload } from 'payload'

import { dkimFuer } from './dkim'
import { htmlAlsText, mailHtmlSaeubern } from './mailhtml'
import {
  briefbogen as briefbogenVorlage,
  logoAnhang,
  pflichtangaben,
  type CompanyInfo,
} from './mail'
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

export type Ordner = {
  pfad: string
  name: string
  ungelesen: number
  art: string
  /**
   * Das Zeichen, mit dem der Anbieter Ebenen trennt — bei IONOS ein Punkt,
   * bei anderen ein Schrägstrich. Es kommt aus der Auskunft des Servers und
   * wird nicht geraten: Ein neuer Unterordner mit dem falschen Trenner landet
   * nicht eine Ebene tiefer, sondern als eigener Ordner mit einem Sonderzeichen
   * im Namen.
   */
  trenner: string
}

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

/**
 * Wo die Kopie einer verschickten Mail hingehört.
 *
 * Bisher stand dort stur der eingestellte Name („Sent"). Heißt der Ordner beim
 * Anbieter anders — „INBOX.Sent", „Gesendete Objekte", „Gesendet" —, dann
 * scheitert das Ablegen, und zwar lautlos: Die Mail ist beim Empfänger, im
 * eigenen Postfach fehlt sie. Wer am Rechner nachsieht, hält sie für nie
 * verschickt und schreibt sie ein zweites Mal.
 *
 * Deshalb wird gefragt statt geraten: IMAP kennzeichnet den Ordner selbst mit
 * `\Sent`. Nur wenn der Anbieter das nicht tut, gilt der eingestellte Name —
 * und auch der erst, wenn es ihn wirklich gibt.
 */
async function gesendetOrdner(
  client: ImapFlow,
  fach: MailboxKonfiguration,
): Promise<string | null> {
  const liste = await client.list()
  const gekennzeichnet = liste.find((o) => o.specialUse === '\\Sent')
  if (gekennzeichnet) return gekennzeichnet.path

  const gewuenscht = fach.sentMailbox?.trim().toLowerCase()
  if (!gewuenscht) return null
  const passend = liste.find(
    (o) => o.path.toLowerCase() === gewuenscht || o.name.toLowerCase() === gewuenscht,
  )
  return passend?.path ?? null
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
      ordner.push({
        pfad: o.path,
        name: o.name,
        ungelesen,
        art: o.specialUse ?? '',
        trenner: o.delimiter || '/',
      })
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

/**
 * Die neueste ungelesene Nachricht — nur Absender und Betreff.
 *
 * Für die Meldung aufs Telefon. „Neue Post — eine ungelesene Nachricht" sagt
 * niemandem, ob er das Handy aus der Tasche holen muss; „Amazon.de —
 * Bestellung versandt" schon. Geholt wird deshalb genau eine Kopfzeile, und
 * auch die nur, wenn es überhaupt etwas Neues gibt.
 *
 * `null`, wenn nichts ungelesen ist oder der Anbieter die Suche verweigert —
 * die Meldung geht dann mit dem alten Wortlaut hinaus. Eine Benachrichtigung,
 * die an einer Nebensache scheitert, wäre der schlechtere Tausch.
 */
export async function neuesteUngelesene(fach: MailboxKonfiguration): Promise<Kopfzeile | null> {
  return mitVerbindung(fach, async (client) => {
    const schloss = await client.getMailboxLock('INBOX')
    try {
      const uids = await client.search({ seen: false }, { uid: true })
      if (!uids || uids.length === 0) return null

      // Die höchste Kennung ist die jüngste
      const jüngste = uids[uids.length - 1]
      const m = await client.fetchOne(String(jüngste), { envelope: true, flags: true }, { uid: true })
      if (!m || typeof m === 'boolean') return null

      return {
        uid: m.uid,
        betreff: m.envelope?.subject || '(kein Betreff)',
        von: adresse(m.envelope?.from) || '(unbekannt)',
        vonAdresse: ersteAdresse(m.envelope?.from),
        an: adresse(m.envelope?.to),
        datum: m.envelope?.date ? new Date(m.envelope.date).toISOString() : null,
        gelesen: false,
        markiert: Boolean(m.flags?.has('\\Flagged')),
        anhaenge: false,
      }
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
 * Eine Nachricht in einen anderen Ordner legen.
 *
 * `messageMove` ist eine einzige IMAP-Anweisung — Kopieren und Löschen in
 * einem Zug. Von Hand nachgebaut (kopieren, dann löschen) bliebe bei einem
 * Abbruch dazwischen eine Doppelung zurück, und zwar stillschweigend.
 */
export async function nachrichtVerschieben(
  fach: MailboxKonfiguration,
  ordner: string,
  uid: number,
  ziel: string,
): Promise<void> {
  if (ziel === ordner) return
  await mitVerbindung(fach, async (client) => {
    const schloss = await client.getMailboxLock(ordner)
    try {
      await client.messageMove(String(uid), ziel, { uid: true })
    } finally {
      schloss.release()
    }
  })
}

/**
 * Einen Ordner anlegen.
 *
 * Der Name wird vom Anbieter eingeordnet: Bei manchen liegen eigene Ordner
 * unter `INBOX.`, bei anderen daneben. Deshalb wird hier **nicht** geraten,
 * sondern der Pfad genommen, wie er hereinkommt — die Oberfläche stellt ihn
 * aus dem gerade offenen Ordner zusammen, und der stammt vom Anbieter selbst.
 *
 * Gibt den angelegten Pfad zurück; existiert er schon, ist das kein Fehler,
 * sondern das gewünschte Ergebnis.
 */
export async function ordnerAnlegen(
  fach: MailboxKonfiguration,
  pfad: string,
): Promise<string> {
  return mitVerbindung(fach, async (client) => {
    try {
      const ergebnis = await client.mailboxCreate(pfad)
      return ergebnis.path
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err)
      if (/already exists|ALREADYEXISTS/i.test(text)) return pfad
      throw err
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

/**
 * Derselbe Briefbogen, aber der Rumpf ist schon HTML.
 *
 * Der Unterschied zu oben ist genau einer: Hier wird **nicht** escaped, weil
 * die Auszeichnung gewollt ist. Dafür ist sie vorher durch `mailHtmlSaeubern`
 * gegangen — ungeprüftes HTML einzusetzen wäre die teuerste Zeile der ganzen
 * Datei.
 *
 * Eine Signatur wird hier nicht angehängt: Wenn im Schreibfeld gestaltet wird,
 * steht sie schon im Text, und der Mensch davor hat sie gesehen. Zweimal
 * dieselbe Grußformel ist peinlicher als gar keine.
 */
export function briefbogenAusHtml(rumpf: string, firma?: CompanyInfo): string {
  return briefbogenVorlage(mailHtmlSaeubern(rumpf), firma)
}

/** Signatur aus dem Postfach, sonst aus Absendername und Kontaktdaten */
function signaturText(
  fach: MailboxKonfiguration,
  absenderName: string,
  kontakt: { phone?: string | null; website?: string | null },
): string {
  if (fach.signature?.trim()) {
    const roh = fach.signature.trim()
    /*
     * Die Signatur kann inzwischen gestaltet sein (HTML aus dem Schreibfeld
     * der Einstellungen). Dieser Text hier landet aber nur noch auf den
     * Wegen ohne Gestaltung — Nur-Text-Fassung und Altaufrufer —, also wird
     * sie dafür zurück zu Klartext. Der gestaltete Weg bekommt sie im
     * Schreibfeld ohnehin als HTML vorgelegt.
     */
    return roh.includes('<') ? htmlAlsText(roh) : roh
  }
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
    /** Kopie und Blindkopie, jeweils als Kommaliste — beide freiwillig */
    cc?: string
    bcc?: string
    betreff: string
    /** Nur-Text-Fassung; wird aus `html` abgeleitet, wenn dieses da ist */
    text: string
    /** Gestalteter Rumpf aus dem Schreibfeld — samt Signatur, falls gesetzt */
    html?: string
    antwortAufMessageId?: string
    dateien?: { name: string; inhalt: Buffer; typ?: string }[]
  },
  /** `kopie` sagt, ob die Mail auch im Ordner „Gesendet" gelandet ist */
): Promise<{ kopie: boolean }> {
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


  /*
   * Zwei Wege in denselben Briefbogen.
   *
   * Kommt gestaltetes HTML aus dem Schreibfeld, wird es eingesetzt und die
   * Signatur **nicht** noch einmal angehängt — sie steht dann schon drin, weil
   * das Schreibfeld sie beim Öffnen hineinlegt. Die Nur-Text-Fassung entsteht
   * aus demselben HTML, damit beide Fassungen dasselbe sagen.
   *
   * Kommt keins (etwa von einem anderen Aufrufer im Haus), bleibt alles wie
   * bisher: getippter Text, Signatur darunter.
   */
  const gestaltet = eingabe.html?.trim() ? mailHtmlSaeubern(eingabe.html) : null
  const nurText = gestaltet ? htmlAlsText(gestaltet) : eingabe.text

  // Einmal bauen: Der Briefbogen entscheidet auch, ob das Logo mitreist
  const html = gestaltet
    ? briefbogenAusHtml(gestaltet, firma)
    : briefbogen(eingabe.text, signatur, firma)

  const nachricht = {
    from: `"${email.fromName}" <${fach.address}>`,
    to: eingabe.an,
    ...(eingabe.cc?.trim() ? { cc: eingabe.cc.trim() } : {}),
    /*
     * Die Blindkopie steht im Umschlag, nicht im Brief: Nodemailer schickt an
     * sie und lässt die Zeile im Kopf weg. In der Kopie unter „Gesendet" ist
     * sie dagegen zu sehen — dort will man später wissen, wer sie bekommen
     * hat, und dort liest sie außer dem Haus niemand.
     */
    ...(eingabe.bcc?.trim() ? { bcc: eingabe.bcc.trim() } : {}),
    subject: eingabe.betreff,
    // Nur-Text-Fassung bleibt dabei: Manche lesen so, und Spamfilter mögen es
    text: [nurText, gestaltet ? null : signatur, angaben.join(' · ')]
      .filter(Boolean)
      .join('\n\n--\n'),
    html,
    inReplyTo: eingabe.antwortAufMessageId,
    references: eingabe.antwortAufMessageId,
    attachments: [
      ...logoAnhang(html),
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

  /*
   * Die Kopie darf den Versand nie aufhalten — die Mail ist raus, das ist das
   * Wichtigere. Aber verschweigen darf man den Fehlschlag auch nicht: Wer
   * glaubt, seine Mail liege im Ordner, und sie liegt nicht dort, merkt es
   * erst Wochen später beim Suchen.
   */
  let kopieFehler: string | null = null
  try {
    await mitVerbindung(fach, async (client) => {
      const ziel = await gesendetOrdner(client, fach)
      if (!ziel) {
        throw new Error(
          `Kein Ordner „Gesendet" gefunden (eingestellt: ${fach.sentMailbox || 'nichts'})`,
        )
      }
      await client.append(ziel, roh, ['\\Seen'])
    })
  } catch (err) {
    kopieFehler = err instanceof Error ? err.message : String(err)
    payload.logger.warn({ err }, 'Kopie der gesendeten Mail konnte nicht abgelegt werden')
  }

  /*
   * Protokolliert wird **nach** dem Ablegen, damit der Vermerk mit hineinkommt.
   *
   * Das Ausgangsprotokoll im Büro ist die Stelle, an der man nachsieht, was
   * hinausgegangen ist — dort gehört auch hin, was dabei nicht geklappt hat.
   * Im Serverprotokoll steht es zwar auch, aber dort kommt niemand hin, der
   * gerade eine Mail vermisst.
   */
  await protokoll(
    payload,
    fach,
    eingabe,
    'gesendet',
    kopieFehler ? `Verschickt, aber keine Kopie in „Gesendet": ${kopieFehler}` : undefined,
  )

  return { kopie: !kopieFehler }
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
