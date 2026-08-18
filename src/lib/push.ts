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
 * Schickt eine Meldung an alle angemeldeten Geräte.
 *
 * Fehler eines einzelnen Geräts halten die anderen nicht auf; abgemeldete
 * Geräte (410/404) werden gleich entfernt, damit die Liste nicht verwahrlost.
 */
export async function benachrichtige(payload: Payload, nachricht: PushNachricht): Promise<number> {
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
