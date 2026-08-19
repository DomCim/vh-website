'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { istErreichbar, netzWegMelden } from './bestand'
import { merkenLesen, merkenSchreiben } from './speicher'

/**
 * Angefangenes, das nicht verlorengehen soll — auch nicht beim Gerätewechsel.
 *
 * Der Fall: Jemand fängt am Handy eine Rechnung an, kommt bis zur dritten
 * Position, setzt sich an den Rechner. Bisher war der Stand dort weg; er lag
 * im Formular des anderen Geräts und nirgends sonst.
 *
 * Zwei Ablagen, weil sie zwei verschiedene Dinge können. Im Gerät liegt der
 * Entwurf sofort und ohne Netz — das schützt gegen den geschlossenen Reiter,
 * den leeren Akku, die verlorene Verbindung. Beim Server liegt er kurz darauf
 * und schützt gegen den Wechsel des Geräts. Beide werden geschrieben, gelesen
 * wird der jüngere.
 *
 * Was hier bewusst **nicht** passiert: Ein Entwurf wird nie von selbst in das
 * Formular gesetzt. Er wird angeboten. Wer eine Rechnung öffnet und
 * ungefragt einen halben Stand von gestern vorfindet, weiß nicht, ob er einen
 * Fehler sieht oder seine eigene Arbeit — und das ist schlimmer als ein
 * leeres Formular.
 */

/** Im Gerät sofort, damit ein geschlossener Reiter nichts kostet. */
const OERTLICH_MS = 500

/** Zum Server erst, wenn jemand kurz nicht tippt — sonst bei jedem Zeichen. */
const SERVER_MS = 2_500

export type Entwurf<T> = {
  stand: T
  geraet?: string | null
  zeit?: string | number | null
}

/**
 * Woher der Entwurf kommt, in Menschensprache.
 *
 * Steht später in der Frage „Am Handy um 14:22 angefangen — weitermachen?".
 * Ohne diese Angabe müsste man raten, ob es der eigene von vorhin ist oder
 * einer von gestern Abend am anderen Gerät.
 */
function geraeteName(): string {
  if (typeof navigator === 'undefined') return 'einem Gerät'
  const kennung = navigator.userAgent
  if (/iPad|Tablet/i.test(kennung)) return 'Tablet'
  if (/Mobi|iPhone|Android/i.test(kennung)) return 'Handy'
  return 'Rechner'
}

const merkschluessel = (schluessel: string) => `entwurf:${schluessel}`

/** Zwei Stände vergleichen, ohne über Feldreihenfolge zu stolpern. */
function gleich(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

async function vomServer<T>(schluessel: string): Promise<Entwurf<T> | null> {
  try {
    const antwort = await fetch(`/api/office/entwurf?schluessel=${encodeURIComponent(schluessel)}`)
    if (!antwort.ok) return null
    const daten = (await antwort.json()) as { entwurf: Entwurf<T> | null }
    return daten.entwurf ?? null
  } catch {
    // Ohne Netz gibt es eben nur den örtlichen Entwurf
    netzWegMelden()
    return null
  }
}

/**
 * @param schluessel  `bereich:kennung`, etwa `rechnungen:neu` oder `belege:214`
 * @param werte       der aktuelle Formularstand
 * @param urspruenglich  womit das Formular geöffnet wurde — daran erkennt man,
 *                       ob überhaupt etwas angefangen wurde
 */
export function useEntwurf<T extends object>(
  schluessel: string,
  werte: T,
  urspruenglich: T,
): {
  angebot: Entwurf<T> | null
  uebernehmen: () => T | null
  verwerfen: () => void
  erledigt: () => void
} {
  const [angebot, setAngebot] = useState<Entwurf<T> | null>(null)
  const oertlichUhr = useRef<number | undefined>(undefined)
  const serverUhr = useRef<number | undefined>(undefined)
  const start = useRef(urspruenglich)
  // Solange ein Angebot offensteht, wird nichts geschrieben — sonst
  // überschriebe der leere Bildschirm genau den Entwurf, der gerade
  // angeboten wird.
  const haelt = useRef(false)

  // ── Beim Öffnen nachsehen, ob etwas liegt ─────────────────────────────
  useEffect(() => {
    let abgebrochen = false

    const nachsehen = async () => {
      const [hier, dort] = await Promise.all([
        merkenLesen<Entwurf<T>>(merkschluessel(schluessel)).catch(() => undefined),
        vomServer<T>(schluessel),
      ])

      // Der jüngere gewinnt. Fehlt eine Zeit, zählt der andere.
      const zeit = (e?: Entwurf<T> | null) => (e?.zeit ? new Date(e.zeit).getTime() : 0)
      const gefunden = zeit(hier) >= zeit(dort) ? (hier ?? dort) : (dort ?? hier)

      if (abgebrochen || !gefunden?.stand) return
      // Ein Entwurf, der dem entspricht, was ohnehin dasteht, ist keiner
      if (gleich(gefunden.stand, start.current)) return

      haelt.current = true
      setAngebot(gefunden)
    }

    void nachsehen()
    return () => {
      abgebrochen = true
    }
  }, [schluessel])

  // ── Beim Tippen ablegen ───────────────────────────────────────────────
  useEffect(() => {
    if (haelt.current) return
    // Nichts angefangen, nichts zu merken
    if (gleich(werte, start.current)) return

    const stand = { stand: werte, geraet: geraeteName(), zeit: new Date().toISOString() }

    window.clearTimeout(oertlichUhr.current)
    oertlichUhr.current = window.setTimeout(() => {
      void merkenSchreiben(merkschluessel(schluessel), stand).catch(() => undefined)
    }, OERTLICH_MS)

    window.clearTimeout(serverUhr.current)
    serverUhr.current = window.setTimeout(() => {
      if (!istErreichbar()) return
      void fetch('/api/office/entwurf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schluessel, stand: werte, geraet: geraeteName() }),
      }).catch(() => netzWegMelden())
    }, SERVER_MS)

    return () => {
      window.clearTimeout(oertlichUhr.current)
      window.clearTimeout(serverUhr.current)
    }
  }, [schluessel, werte])

  const wegwerfen = useCallback(() => {
    window.clearTimeout(oertlichUhr.current)
    window.clearTimeout(serverUhr.current)
    void merkenSchreiben(merkschluessel(schluessel), undefined).catch(() => undefined)
    void fetch(`/api/office/entwurf?schluessel=${encodeURIComponent(schluessel)}`, {
      method: 'DELETE',
    }).catch(() => undefined)
  }, [schluessel])

  const uebernehmen = useCallback(() => {
    const stand = angebot?.stand ?? null
    // Ab jetzt ist der übernommene Stand der Ausgangspunkt — sonst hielte das
    // Formular ihn gleich wieder für „nichts angefangen".
    if (stand) start.current = stand
    haelt.current = false
    setAngebot(null)
    return stand
  }, [angebot])

  const verwerfen = useCallback(() => {
    haelt.current = false
    setAngebot(null)
    wegwerfen()
  }, [wegwerfen])

  /** Der Datensatz ist gespeichert — der Entwurf hat sich erledigt. */
  const erledigt = useCallback(() => {
    haelt.current = false
    setAngebot(null)
    wegwerfen()
  }, [wegwerfen])

  return { angebot, uebernehmen, verwerfen, erledigt }
}
