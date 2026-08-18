import type { Payload } from 'payload'

import { reviewRequestEmail } from './mail'
import { benachrichtige } from './push'
import { sendMail } from './sendMail'
import { firmenAngaben } from './settings'
import { sicherungAutomatik, zustandLesen, zustandMerken } from './sicherung'

/**
 * Der Tageslauf des Hauses: sichern, erinnern, aufräumen.
 *
 * Gedacht für einen Cron, der viertelstündlich `/api/wartung` aufruft. Jede
 * Aufgabe entscheidet selbst, ob sie an der Reihe ist — so lässt sich die
 * Uhrzeit im Admin ändern, ohne den Cron anzufassen.
 */

const TAG = 24 * 3600 * 1000

const tagesStempel = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** Ganze Tage von heute bis zum Stichtag — negativ heißt überfällig. */
function tageBis(datum: string): number {
  const ziel = new Date(datum)
  const heute = new Date()
  ziel.setHours(0, 0, 0, 0)
  heute.setHours(0, 0, 0, 0)
  return Math.round((ziel.getTime() - heute.getTime()) / TAG)
}

/**
 * Erinnert an Belege, die bezahlt werden müssen.
 *
 * Vorher stand das Zahlungsziel höchstens auf dem Papier im Ordner. Jetzt
 * liest die KI es beim Erfassen mit, und ab drei Tagen vorher meldet sich das
 * Büro jeden Tag — bis der Beleg auf „bezahlt" steht. Vorher bleibt es still:
 * Eine Erinnerung, die drei Wochen zu früh kommt, wird weggewischt und danach
 * nicht mehr gelesen.
 */
export async function belegErinnerungen(payload: Payload): Promise<number> {
  const grenze = new Date(Date.now() + 3 * TAG)
  const heute = tagesStempel(new Date())

  const { docs } = await payload.find({
    collection: 'expenses',
    where: {
      and: [
        { paid: { equals: false } },
        { dueDate: { exists: true } },
        { dueDate: { less_than_equal: grenze.toISOString() } },
      ],
    },
    sort: 'dueDate',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  let gemeldet = 0
  for (const beleg of docs as Record<string, any>[]) {
    // Höchstens eine Meldung je Beleg und Tag — der Cron klopft öfter.
    if (beleg.reminderSentAt && tagesStempel(new Date(beleg.reminderSentAt)) >= heute) continue

    const tage = tageBis(beleg.dueDate)
    const wann =
      tage < 0
        ? `seit ${Math.abs(tage)} ${Math.abs(tage) === 1 ? 'Tag' : 'Tagen'} überfällig`
        : tage === 0
          ? 'heute fällig'
          : `fällig in ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}`
    const wer = beleg.supplierName || beleg.title || 'Beleg'
    const betrag = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
      beleg.grossAmount ?? 0,
    )

    await benachrichtige(payload, {
      titel: tage < 0 ? `Überfällig: ${wer}` : `Zahlung fällig: ${wer}`,
      text: `${betrag} — ${wann}.`,
      url: `/office/belege/${beleg.id}`,
      // Gleiche Kennung: Die Meldung von gestern wird ersetzt statt gestapelt.
      tag: `beleg-${beleg.id}`,
    })

    await payload.update({
      collection: 'expenses',
      id: beleg.id,
      overrideAccess: true,
      data: { reminderSentAt: new Date().toISOString() },
    })
    gemeldet += 1
  }

  return gemeldet
}

/**
 * Aufräumen. Kurzlebige Daten sollen nicht ewig liegen bleiben — die
 * Anmeldecodes des Kundenportals sind nach zehn Minuten wertlos, das
 * Mailprotokoll nach einem Jahr.
 */
export async function datenAufraeumen(payload: Payload): Promise<Record<string, number>> {
  const ergebnis: Record<string, number> = {}

  try {
    const weg = await payload.delete({
      collection: 'login-codes',
      where: { expiresAt: { less_than: new Date().toISOString() } },
      overrideAccess: true,
    })
    ergebnis.anmeldecodes = weg.docs?.length ?? 0
  } catch {
    ergebnis.anmeldecodes = 0
  }

  const monate = Number(process.env.MAILLOG_MONATE || 12)
  const stichtag = new Date()
  stichtag.setMonth(stichtag.getMonth() - (Number.isFinite(monate) ? monate : 12))
  try {
    const weg = await payload.delete({
      collection: 'mail-log',
      where: { createdAt: { less_than: stichtag.toISOString() } },
      overrideAccess: true,
    })
    ergebnis.mailprotokoll = weg.docs?.length ?? 0
  } catch {
    ergebnis.mailprotokoll = 0
  }

  return ergebnis
}

/**
 * Meldet, wenn etwas stillsteht.
 *
 * Ein Cron, der nicht mehr läuft, fällt sonst erst auf, wenn man ihn braucht —
 * also im schlechtesten Moment.
 */
export async function stillstandPruefen(payload: Payload): Promise<string[]> {
  const wachen: { key: string; label: string; stunden: number; url: string }[] = [
    { key: 'sicherung', label: 'Sicherung', stunden: 36, url: '/office/sicherung' },
    { key: 'postfach', label: 'Postfach-Abruf', stunden: 6, url: '/office/post' },
  ]

  const auffaellig: string[] = []
  for (const wache of wachen) {
    const zustand = await zustandLesen(payload, wache.key)
    // Was noch nie lief, ist nicht kaputt — vielleicht ist es nur nicht eingerichtet.
    if (!zustand?.lastRun) continue
    const alter = Date.now() - new Date(zustand.lastRun).getTime()
    if (alter <= wache.stunden * 3600 * 1000 && zustand.ok !== false) continue

    auffaellig.push(wache.label)
    await benachrichtige(payload, {
      titel: `${wache.label} meldet sich nicht`,
      text:
        zustand.ok === false
          ? `Letzter Lauf mit Fehler: ${zustand.note ?? 'ohne nähere Angabe'}`
          : `Seit ${Math.floor(alter / 3600000)} Stunden nichts mehr passiert.`,
      url: wache.url,
      tag: `stillstand-${wache.key}`,
    })
  }
  return auffaellig
}

/**
 * Angebote, auf die niemand geantwortet hat.
 *
 * Ein Angebot ohne Nachfassen ist ein Zettel im Wind: Die Hälfte der Aufträge
 * entscheidet sich daran, ob nach einer Woche jemand anruft. Gemeldet wird ab
 * sieben Tagen nach dem Versand und danach höchstens einmal pro Woche — sonst
 * wird die Meldung zur Tapete.
 */
export async function angeboteNachfassen(payload: Payload): Promise<number> {
  const grenze = new Date(Date.now() - 7 * TAG).toISOString()

  const { docs } = await payload.find({
    collection: 'quotes',
    where: {
      and: [
        { status: { equals: 'versendet' } },
        { sentAt: { exists: true } },
        { sentAt: { less_than_equal: grenze } },
      ],
    },
    sort: 'sentAt',
    limit: 25,
    depth: 0,
    overrideAccess: true,
  })

  let gemeldet = 0
  for (const angebot of docs as Record<string, any>[]) {
    if (angebot.lastFollowUpAt && angebot.lastFollowUpAt > grenze) continue

    const tage = Math.floor((Date.now() - new Date(angebot.sentAt).getTime()) / TAG)
    const laeuftAb =
      angebot.validUntil && new Date(angebot.validUntil).getTime() < Date.now() + 7 * TAG

    await benachrichtige(payload, {
      titel: `Angebot ohne Antwort: ${angebot.customerName || angebot.quoteNumber}`,
      text: laeuftAb
        ? `Seit ${tage} Tagen keine Rückmeldung — und die Gültigkeit läuft demnächst ab.`
        : `Seit ${tage} Tagen keine Rückmeldung. Ein Anruf lohnt sich.`,
      url: `/office/angebote/${angebot.id}`,
      tag: `angebot-${angebot.id}`,
    })

    await payload.update({
      collection: 'quotes',
      id: angebot.id,
      overrideAccess: true,
      data: { lastFollowUpAt: new Date().toISOString() },
    })
    gemeldet += 1
  }

  return gemeldet
}

/**
 * Eigene Rechnungen, die überfällig sind.
 *
 * Eine Meldung für alle zusammen, nicht eine je Rechnung: Wer mahnt, macht
 * das ohnehin in einem Rutsch am Schreibtisch.
 */
export async function offeneRechnungenMelden(payload: Payload): Promise<number> {
  const { docs } = await payload.find({
    collection: 'outgoing-invoices',
    where: {
      and: [
        { status: { equals: 'gestellt' } },
        { dueDate: { exists: true } },
        { dueDate: { less_than: new Date().toISOString() } },
      ],
    },
    sort: 'dueDate',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })
  if (!docs.length) return 0

  const zustand = await zustandLesen(payload, 'mahnwesen')
  const heute = tagesStempel(new Date())
  if (zustand?.lastRun && tagesStempel(new Date(zustand.lastRun)) >= heute) return 0

  const summe = docs.reduce((s, r) => s + ((r as { total?: number }).total ?? 0), 0)
  const aelteste = docs[0] as Record<string, any>
  const tage = Math.floor((Date.now() - new Date(aelteste.dueDate).getTime()) / TAG)

  await benachrichtige(payload, {
    titel: `${docs.length} Rechnung${docs.length === 1 ? '' : 'en'} überfällig`,
    text: `${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(summe)} offen · älteste seit ${tage} Tagen (${aelteste.customerName || aelteste.invoiceNumber}).`,
    url: '/office/rechnungen?filter=ueberfaellig',
    tag: 'rechnungen-ueberfaellig',
  })

  await zustandMerken(payload, 'mahnwesen', { ok: true, note: `${docs.length} überfällig` })
  return docs.length
}

/**
 * Nach der Lieferung um eine Kundenstimme bitten.
 *
 * Die Kundenstimmen auf der Website waren bisher ein Sammelproblem: Es gab
 * eine Verwaltung dafür, aber keinen Weg, sie zu füllen — außer zu hoffen,
 * dass jemand von selbst schreibt. Gefragt wird zwei Wochen nach dem Versand,
 * genau einmal.
 */
export async function kundenstimmenBitten(payload: Payload): Promise<number> {
  const grenze = new Date(Date.now() - 14 * TAG).toISOString()

  const { docs } = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { status: { equals: 'shipped' } },
        { shippedAt: { exists: true } },
        { shippedAt: { less_than_equal: grenze } },
        { reviewRequestedAt: { exists: false } },
      ],
    },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  if (!docs.length) return 0

  const angaben = firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
  const basis = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000').replace(/\/$/, '')

  let gefragt = 0
  for (const bestellung of docs as Record<string, any>[]) {
    if (!bestellung.customer?.email || !bestellung.accessToken) continue

    try {
      await sendMail(payload, {
        ...reviewRequestEmail(
          bestellung as never,
          `${basis}/de/kundenstimme?bestellung=${bestellung.accessToken}`,
          angaben,
        ),
        art: 'sonstiges',
        bezug: { order: bestellung.id },
      })
      gefragt += 1
    } catch (err) {
      payload.logger.warn({ err }, `Bitte um Kundenstimme für ${bestellung.orderNumber} scheiterte`)
    }

    // Auch nach einem Fehlschlag merken: Lieber keine Stimme als eine
    // Bestellung, die jeden Tag aufs Neue angeschrieben wird.
    await payload
      .update({
        collection: 'orders',
        id: bestellung.id,
        overrideAccess: true,
        context: { skipShippedMail: true },
        data: { reviewRequestedAt: new Date().toISOString() },
      })
      .catch(() => undefined)
  }

  return gefragt
}

export type WartungsBericht = {
  sicherung: string | null
  belege: number
  angebote: number
  rechnungen: number
  kundenstimmen: number
  aufgeraeumt: Record<string, number>
  stillstand: string[]
}

/** Ein kompletter Wartungslauf. Fehler einer Aufgabe halten die anderen nicht auf. */
export async function wartungslauf(payload: Payload): Promise<WartungsBericht> {
  const bericht: WartungsBericht = {
    sicherung: null,
    belege: 0,
    angebote: 0,
    rechnungen: 0,
    kundenstimmen: 0,
    aufgeraeumt: {},
    stillstand: [],
  }

  try {
    bericht.sicherung = await sicherungAutomatik(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Sicherung fehlgeschlagen')
  }

  try {
    bericht.belege = await belegErinnerungen(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Beleg-Erinnerungen fehlgeschlagen')
  }

  try {
    bericht.angebote = await angeboteNachfassen(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Angebote nachfassen fehlgeschlagen')
  }

  try {
    bericht.rechnungen = await offeneRechnungenMelden(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: offene Rechnungen fehlgeschlagen')
  }

  try {
    bericht.kundenstimmen = await kundenstimmenBitten(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Bitte um Kundenstimmen fehlgeschlagen')
  }

  try {
    bericht.aufgeraeumt = await datenAufraeumen(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Aufräumen fehlgeschlagen')
  }

  try {
    bericht.stillstand = await stillstandPruefen(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Stillstandsprüfung fehlgeschlagen')
  }

  await zustandMerken(payload, 'wartung', { ok: true }).catch(() => {})
  return bericht
}
