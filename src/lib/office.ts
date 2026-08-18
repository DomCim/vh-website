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

export const euro = (v: number | null | undefined) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export const datum = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

/** Anfang und Ende eines Jahres als ISO-Zeitpunkte */
export function jahresZeitraum(jahr: number) {
  return {
    von: new Date(Date.UTC(jahr, 0, 1)).toISOString(),
    bis: new Date(Date.UTC(jahr + 1, 0, 1)).toISOString(),
  }
}
