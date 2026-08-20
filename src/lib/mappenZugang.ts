import type { Payload } from 'payload'

import { fuerKunden, zugangGueltig, type Zugang } from './uebergabe'

/**
 * Der Weg von einer Kennung aus der Adresszeile zur Mappe dahinter.
 *
 * Steht bewusst neben den Routen und nicht in ihnen: Öffnen, Hochladen und
 * Herunterladen prüfen alle dasselbe, und drei Kopien derselben Prüfung sind
 * drei Gelegenheiten, eine davon zu vergessen.
 */

export type Mappe = {
  id: number | string
  title?: string | null
  email?: string | null
  folders?: { name?: string | null }[] | null
  zugaenge?: Zugang[] | null
  geschlossen?: boolean | null
}

export type Mappendatei = {
  id: number | string
  folder?: string | null
  label?: string | null
  filename?: string | null
  filesize?: number | null
  herkunft?: string | null
  freigabe?: boolean | null
  note?: string | null
  createdAt?: string | null
}

export type Zugriff = {
  mappe: Mappe
  zugang: Zugang
}

/**
 * Mappe und Zugang zu einer Kennung — oder `null`.
 *
 * `null` steht für alles zusammen: Kennung erfunden, Zugang abgelaufen,
 * Zugang zurückgezogen. Nach außen darf das nicht unterscheidbar sein, sonst
 * verrät die Antwort, welche Kennungen es gibt.
 */
export async function zugriffZuToken(payload: Payload, token: string): Promise<Zugriff | null> {
  if (!token || token.length < 10) return null

  const { docs } = await payload.find({
    collection: 'customer-uploads',
    where: { 'zugaenge.token': { equals: token } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const mappe = docs[0] as Mappe | undefined
  if (!mappe) return null

  const zugang = (mappe.zugaenge ?? []).find((z) => z.token === token)
  if (!zugangGueltig(zugang)) return null

  return { mappe, zugang: zugang as Zugang }
}

/** Die Dateien einer Mappe, die der Auftraggeber sehen darf. */
export async function dateienFuerKunden(
  payload: Payload,
  mappeId: number | string,
): Promise<Mappendatei[]> {
  const { docs } = await payload.find({
    collection: 'product-files',
    where: { mappe: { equals: mappeId } },
    limit: 1000,
    sort: 'createdAt',
    depth: 0,
    overrideAccess: true,
  })
  return (docs as unknown as Mappendatei[]).filter((d) => fuerKunden(d))
}

/**
 * Vermerkt, dass jemand die Mappe geöffnet hat.
 *
 * Nicht als Statistik, sondern als Antwort auf die Frage „hat er die
 * Zeichnung überhaupt bekommen?" — die kommt bei Lohnfertigung regelmäßig,
 * und ohne diesen Vermerk lässt sie sich nur raten.
 */
export async function benutzungVermerken(
  payload: Payload,
  mappe: Mappe,
  token: string,
): Promise<void> {
  const zugaenge = (mappe.zugaenge ?? []).map((z) =>
    z.token === token ? { ...z, zuletztGenutzt: new Date().toISOString() } : z,
  )
  await payload
    .update({
      collection: 'customer-uploads',
      id: mappe.id,
      overrideAccess: true,
      data: { zugaenge } as never,
    })
    .catch(() => undefined)
}
