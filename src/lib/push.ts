import type { Payload } from 'payload'
import webpush from 'web-push'

/**
 * Push-Benachrichtigungen für die Büro-App.
 *
 * Der Sinn: Vincent steht in der Werkstatt und soll von einer Bestellung
 * erfahren, ohne alle zehn Minuten nachzuschauen. Verschickt wird über den
 * Push-Dienst des jeweiligen Browsers — dafür braucht es ein Schlüsselpaar
 * (VAPID), das beim ersten Mal selbst erzeugt und in den Einstellungen
 * abgelegt wird. Es von Hand einzutragen wäre eine Fehlerquelle ohne Nutzen.
 */

/** Wie eine Meldung behandelt wird, über das Verschicken hinaus. */
export type PushOptionen = {
  /**
   * Auch in die Meldungsliste legen. Aus nur für die Probemeldung: Ein „kommt
   * an" gehört nicht auf eine Arbeitsliste.
   */
  merken?: boolean
}

export type PushNachricht = {
  titel: string
  text: string
  /** Wohin der Klick führt, z.B. /office/bestellungen */
  url?: string
  /** Gleiche Kennung ersetzt eine ältere Meldung, statt sie zu stapeln */
  tag?: string
}

type Schluessel = { publicKey: string; privateKey: string; subject: string }

/** Holt das Schlüsselpaar; erzeugt es beim ersten Aufruf. */
export async function pushSchluessel(payload: Payload): Promise<Schluessel | null> {
  try {
    const global = (await payload.findGlobal({ slug: 'integrations', depth: 0 })) as Record<
      string,
      any
    >
    const vorhanden = global?.push
    if (vorhanden?.publicKey && vorhanden?.privateKey) {
      return {
        publicKey: vorhanden.publicKey,
        privateKey: vorhanden.privateKey,
        subject: vorhanden.subject || 'mailto:info@vincent-hellmann.com',
      }
    }

    const neu = webpush.generateVAPIDKeys()
    const subject = vorhanden?.subject || 'mailto:info@vincent-hellmann.com'
    await payload.updateGlobal({
      slug: 'integrations',
      overrideAccess: true,
      data: { push: { publicKey: neu.publicKey, privateKey: neu.privateKey, subject } },
    })
    payload.logger.info('Push-Schlüsselpaar erzeugt')
    return { ...neu, subject }
  } catch (err) {
    payload.logger.error({ err }, 'Push-Schlüssel konnten nicht gelesen werden')
    return null
  }
}

/**
 * Legt die Meldung in die Liste, die im Büro unter der Glocke steht.
 *
 * Bewusst ohne `req`: Dieselbe Stelle wird aus Hooks gerufen, die in einer
 * Transaktion sitzen. Die Meldung darf weder mit ihr warten noch mit ihr
 * zurückgerollt werden — sie ist eine Nachricht über einen Vorgang, nicht Teil
 * davon.
 *
 * Fehler werden geschluckt, dieselbe Regel wie bei `liveMelden`: Dass eine
 * Meldung nicht abgelegt werden kann, darf nie dazu führen, dass ein Beleg
 * nicht gespeichert wird.
 */
async function merken(payload: Payload, nachricht: PushNachricht): Promise<void> {
  try {
    const jetzt = new Date().toISOString()
    const daten = {
      titel: nachricht.titel,
      text: nachricht.text ?? '',
      url: nachricht.url ?? '/office',
      tag: nachricht.tag ?? null,
      zuletztAm: jetzt,
    }

    /*
     * Gleiche Kennung ersetzt — dieselbe Bedeutung, die `tag` beim Push schon
     * hat. Sonst stünde nach einer Woche zwölfmal dieselbe überfällige
     * Rechnung in der Liste.
     *
     * Ersetzt wird aber nur Ungelesenes. Wäre auch Gelesenes dabei,
     * verschluckte eine neue Mahnung sich selbst: Sie ginge in die längst
     * abgehakte Zeile von vorletzter Woche und fiele niemandem mehr auf.
     */
    if (nachricht.tag) {
      const { docs } = await payload.find({
        collection: 'notifications',
        where: { and: [{ tag: { equals: nachricht.tag } }, { gelesen: { equals: false } }] },
        sort: '-zuletztAm',
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const alt = docs[0] as { id: number | string; anzahl?: number | null } | undefined
      if (alt) {
        await payload.update({
          collection: 'notifications',
          id: alt.id,
          overrideAccess: true,
          data: { ...daten, anzahl: (Number(alt.anzahl) || 1) + 1 },
        })
        return
      }
    }

    await payload.create({
      collection: 'notifications',
      overrideAccess: true,
      data: { ...daten, anzahl: 1, gelesen: false },
    })
  } catch (err) {
    payload.logger.warn({ err }, 'Meldung nicht abgelegt')
  }
}

/**
 * Schickt eine Meldung an alle angemeldeten Geräte.
 *
 * Fehler eines einzelnen Geräts halten die anderen nicht auf; abgemeldete
 * Geräte (410/404) werden gleich entfernt, damit die Liste nicht verwahrlost.
 */
/**
 * Eine Meldung abhaken, weil sich ihr Anlass von selbst erledigt hat.
 *
 * Der Fall, für den es das gibt: Die Post ist gelesen — aber am Telefon, im
 * Mailprogramm, nicht im Büro. Der Server weiß es (die Markierung liegt bei
 * IMAP), die Meldung im Gerät nicht. Ohne dieses Abhaken stünde im Büro
 * weiter „da ist neue Post", obwohl längst niemand mehr hinsehen muss.
 *
 * Gilt für alle Meldungen mit dieser Kennung — mehr als eine ungelesene gibt
 * es je Kennung ohnehin nicht (siehe `merken`).
 */
export async function abhaken(payload: Payload, tag: string): Promise<number> {
  try {
    const { docs } = await payload.find({
      collection: 'notifications',
      where: { and: [{ tag: { equals: tag } }, { gelesen: { equals: false } }] },
      limit: 20,
      depth: 0,
      overrideAccess: true,
    })
    for (const m of docs) {
      await payload.update({
        collection: 'notifications',
        id: m.id,
        overrideAccess: true,
        data: { gelesen: true, gelesenAm: new Date().toISOString() },
      })
    }
    return docs.length
  } catch (err) {
    payload.logger.warn({ err }, 'Meldung konnte nicht abgehakt werden')
    return 0
  }
}

export async function benachrichtige(
  payload: Payload,
  nachricht: PushNachricht,
  optionen: PushOptionen = {},
): Promise<number> {
  /*
   * Erst ablegen, dann verschicken — und zwar in dieser Reihenfolge.
   *
   * Eine Meldung, die kein Gerät erreicht hat, ist genau die, die man später
   * sucht: Das Handy war aus, kein Netz, oder sie wurde im Vorbeigehen
   * weggewischt. Läge sie erst nach dem Verschicken in der Liste, fehlte
   * ausgerechnet der Fall, für den die Liste da ist.
   */
  if (optionen.merken !== false) await merken(payload, nachricht)

  const schluessel = await pushSchluessel(payload)
  if (!schluessel) return 0

  const { docs } = await payload.find({
    collection: 'push-subscriptions',
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
  if (!docs.length) return 0

  webpush.setVapidDetails(schluessel.subject, schluessel.publicKey, schluessel.privateKey)
  const inhalt = JSON.stringify(nachricht)

  let zugestellt = 0
  for (const geraet of docs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: geraet.endpoint,
          keys: { p256dh: geraet.p256dh, auth: geraet.auth },
        },
        inhalt,
      )
      zugestellt++
    } catch (err) {
      const code = (err as { statusCode?: number })?.statusCode
      if (code === 404 || code === 410) {
        await payload
          .delete({ collection: 'push-subscriptions', id: geraet.id, overrideAccess: true })
          .catch(() => undefined)
        payload.logger.info(`Push-Gerät "${geraet.label ?? geraet.id}" war abgemeldet — entfernt`)
      } else {
        payload.logger.warn({ err }, 'Push-Benachrichtigung fehlgeschlagen')
      }
    }
  }
  return zugestellt
}
