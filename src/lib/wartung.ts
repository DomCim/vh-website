import type { Payload } from 'payload'

import { MELDUNG_GELESEN_TAGE, MELDUNG_TAGE } from '../collections/Notifications'
import { GRABSTEIN_TAGE } from './bereiche'
import { liveMelden } from './live'
import { reviewRequestEmail } from './mail'
import { postfaecher, ungeleseneAnzahl } from './postfach'
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

  const { mailprotokollMonate } = await takteinstellungen(payload)
  const stichtag = new Date()
  stichtag.setMonth(stichtag.getMonth() - mailprotokollMonate)
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

  // Grabsteine: Merkzettel über Gelöschtes für Geräte, die offline waren.
  // Nach der Frist holt sich ein Gerät seinen Bestand ohnehin von vorn.
  const grabsteinStichtag = new Date(Date.now() - GRABSTEIN_TAGE * 24 * 3600 * 1000)
  try {
    const weg = await payload.delete({
      collection: 'deletions',
      where: { createdAt: { less_than: grabsteinStichtag.toISOString() } },
      overrideAccess: true,
    })
    ergebnis.grabsteine = weg.docs?.length ?? 0
  } catch {
    ergebnis.grabsteine = 0
  }

  /*
   * Meldungen: Gelesenes verfällt schnell, Ungelesenes lebt länger.
   *
   * Eine abgehakte Meldung hat ihren Zweck erfüllt — sie steht danach nur noch
   * im Weg. Ungelesenes bleibt ein Vierteljahr: Wer so lange nicht hingesehen
   * hat, braucht keine Liste mehr, sondern ein Gespräch.
   */
  const tageZurueck = (tage: number) =>
    new Date(Date.now() - tage * 24 * 3600 * 1000).toISOString()
  for (const [name, tage, nurGelesene] of [
    ['meldungenGelesen', MELDUNG_GELESEN_TAGE, true],
    ['meldungen', MELDUNG_TAGE, false],
  ] as const) {
    try {
      const weg = await payload.delete({
        collection: 'notifications',
        where: {
          and: [
            ...(nurGelesene ? [{ gelesen: { equals: true } }] : []),
            { createdAt: { less_than: tageZurueck(tage) } },
          ],
        },
        overrideAccess: true,
      })
      ergebnis[name] = weg.docs?.length ?? 0
    } catch {
      ergebnis[name] = 0
    }
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
        // Die Gegenrechnung eines Stornos wird nie angemahnt.
        { stornoVon: { exists: false } },
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
 * Was unter den Mindestbestand gerutscht ist.
 *
 * Eine Meldung für alle zusammen, nicht eine je Posten: Nachbestellt wird
 * ohnehin in einem Zug, und drei Meldungen hintereinander wischt man weg,
 * ohne die dritte gelesen zu haben.
 *
 * Was schon bestellt ist, zählt nicht mit. Zwischen „bestellt" und „liegt im
 * Regal" vergehen Tage, und in denen stünde sonst jeden Morgen dieselbe
 * Meldung — bis niemand mehr hinsieht.
 */
export async function bestandMelden(payload: Payload): Promise<number> {
  const { docs } = await payload.find({
    collection: 'inventory-items',
    where: { minQuantity: { greater_than: 0 } },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const knapp = (docs as Record<string, any>[]).filter(
    (p) => (p.quantity ?? 0) < (p.minQuantity ?? 0) && !p.reorderedAt,
  )
  if (!knapp.length) return 0

  // Höchstens einmal am Tag — der Takt klopft viermal in der Stunde
  const zustand = await zustandLesen(payload, 'bestand')
  const heute = tagesStempel(new Date())
  if (zustand?.lastRun && tagesStempel(new Date(zustand.lastRun)) >= heute) return 0

  const namen = knapp
    .slice(0, 3)
    .map((p) => p.name)
    .join(', ')

  await benachrichtige(payload, {
    titel: `${knapp.length} ${knapp.length === 1 ? 'Posten' : 'Posten'} unter Mindestbestand`,
    text: `${namen}${knapp.length > 3 ? ' …' : ''} — Anfrage geht mit einem Klick raus.`,
    url: '/office/nachbestellen',
    tag: 'bestand-knapp',
  })

  await zustandMerken(payload, 'bestand', { ok: true, note: `${knapp.length} knapp` })
  return knapp.length
}

/**
 * Fällige Wiedervorlagen melden.
 *
 * Der Unterschied zu allem anderen hier: Diese Erinnerung hat sich jemand
 * selbst gestellt. Deshalb wird sie einzeln gemeldet und nicht gesammelt —
 * „drei Wiedervorlagen fällig" ist eine Zahl, „Herrn Müller wegen des zweiten
 * Kübels anrufen" ist ein Auftrag, den man im Vorbeigehen erledigt.
 *
 * Höchstens einmal je Zettel und Tag: Der Takt klopft viermal in der Stunde,
 * und eine Erinnerung, die zur Tapete wird, erinnert an nichts mehr.
 */
export async function wiedervorlagenMelden(payload: Payload): Promise<number> {
  const heute = tagesStempel(new Date())
  const bisEndeHeute = new Date()
  bisEndeHeute.setHours(23, 59, 59, 999)

  const { docs } = await payload.find({
    collection: 'follow-ups',
    where: {
      and: [
        { done: { equals: false } },
        { dueDate: { less_than_equal: bisEndeHeute.toISOString() } },
      ],
    },
    sort: 'dueDate',
    limit: 25,
    depth: 0,
    overrideAccess: true,
  })

  let gemeldet = 0
  for (const zettel of docs as Record<string, any>[]) {
    if (zettel.remindedAt && tagesStempel(new Date(zettel.remindedAt)) >= heute) continue

    const tage = tageBis(zettel.dueDate)
    await benachrichtige(payload, {
      titel: 'Wiedervorlage',
      text:
        tage < 0
          ? `${zettel.title} — seit ${Math.abs(tage)} ${Math.abs(tage) === 1 ? 'Tag' : 'Tagen'} liegengeblieben.`
          : zettel.title,
      url: '/office/wiedervorlagen',
      tag: `wiedervorlage-${zettel.id}`,
    })

    await payload
      .update({
        collection: 'follow-ups',
        id: zettel.id,
        overrideAccess: true,
        data: { remindedAt: new Date().toISOString() },
      })
      .catch(() => undefined)
    gemeldet += 1
  }

  return gemeldet
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

export type Takteinstellungen = {
  aktiv: boolean
  intervalMinuten: number
  postfachMinuten: number
  mailprotokollMonate: number
}

/**
 * Wie oft der Server nachsehen soll — gepflegt im Admin unter
 * Integrationen → Takt.
 *
 * Bewusst aus der Datenbank statt aus einer Umgebungsvariablen: Wer den Takt
 * ändern will, soll das im Admin tun können und nicht den Container neu
 * starten müssen.
 */
export async function takteinstellungen(payload: Payload): Promise<Takteinstellungen> {
  try {
    const global = (await payload.findGlobal({ slug: 'integrations', depth: 0 })) as Record<
      string,
      any
    >
    const w = global?.wartung ?? {}
    const zahl = (wert: unknown, standard: number, kleinstes: number, groesstes: number) => {
      const n = Number(wert)
      return Number.isFinite(n) && n >= kleinstes && n <= groesstes ? n : standard
    }
    return {
      aktiv: w.aktiv !== false,
      intervalMinuten: zahl(w.intervalMinuten, 15, 1, 1440),
      postfachMinuten: zahl(w.postfachMinuten, 5, 1, 120),
      mailprotokollMonate: zahl(w.mailprotokollMonate, 12, 1, 120),
    }
  } catch {
    // Datenbank noch nicht bereit (z.B. vor der ersten Migration) → Standard
    return { aktiv: true, intervalMinuten: 15, postfachMinuten: 5, mailprotokollMonate: 12 }
  }
}

/** Ist die Aufgabe seit ihrem letzten Lauf lange genug her? */
export async function istFaellig(
  payload: Payload,
  schluessel: string,
  minuten: number,
): Promise<boolean> {
  const zustand = await zustandLesen(payload, schluessel)
  if (!zustand?.lastRun) return true
  return Date.now() - new Date(zustand.lastRun).getTime() >= minuten * 60_000
}

/**
 * In den Postfächern nachsehen und neue Post melden.
 *
 * IMAP kennt keinen Rückkanal zum Server — es bleibt nur nachschauen.
 * Gemeldet wird ausschließlich, was seit dem letzten Blick dazugekommen ist;
 * sonst käme bei jedem Durchgang dieselbe Meldung.
 */
export async function postfachPruefen(
  payload: Payload,
): Promise<{ fach: string; ungelesen: number; gemeldet: boolean }[]> {
  // Lebenszeichen zuerst: Es hält fest, dass nachgesehen wurde, und daran
  // erkennt der Takt, wann der nächste Blick fällig ist. Auch dann, wenn es
  // gar kein Postfach zu prüfen gibt — sonst liefe der Blick jede Minute.
  await zustandMerken(payload, 'postfach', { ok: true }).catch(() => {})

  const faecher = await postfaecher(payload)
  if (!faecher.length) return []

  const ergebnis: { fach: string; ungelesen: number; gemeldet: boolean }[] = []

  for (const fach of faecher) {
    try {
      const ungelesen = await ungeleseneAnzahl(fach)
      const schluessel = `postfach-${fach.id}`

      const { docs } = await payload.find({
        collection: 'counters',
        where: { key: { equals: schluessel } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const zuletzt = docs[0]?.lastNumber ?? 0

      if (docs[0]) {
        await payload.update({
          collection: 'counters',
          id: docs[0].id,
          overrideAccess: true,
          data: { lastNumber: ungelesen },
        })
      } else {
        await payload.create({
          collection: 'counters',
          overrideAccess: true,
          data: { key: schluessel, lastNumber: ungelesen },
        })
      }

      const neu = ungelesen > zuletzt
      if (neu) {
        // Auch an die offenen Büro-Seiten: Wer gerade im Postfach steht, soll
        // die neue Nachricht sehen, ohne die Benachrichtigung anzutippen.
        liveMelden(payload, 'post', 'neu', fach.id)
        await benachrichtige(payload, {
          titel: `Neue Post für ${fach.label}`,
          text:
            ungelesen === 1 ? 'Eine ungelesene Nachricht.' : `${ungelesen} ungelesene Nachrichten.`,
          url: `/office/post?fach=${fach.id}`,
          tag: `post-${fach.id}`,
        })
      }
      ergebnis.push({ fach: fach.label, ungelesen, gemeldet: neu })
    } catch (err) {
      payload.logger.warn({ err }, `Postfach ${fach.label} nicht erreichbar`)
      ergebnis.push({ fach: fach.label, ungelesen: -1, gemeldet: false })
    }
  }

  return ergebnis
}

export type WartungsBericht = {
  sicherung: string | null
  belege: number
  angebote: number
  rechnungen: number
  bestand: number
  wiedervorlagen: number
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
    bestand: 0,
    wiedervorlagen: 0,
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
    bericht.bestand = await bestandMelden(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Bestandsmeldung fehlgeschlagen')
  }

  try {
    bericht.wiedervorlagen = await wiedervorlagenMelden(payload)
  } catch (err) {
    payload.logger.error({ err }, 'Wartung: Wiedervorlagen fehlgeschlagen')
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
