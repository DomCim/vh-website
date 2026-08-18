import { randomBytes } from 'crypto'

import type { Payload } from 'payload'

import { briefbogen, type CompanyInfo, ueberschrift } from './mail'
import { sendMail } from './sendMail'
import { firmenAngaben } from './settings'

/**
 * Newsletter — Anmeldung, Bestätigung, Abmeldung und Versand.
 *
 * Bei Einzelstücken ist die Liste der Menschen, die sich für die Werkstatt
 * interessieren, das wertvollste Gut: Wer ein Stück gesehen hat und wartet,
 * kauft irgendwann. Bisher gab es keinen Weg, diese Leute wieder zu
 * erreichen — außer zu hoffen, dass sie von selbst wiederkommen.
 *
 * Angemeldet wird immer in zwei Schritten. Der Bestätigungsklick ist kein
 * Beiwerk, sondern die Grundlage: Ohne ihn ließe sich nicht belegen, dass die
 * Adresse dem Absender gehört, und die ganze Liste wäre angreifbar.
 */

export type Sprache = 'de' | 'fr' | 'en'

const TEXTE: Record<
  Sprache,
  {
    betreff: string
    titel: string
    text: string
    knopf: string
    schluss: string
    abmelden: string
    abmeldeHinweis: string
  }
> = {
  de: {
    betreff: 'Bitte bestätigen Sie Ihre Anmeldung',
    titel: 'Fast geschafft',
    text: 'Sie haben sich für Neuigkeiten aus der Werkstatt angemeldet. Ein Klick noch, dann ist es amtlich — ohne Bestätigung schicken wir nichts.',
    knopf: 'Anmeldung bestätigen',
    schluss:
      'Waren Sie das nicht, müssen Sie nichts tun: Ohne Bestätigung wird die Adresse nach kurzer Zeit wieder gelöscht.',
    abmelden: 'Abmelden',
    abmeldeHinweis: 'Sie bekommen diese Mail, weil Sie sich für unseren Newsletter angemeldet haben.',
  },
  fr: {
    betreff: 'Merci de confirmer votre inscription',
    titel: 'Presque terminé',
    text: "Vous vous êtes inscrit aux nouvelles de l'atelier. Un clic et c'est fait — sans confirmation, nous n'envoyons rien.",
    knopf: "Confirmer l'inscription",
    schluss:
      "Si ce n'était pas vous, vous n'avez rien à faire : sans confirmation, l'adresse est supprimée peu après.",
    abmelden: 'Se désinscrire',
    abmeldeHinweis: 'Vous recevez ce message car vous vous êtes inscrit à notre lettre.',
  },
  en: {
    betreff: 'Please confirm your subscription',
    titel: 'Almost there',
    text: 'You signed up for news from the workshop. One more click and it is done — without confirmation we send nothing.',
    knopf: 'Confirm subscription',
    schluss:
      'If this was not you, simply ignore this message: without confirmation the address is deleted shortly.',
    abmelden: 'Unsubscribe',
    abmeldeHinweis: 'You receive this email because you subscribed to our newsletter.',
  },
}

const basis = () => (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

export const abmeldeLink = (token: string, sprache: Sprache) =>
  `${basis()}/${sprache}/newsletter?abmelden=${token}`

/** Fuß mit Abmeldelink — ohne ihn darf kein Newsletter raus. */
export function newsletterFuss(token: string, sprache: Sprache, company?: CompanyInfo): string {
  const t = TEXTE[sprache]
  return `<p style="margin-top:32px;border-top:1px solid #eee;padding-top:12px;color:#999;font-size:11px">
    ${t.abmeldeHinweis}<br />
    <a href="${abmeldeLink(token, sprache)}" style="color:#999">${t.abmelden}</a>
    ${company?.legalName ? ` · ${company.legalName}` : ''}
  </p>`
}

async function firma(payload: Payload): Promise<CompanyInfo> {
  return firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
}

export type AnmeldeErgebnis = 'bestaetigung-verschickt' | 'schon-dabei'

/**
 * Anmeldung entgegennehmen und die Bestätigungsmail schicken.
 *
 * Eine bereits bestätigte Adresse bekommt keine neue Mail — sonst ließe sich
 * über das Formular jemand mit Bestätigungsmails zuschütten.
 */
export async function newsletterAnmelden(
  payload: Payload,
  email: string,
  sprache: Sprache,
  quelle = 'Website',
): Promise<AnmeldeErgebnis> {
  const adresse = email.trim().toLowerCase()
  const token = randomBytes(24).toString('hex')

  const { docs } = await payload.find({
    collection: 'newsletter-subscribers',
    where: { email: { equals: adresse } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const vorhanden = docs[0] as Record<string, any> | undefined

  if (vorhanden?.status === 'bestaetigt') return 'schon-dabei'

  if (vorhanden) {
    await payload.update({
      collection: 'newsletter-subscribers',
      id: vorhanden.id,
      overrideAccess: true,
      data: { token, status: 'offen', locale: sprache, source: quelle },
    })
  } else {
    await payload.create({
      collection: 'newsletter-subscribers',
      overrideAccess: true,
      data: { email: adresse, token, status: 'offen', locale: sprache, source: quelle },
    })
  }

  const t = TEXTE[sprache]
  const angaben = await firma(payload)
  const link = `${basis()}/${sprache}/newsletter?bestaetigen=${token}`

  await sendMail(payload, {
    to: adresse,
    subject: t.betreff,
    art: 'sonstiges',
    html: briefbogen(
      `${ueberschrift(t.titel, true)}
      <p>${t.text}</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 22px;display:inline-block;font-size:13px">${t.knopf}</a>
      </p>
      <p style="color:#666;font-size:12px">${t.schluss}</p>`,
      angaben,
    ),
  })

  return 'bestaetigung-verschickt'
}

/** Bestätigungsklick aus der Mail. */
export async function newsletterBestaetigen(payload: Payload, token: string): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'newsletter-subscribers',
    where: { token: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const eintrag = docs[0] as Record<string, any> | undefined
  if (!eintrag) return false

  await payload.update({
    collection: 'newsletter-subscribers',
    id: eintrag.id,
    overrideAccess: true,
    data: { status: 'bestaetigt', confirmedAt: new Date().toISOString() },
  })
  return true
}

/** Abmeldung — der Eintrag bleibt als Nachweis stehen. */
export async function newsletterAbmelden(payload: Payload, token: string): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'newsletter-subscribers',
    where: { token: { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const eintrag = docs[0] as Record<string, any> | undefined
  if (!eintrag) return false

  await payload.update({
    collection: 'newsletter-subscribers',
    id: eintrag.id,
    overrideAccess: true,
    data: { status: 'abgemeldet', unsubscribedAt: new Date().toISOString() },
  })
  return true
}

export type VersandBericht = { verschickt: number; fehler: number }

/**
 * Einen Newsletter an alle bestätigten Adressen schicken.
 *
 * Der Reihe nach statt in einem Rutsch: Fünfzig Empfänger im BCC sind für
 * jeden Spamfilter ein Massenversand, und der Abmeldelink muss ohnehin für
 * jeden Empfänger ein anderer sein.
 */
export async function newsletterVersenden(
  payload: Payload,
  inhalt: { betreff: string; html: string },
  optionen: { nurAn?: string; sprachen?: Sprache[] } = {},
): Promise<VersandBericht> {
  const angaben = await firma(payload)

  const empfaenger = optionen.nurAn
    ? [{ id: 0, email: optionen.nurAn, token: 'test', locale: 'de' as Sprache }]
    : ((
        await payload.find({
          collection: 'newsletter-subscribers',
          where: {
            and: [
              { status: { equals: 'bestaetigt' } },
              ...(optionen.sprachen?.length ? [{ locale: { in: optionen.sprachen } }] : []),
            ],
          },
          limit: 2000,
          depth: 0,
          overrideAccess: true,
        })
      ).docs as unknown as { id: number; email: string; token: string; locale: Sprache }[])

  let verschickt = 0
  let fehler = 0

  for (const person of empfaenger) {
    try {
      await sendMail(payload, {
        to: person.email,
        subject: inhalt.betreff,
        art: 'sonstiges',
        html:
          briefbogen(inhalt.html, angaben) +
          newsletterFuss(person.token, person.locale ?? 'de', angaben),
      })
      verschickt += 1
      if (person.id) {
        await payload
          .update({
            collection: 'newsletter-subscribers',
            id: person.id,
            overrideAccess: true,
            data: { lastMailAt: new Date().toISOString() },
          })
          .catch(() => undefined)
      }
    } catch {
      // Eine unzustellbare Adresse hält die anderen nicht auf; im
      // Ausgangsprotokoll steht der Fehlschlag ohnehin.
      fehler += 1
    }
  }

  return { verschickt, fehler }
}
