import { headers as naechsteHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { payloadClient } from './data'
import type { Recht } from './rechte'
import { darf } from './wache'

export type BueroBenutzer = { id: number | string; email: string; name?: string | null }

/**
 * Wache für den Büro-Bereich.
 *
 * Angemeldet wird über dieselbe Payload-Anmeldung wie im Admin — inklusive
 * Zwei-Faktor. Wer das Büro nicht öffnen darf, sieht hier nichts: Belege,
 * Umsätze und Inventar gehen nur den Betrieb etwas an.
 *
 * Eine Seite kann ein genaueres Recht verlangen als „überhaupt hinein". Die
 * Steuer-Seite etwa will `zahlen.sehen` — wer in der Werkstatt Aufträge
 * abarbeitet, hat im Büro zu tun, aber nichts mit Umsätzen.
 */
export async function bueroBenutzer(recht: Recht = 'buero.oeffnen'): Promise<BueroBenutzer> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await naechsteHeaders() })

  if (!user) redirect('/office/login')
  if (!(await darf(payload, user, recht))) redirect('/office/kein-zugang')

  return { id: user.id, email: user.email as string, name: (user as { name?: string }).name }
}

/** Nur prüfen, ohne Umleitung — für Seiten, die selbst entscheiden */
export async function istInhaber(): Promise<boolean> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await naechsteHeaders() })
  return darf(payload, user, 'buero.oeffnen')
}

export { datum, euro, jahresZeitraum, monatsZeitraum } from './format'
