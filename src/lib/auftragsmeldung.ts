import type { Payload, PayloadRequest } from 'payload'

import type { Arbeitsschritt } from './arbeitsplan'
import type { Locale } from './i18n'
import {
  auftragFertigEmail,
  auftragGeliefertEmail,
  auftragInFertigungEmail,
  auftragZwischenstandEmail,
  type AuftragLike,
} from './mail'
import { sendMail } from './sendMail'
import { firmenAngaben } from './settings'

/**
 * Was die Kundschaft vom Fortschritt erfährt.
 *
 * **Was vorher fehlte.** Gemeldet wurde nur, wenn hinter dem Auftrag eine
 * Shop-Bestellung stand — dann zog `Jobs.afterChange` deren Status mit, und
 * erst die Bestellung verschickte. Im Projektgeschäft gibt es keine Bestellung.
 * Dort hörte die Kundschaft wochenlang gar nichts, und ausgerechnet dort dauert
 * ein Stück am längsten.
 *
 * **Was hier entschieden wird**, und warum jede Regel eine Ausnahme abfängt,
 * die sonst wehtut:
 *
 *  - **Shop-Aufträge melden nichts.** Die Bestellung tut es bereits; zwei Mails
 *    zum selben Ereignis sind schlimmer als eine zu wenig.
 *  - **Bei Abholung entfällt „geliefert".** Da wird nichts geliefert. Gesagt
 *    hat es schon „fertig" — mit „steht zur Abholung bereit".
 *  - **Ohne Adresse wird nichts verschickt, aber etwas vermerkt.** Stille wäre
 *    die schlechteste Antwort: Sie sieht im Büro genauso aus wie „ist
 *    informiert".
 *  - **Was einmal gemeldet ist, bleibt gemeldet.** Der Blick auf den vorigen
 *    Stand allein genügt nicht — wer versehentlich auf „geliefert" stellt,
 *    zurücknimmt und später wieder vorstellt, schickte sonst zweimal dieselbe
 *    Nachricht an dieselbe Kundschaft.
 *
 * Gerufen wird das aus `Jobs.afterChange`, also am Datenmodell und nicht in der
 * Büro-Route: So greift es auch, wenn die Änderung aus dem Admin oder über den
 * MCP-Zugang kommt.
 */

/** Die drei Zustände, über die überhaupt gemeldet wird */
const MELDBAR = ['inFertigung', 'fertig', 'geliefert'] as const
export type Meldezustand = (typeof MELDBAR)[number]

export type Meldeauftrag = AuftragLike & {
  id: number | string
  status?: string | null
  source?: string | null
  customerName?: string | null
  contact?: unknown
  kundeEmail?: string | null
  kundeBenachrichtigen?: boolean | null
  gemeldet?: Partial<Record<Meldezustand, string | null>> & { hinweis?: string | null }
}

export type Meldeentscheid =
  | { senden: false; grund: string; vermerk?: string }
  | { senden: true; zustand: Meldezustand; an: string; name: string; sprache: Locale; vermerk?: string }

/** E-Mail und Sprache der Kundschaft — erst vom Geschäftspartner, dann vom Auftrag */
export function kundenzugang(auftrag: Meldeauftrag): {
  email: string | null
  name: string
  sprache: Locale
} {
  const partner = (typeof auftrag.contact === 'object' ? auftrag.contact : null) as {
    email?: string | null
    name?: string | null
    sprache?: string | null
  } | null

  const sprache = (['de', 'fr', 'en'] as const).includes(partner?.sprache as Locale)
    ? (partner!.sprache as Locale)
    : 'de'

  return {
    email: partner?.email?.trim() || auftrag.kundeEmail?.trim() || null,
    name: partner?.name?.trim() || auftrag.customerName?.trim() || '',
    sprache,
  }
}

/**
 * Ob und was gemeldet wird — ohne Nebenwirkungen, damit es prüfbar bleibt.
 *
 * `vorher` ist der Status vor der Änderung; `undefined` heißt „frisch angelegt".
 */
export function meldungPruefen(
  auftrag: Meldeauftrag,
  vorher: string | null | undefined,
): Meldeentscheid {
  const status = auftrag.status ?? ''
  if (!MELDBAR.includes(status as Meldezustand)) return { senden: false, grund: 'kein Meldestand' }
  const zustand = status as Meldezustand

  if (status === vorher) return { senden: false, grund: 'Status unverändert' }

  /*
   * Der Shop meldet selbst. Erkannt an der Herkunft und nicht an einer
   * verknüpften Bestellung: Ein Auftrag kann eine Bestellung tragen, ohne aus
   * ihr entstanden zu sein — dann gehört die Meldung hierher.
   */
  if (auftrag.source === 'shop') return { senden: false, grund: 'Shop-Bestellung meldet selbst' }

  if (auftrag.kundeBenachrichtigen === false) {
    return { senden: false, grund: 'Benachrichtigung ist am Auftrag abgeschaltet' }
  }

  if (auftrag.gemeldet?.[zustand]) {
    return { senden: false, grund: 'dieser Stand wurde schon gemeldet' }
  }

  if (zustand === 'geliefert' && auftrag.lieferart === 'abholung') {
    return { senden: false, grund: 'Abholung — „fertig" hat es schon gesagt' }
  }

  const { email, name, sprache } = kundenzugang(auftrag)
  if (!email) {
    return {
      senden: false,
      grund: 'keine E-Mail-Adresse',
      vermerk: 'Keine E-Mail hinterlegt — bitte anrufen.',
    }
  }

  return {
    senden: true,
    zustand,
    an: email,
    name,
    sprache,
    // Wer selbst liefert, hat keine Sendungsnummer. Das ist kein Fehler, aber
    // es gehört im Büro sichtbar — sonst sucht man später, warum die Kundschaft
    // keine Verfolgung bekam.
    vermerk:
      zustand === 'geliefert' && auftrag.lieferart !== 'abholung' && !auftrag.trackingNumber
        ? 'Ohne Sendungsnummer gemeldet.'
        : undefined,
  }
}

const VORLAGE = {
  inFertigung: auftragInFertigungEmail,
  fertig: auftragFertigEmail,
  geliefert: auftragGeliefertEmail,
} as const

const ART = {
  inFertigung: 'auftrag-fertigung',
  fertig: 'auftrag-fertig',
  geliefert: 'auftrag-geliefert',
} as const

/**
 * Prüfen, verschicken, vermerken.
 *
 * Der Vermerk wird auch dann geschrieben, wenn nichts rausging — er ist die
 * Antwort auf „hat der Kunde davon erfahren?", und ein leeres Feld beantwortet
 * die Frage nicht.
 */
export async function meldungVerschicken(
  payload: Payload,
  auftrag: Meldeauftrag,
  vorher: string | null | undefined,
  req?: PayloadRequest,
): Promise<Meldeentscheid> {
  const entscheid = meldungPruefen(auftrag, vorher)

  if (!entscheid.senden) {
    if (entscheid.vermerk) {
      await vermerken(payload, auftrag, {}, entscheid.vermerk, req)
    }
    return entscheid
  }

  let firma
  try {
    firma = firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
  } catch {
    // Ohne Pflichtangaben geht die Mail trotzdem raus — ein fehlender
    // Briefkopf ist kein Grund, die Kundschaft im Ungewissen zu lassen
  }

  const vorlage = VORLAGE[entscheid.zustand](auftrag, entscheid.name, entscheid.sprache, firma)

  try {
    await sendMail(payload, {
      to: entscheid.an,
      ...vorlage,
      art: ART[entscheid.zustand],
      bezug: { job: auftrag.id },
      // Muss mit: siehe `req` in MailInput — ohne sie sperrt sich das
      // Ausgangsprotokoll an genau dem Auftrag fest, auf den es verweist
      ...(req ? { req } : {}),
    })
  } catch (err) {
    payload.logger.error({ err }, `Auftrag ${auftrag.jobNumber}: Statusmeldung nicht verschickt`)
    await vermerken(payload, auftrag, {}, 'Meldung ist nicht rausgegangen.', req)
    return { senden: false, grund: 'Versand fehlgeschlagen' }
  }

  await vermerken(
    payload,
    auftrag,
    { [entscheid.zustand]: new Date().toISOString() },
    entscheid.vermerk ?? '',
    req,
  )
  return entscheid
}

/**
 * Den Stand am Auftrag festhalten.
 *
 * Läuft bewusst über `overrideAccess` und schluckt Fehler: Ein misslungener
 * Vermerk darf weder den Statuswechsel zurückdrehen noch eine bereits
 * verschickte Mail ungeschehen machen.
 *
 * **Und es dreht sich nicht im Kreis**, obwohl hier derselbe Auftrag
 * geschrieben wird, der den Hook gerade ausgelöst hat: Dieser Schreibvorgang
 * lässt den Status unangetastet, und die Meldung hängt am *Wechsel* des Status.
 * Beim zweiten Durchlauf sind alter und neuer Stand gleich, und die Sache ist
 * vorbei. Wer hier je ein Statusfeld mitschreibt, baut sich eine Endlosschleife.
 */
async function vermerken(
  payload: Payload,
  auftrag: Meldeauftrag,
  zeiten: Partial<Record<Meldezustand, string>>,
  hinweis: string,
  req?: PayloadRequest,
): Promise<void> {
  try {
    await payload.update({
      collection: 'jobs',
      id: auftrag.id,
      overrideAccess: true,
      ...(req ? { req } : {}),
      data: {
        gemeldet: {
          ...(auftrag.gemeldet ?? {}),
          ...zeiten,
          hinweis: hinweis || null,
        },
      } as never,
    })
  } catch (err) {
    payload.logger.warn({ err }, `Auftrag ${auftrag.jobNumber}: Meldevermerk nicht geschrieben`)
  }
}

/**
 * Welche Schritte gerade eine Meldung verdienen — ohne Nebenwirkungen, damit
 * es prüfbar bleibt. Dieselbe Trennung wie bei `meldungPruefen`.
 *
 * Vier Bedingungen, alle nötig:
 *
 *  1. Der Schritt ist **gerade** auf `erledigt` gesprungen — nicht „steht
 *     schon länger so". Sonst meldete jedes Speichern denselben Schritt erneut.
 *  2. Das Häkchen steht.
 *  3. Es gibt einen Kundentext. Ohne ihn kein Versand: Lieber Schweigen als
 *     eine Mail, die nichts sagt.
 *  4. Er wurde noch nicht gemeldet.
 */
export function faelligeSchritte(
  jetzt: Arbeitsschritt[],
  vorher: Arbeitsschritt[] | null | undefined,
): { schritt: Arbeitsschritt; i: number }[] {
  return jetzt
    .map((schritt, i) => ({ schritt, i }))
    .filter(
      ({ schritt, i }) =>
        schritt.stand === 'erledigt' &&
        vorher?.[i]?.stand !== 'erledigt' &&
        Boolean(schritt.kundeMelden) &&
        Boolean(schritt.kundentext?.trim()) &&
        !schritt.gemeldetAm,
    )
}

/**
 * Zwischenstände aus dem Ablauf — was der Kunde zwischen den drei Ständen hört.
 *
 * **Warum es das braucht.** Gemeldet wurde bisher an drei Ständen des
 * Auftrags: in Fertigung, fertig, geliefert. Bei einem Stück, das Wochen
 * unterwegs ist, liegen dazwischen Wochen Stille — das Teil geht zum Laserer,
 * kommt zurück, geht zur Kanterei. Wer nichts hört, ruft an.
 *
 * **Vier Bedingungen, alle nötig:**
 *
 *  1. Der Hauptschalter am Auftrag steht auf melden. Er gilt für alles; ist er
 *     aus, hilft kein Häkchen am Schritt.
 *  2. Der Schritt ist gerade auf `erledigt` gesprungen — nicht „steht schon
 *     länger so". Sonst meldete jedes Speichern denselben Schritt erneut.
 *  3. An ihm hängt das Häkchen **und** ein Kundentext. Ohne Text kein Versand:
 *     Lieber Schweigen als eine Mail, die nichts sagt.
 *  4. Er wurde noch nicht gemeldet.
 *
 * **Was hinausgeht, ist ausschließlich der Kundentext.** Nicht der Schrittname
 * („Bestellen - Kanten"), nicht die Art, nicht die Kosten, nicht der Betrieb,
 * nicht die Vorlaufzeit. Das ist der Grund, aus dem der Text ein eigenes Feld
 * hat und nicht die Bemerkung teilt — die ist intern, und eine Notiz wie
 * „Kanterei zickt wieder" darf niemals hinausgehen.
 *
 * Zurückgeschrieben wird über einen frisch geladenen Auftrag mit Tiefe 0: Der
 * hier hereingereichte trägt aufgelöste Bezüge, und die als Objekt
 * zurückzuschreiben machte aus dem Dienstleister eine leere Verknüpfung.
 */
export async function schrittmeldungenVerschicken(
  payload: Payload,
  auftrag: Meldeauftrag & { arbeitsplan?: Arbeitsschritt[] | null },
  vorher: Arbeitsschritt[] | null | undefined,
  req?: PayloadRequest,
): Promise<number> {
  if (auftrag.kundeBenachrichtigen === false) return 0

  const schritte = auftrag.arbeitsplan ?? []
  if (!schritte.length) return 0

  const { email, name, sprache } = kundenzugang(auftrag)
  if (!email) return 0

  const faellig = faelligeSchritte(schritte, vorher)
  if (!faellig.length) return 0

  let firma: ReturnType<typeof firmenAngaben> | undefined
  try {
    firma = firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
  } catch {
    // Ohne Briefkopf geht die Mail trotzdem raus — siehe oben
  }

  const gemeldet: number[] = []
  for (const { schritt, i } of faellig) {
    try {
      await sendMail(payload, {
        to: email,
        ...auftragZwischenstandEmail(auftrag, name, schritt.kundentext!.trim(), sprache, firma),
        art: 'auftrag-zwischenstand',
        bezug: { job: auftrag.id },
        ...(req ? { req } : {}),
      })
      gemeldet.push(i)
    } catch (err) {
      payload.logger.error(
        { err },
        `Auftrag ${auftrag.jobNumber}: Zwischenstand zu Schritt ${i + 1} nicht verschickt`,
      )
    }
  }

  if (!gemeldet.length) return 0

  try {
    const roh = (await payload.findByID({
      collection: 'jobs',
      id: auftrag.id,
      depth: 0,
      overrideAccess: true,
      req,
    })) as { arbeitsplan?: Arbeitsschritt[] | null }
    const jetzt = new Date().toISOString()
    await payload.update({
      collection: 'jobs',
      id: auftrag.id,
      overrideAccess: true,
      ...(req ? { req } : {}),
      data: {
        arbeitsplan: (roh.arbeitsplan ?? []).map((s, i) =>
          gemeldet.includes(i) ? { ...s, gemeldetAm: jetzt } : s,
        ),
      } as never,
    })
  } catch (err) {
    payload.logger.warn(
      { err },
      `Auftrag ${auftrag.jobNumber}: Vermerk der Schrittmeldung nicht geschrieben`,
    )
  }

  return gemeldet.length
}
