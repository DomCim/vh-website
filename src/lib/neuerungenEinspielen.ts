import type { Payload } from 'payload'

import { hoechsteNummer } from './neuerungen'
import { NEUERUNGEN } from '../neuerungen'

/**
 * Die Neuerungen aus `src/neuerungen.ts` in die Datenbank bringen.
 *
 * Läuft einmal je Serverstart (siehe `takt.ts`) und legt an, was noch fehlt.
 * Damit steht ein Eintrag genau dann im Büro, wenn die Fassung läuft, die ihn
 * mitbringt — das ist zugleich die Antwort auf „ausgerollt oder nicht": Es
 * gibt keinen Zustand dazwischen, der gepflegt werden müsste.
 *
 * **Angelegt, nie überschrieben.** Ein Eintrag, dessen Nummer schon dasteht,
 * wird in Ruhe gelassen. Sonst bekäme er bei jedem Neustart ein neues
 * `updatedAt` und liefe damit durch jeden Geräte-Abgleich, ohne dass sich
 * etwas geändert hätte.
 *
 * Das Datum setzt diese Stelle: der Tag des ersten Einspielens. Steht in der
 * Quelle schon eines (die eingesammelte Geschichte bis August 2026), gilt das.
 */
export async function neuerungenEinspielen(payload: Payload): Promise<number> {
  const { docs } = await payload.find({
    collection: 'changelog',
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { nummer: true },
  })
  const bekannt = new Set(docs.map((d) => Number((d as { nummer?: number }).nummer)))

  // Älteste zuerst, damit die Reihenfolge in der Datenbank der Nummer folgt
  const fehlend = NEUERUNGEN.filter((n) => !bekannt.has(n.nummer)).sort(
    (a, b) => a.nummer - b.nummer,
  )
  if (fehlend.length === 0) return 0

  const heute = new Date().toISOString()
  for (const n of fehlend) {
    await payload.create({
      collection: 'changelog',
      overrideAccess: true,
      data: {
        nummer: n.nummer,
        titel: n.titel,
        datum: n.datum ? new Date(`${n.datum}T12:00:00.000Z`).toISOString() : heute,
        punkte: (n.punkte ?? []).map((p) => ({
          text: p.text,
          unter: (p.unter ?? []).map((u) => ({ text: u.text })),
        })),
      },
    })
  }

  /*
   * Ein leerer Bestand ist keine Neuigkeit.
   *
   * Beim allerersten Einspielen — frische Datenbank, oder dieses Bündel kommt
   * zum ersten Mal ins Haus — stünden sonst vierundvierzig Einträge als „neu"
   * da, und der Banner meldete eine Hausgeschichte, die niemand lesen will.
   * Also gilt sie als gesehen. Ab dem zweiten Lauf ist jeder neue Eintrag
   * wirklich neu, und genau dafür ist der Banner da.
   */
  if (bekannt.size === 0) {
    await payload.update({
      collection: 'users',
      where: {},
      overrideAccess: true,
      data: { neuerungGesehen: hoechsteNummer(NEUERUNGEN) },
    })
  }

  payload.logger.info(`Neuerungen: ${fehlend.length} eingespielt.`)
  return fehlend.length
}
