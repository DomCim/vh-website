'use client'

import { useMemo } from 'react'

import { useBestand } from './bestand'
import { absenden } from './warteschlange'

/**
 * Die Meldungen im Gerät — Grundlage der Glocke in der Kopfleiste.
 *
 * Sie kommen über den ganz normalen Abgleich (Bereich `meldungen`), liegen
 * also auch ohne Netz da. Abgehakt wird über dieselbe Warteschlange wie alles
 * andere: In der Werkstatt ohne Empfang eine Meldung wegzuklicken, die dann
 * wieder auftaucht, wäre genau die Art Kleinigkeit, die Vertrauen kostet.
 */

export type Meldung = {
  id: number | string
  titel?: string | null
  text?: string | null
  url?: string | null
  tag?: string | null
  anzahl?: number | null
  gelesen?: boolean | null
  gelesenAm?: string | null
  zuletztAm?: string | null
  createdAt?: string | null
}

/** Wann eine Meldung zuletzt etwas wollte — danach steht die Liste. */
export const meldungsZeit = (m: Meldung): string => m.zuletztAm ?? m.createdAt ?? ''

/** Neueste zuerst; `grenze` kürzt für das kleine Blatt unter der Glocke. */
export function useMeldungen(grenze?: number): Meldung[] {
  const alle = useBestand<Meldung>('meldungen')
  return useMemo(() => {
    const sortiert = [...alle].sort((a, b) => meldungsZeit(b).localeCompare(meldungsZeit(a)))
    return grenze ? sortiert.slice(0, grenze) : sortiert
  }, [alle, grenze])
}

/** Wie viele noch niemand angesehen hat. */
export function useUngelesen(): number {
  const alle = useBestand<Meldung>('meldungen')
  return useMemo(() => alle.filter((m) => !m.gelesen).length, [alle])
}

/**
 * Gelesen setzen — oder wieder auf ungelesen.
 *
 * Über `absenden`, weil das den Bestand im Gerät sofort mitzieht und den
 * Aufruf notfalls in die Schlange legt.
 */
export async function alsGelesen(id: number | string, gelesen = true): Promise<void> {
  await absenden({
    pfad: '/api/office/meldung',
    bereich: 'meldungen',
    koerper: { aktion: gelesen ? 'gelesen' : 'ungelesen', id },
    vorschau: { id, gelesen, gelesenAm: gelesen ? new Date().toISOString() : null },
  })
}

/**
 * Alles abhaken.
 *
 * Bewusst als Schleife über die einzelnen Meldungen und nicht als ein
 * Sammelaufruf: `absenden` erkennt einen neuen Datensatz daran, dass keine
 * Kennung dabei ist, und legte für einen Sammelaufruf ein Phantom in den
 * Bestand. Ein paar Dutzend Aufrufe nacheinander sind der ehrlichere Weg —
 * und sie funktionieren ohne Netz genauso.
 */
export async function allesGelesen(meldungen: Meldung[]): Promise<void> {
  for (const m of meldungen) {
    if (m.gelesen) continue
    await alsGelesen(m.id).catch(() => undefined)
  }
}
