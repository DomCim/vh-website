'use client'

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { hoechsteNummer, nachNummer, ungesehen, type Neuerung } from '../neuerungen'
import { useBestand, useRahmen } from './bestand'
import { merkenLesen, merkenSchreiben, speicherVerfuegbar } from './speicher'

/**
 * Die Neuerungen im Gerät — Grundlage für den Banner und die Seite.
 *
 * Sie kommen über den ganz normalen Abgleich (Bereich `neuerungen`) und
 * liegen damit auch ohne Netz da. Bis wohin gelesen wurde, steht am Konto und
 * kommt im Rahmen mit; wer am Rechner gelesen hat, bekommt dasselbe am Tablet
 * nicht noch einmal vorgesetzt.
 */

export type NeuerungImGeraet = Neuerung & { id: number | string }

/**
 * Die Marke, solange der Server sie noch nicht bestätigt hat.
 *
 * Zwischen „weggeklickt" und dem nächsten Abgleich vergehen Sekunden — ohne
 * eigenes Gedächtnis stünde der Banner beim Seitenwechsel wieder da, und ohne
 * Netz für immer. Sie liegt deshalb auch im Gerät und gilt neben dem Rahmen;
 * maßgeblich ist immer die **höhere** von beiden.
 */
const SCHLUESSEL = 'neuerung-gesehen'

let oertlich = 0
const hoerer = new Set<() => void>()
let geladen = false

function melden() {
  for (const h of hoerer) h()
}

function oertlichSetzen(nummer: number) {
  if (nummer <= oertlich) return
  oertlich = nummer
  melden()
  if (speicherVerfuegbar()) void merkenSchreiben(SCHLUESSEL, nummer).catch(() => {})
}

function abonnieren(h: () => void): () => void {
  hoerer.add(h)
  if (!geladen && speicherVerfuegbar()) {
    geladen = true
    void merkenLesen<number>(SCHLUESSEL)
      .then((wert) => {
        if (typeof wert === 'number') oertlichSetzen(wert)
      })
      .catch(() => {})
  }
  return () => {
    hoerer.delete(h)
  }
}

const lesen = () => oertlich
// Auf dem Server gibt es kein Gerät — und damit auch keine gemerkte Marke
const lesenServer = () => 0

/** Alle Einträge, neueste zuerst. */
export function useNeuerungen(): NeuerungImGeraet[] {
  const alle = useBestand<NeuerungImGeraet>('neuerungen')
  return useMemo(() => nachNummer(alle), [alle])
}

/**
 * Bis wohin gelesen wurde — Konto und Gerät zusammengenommen.
 *
 * `null` heißt: noch nicht bekannt. Der Rahmen kommt beim Start aus dem Gerät
 * und wird beim ersten Abgleich aufgefrischt; wer in dem Augenblick dazwischen
 * misst, bekäme sonst eine 0 zu sehen und hielte alles für neu. Ein Wert im
 * Gerät (jemand hat eben weggeklickt) zählt auch ohne Rahmen.
 */
export function useGesehen(): number | null {
  const rahmen = useRahmen()
  const imGeraet = useSyncExternalStore(abonnieren, lesen, lesenServer)
  const amKonto = rahmen.neuerungGesehen
  if (typeof amKonto !== 'number') return imGeraet > 0 ? imGeraet : null
  return Math.max(amKonto, imGeraet)
}

/**
 * Was noch niemand gesehen hat — daran hängt der Banner.
 *
 * Solange die Marke unbekannt ist, ist nichts zu melden: Lieber einen
 * Augenblick später Bescheid sagen als einmal zu Unrecht.
 */
export function useUngesehene(): NeuerungImGeraet[] {
  const alle = useNeuerungen()
  const gesehen = useGesehen()
  return useMemo(() => (gesehen === null ? [] : ungesehen(alle, gesehen)), [alle, gesehen])
}

/**
 * Alles bis zur höchsten dastehenden Nummer als gelesen merken.
 *
 * Bewusst nicht über die Warteschlange: Die trägt Änderungen an Datensätzen
 * nach, und das hier ist keine — es ist eine Marke am eigenen Konto. Klappt
 * der Aufruf nicht, bleibt die Marke im Gerät stehen; beim nächsten Mal mit
 * Netz geht sie mit hinaus.
 */
export function useAlsGesehen(): () => void {
  const alle = useNeuerungen()
  return useCallback(() => {
    const bis = hoechsteNummer(alle)
    if (!bis) return
    oertlichSetzen(bis)
    void fetch('/api/office/neuerung', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gesehen: bis }),
    }).catch(() => {
      // Ohne Netz genügt die Marke im Gerät — sie geht später mit hinaus
    })
  }, [alle])
}

/**
 * Beim Öffnen der Seite abhaken — und sagen, was dabei neu war.
 *
 * Zurück kommt der Stand, der beim Öffnen galt: Alles darüber war für den
 * Lesenden neu und darf auf der Seite noch als solches dastehen, obwohl es im
 * selben Augenblick abgehakt wird. Ein Hinweis, der verschwindet, ohne dass
 * man sieht, wofür — das wäre die schlechtere Hälfte davon.
 *
 * Gewartet wird, bis die Marke **bekannt** ist. Sie kommt aus dem Rahmen, und
 * der wird beim Start als Letztes aus dem Gerät geladen; wer vorher misst,
 * sieht die Einträge schon und die Marke noch nicht — beim ersten Versuch
 * stand die Seite deshalb mit fünfundvierzig Mal „Neu" da.
 */
export function useBeimOeffnenAbhaken(): number {
  const gesehen = useGesehen()
  const offene = useUngesehene()
  const abhaken = useAlsGesehen()
  const [standBeimOeffnen, setStandBeimOeffnen] = useState<number | null>(null)

  useEffect(() => {
    if (gesehen === null) return
    setStandBeimOeffnen((bisher) => (bisher === null ? gesehen : bisher))
    // Läuft genau einmal: Danach ist nichts mehr offen, und der Effekt endet
    if (offene.length) abhaken()
  }, [gesehen, offene, abhaken])

  // Solange nichts feststeht, ist auch nichts hervorzuheben
  return standBeimOeffnen ?? Number.MAX_SAFE_INTEGER
}
