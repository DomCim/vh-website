import { headers as naechsteHeaders } from 'next/headers'
import { redirect } from 'next/navigation'

import { payloadClient } from './data'

export type BueroBenutzer = { id: number | string; email: string; name?: string | null }

/**
 * Wache für den Büro-Bereich.
 *
 * Angemeldet wird über dieselbe Payload-Anmeldung wie im Admin — inklusive
 * Zwei-Faktor. Wer die Inhaberrolle nicht hat, sieht hier nichts: Belege,
 * Umsätze und Inventar gehen nur den Betrieb etwas an.
 */
export async function bueroBenutzer(): Promise<BueroBenutzer> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await naechsteHeaders() })

  if (!user) redirect('/office/login')
  if ((user as { role?: string }).role !== 'inhaber') redirect('/office/kein-zugang')

  return { id: user.id, email: user.email as string, name: (user as { name?: string }).name }
}

/** Nur prüfen, ohne Umleitung — für Seiten, die selbst entscheiden */
export async function istInhaber(): Promise<boolean> {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: await naechsteHeaders() })
  return Boolean(user && (user as { role?: string }).role === 'inhaber')
}

export { datum, euro, jahresZeitraum } from './format'
