'use client'

import React, { useEffect, useState } from 'react'

/**
 * Lebt der Takt noch?
 *
 * **Warum das im Büro sichtbar sein muss.** Seit der Takt in einem eigenen
 * Container läuft, fällt sein Ausfall nicht mehr von selbst auf. Vorher saß er
 * im Web-Container: War er weg, war die Website weg, und das merkte man
 * sofort. Ein eigener Prozess stirbt still — und mit ihm die nächtliche
 * Sicherung, die Erinnerungen und die Meldung über neue Post. Genau das steht
 * als Warnung im Kästchen darüber, nur konnte es bisher niemand nachsehen.
 *
 * Die Auskunft kommt aus der Datenbank, nicht vom Takt-Container selbst: Zu
 * dem führt von außen kein Weg, und das soll so bleiben. Er legt sein
 * Lebenszeichen ab, und wer fragt, bekommt es vom Web-Container.
 */

type Stand = { status: string; takt: boolean; letzterSchlagVorSekunden?: number; grund?: string }

function alterText(sekunden: number): string {
  if (sekunden < 90) return `vor ${sekunden} Sekunden`
  const minuten = Math.round(sekunden / 60)
  if (minuten < 90) return `vor ${minuten} Minuten`
  const stunden = Math.round(minuten / 60)
  return stunden < 36 ? `vor ${stunden} Stunden` : `vor ${Math.round(stunden / 24)} Tagen`
}

export function TaktStand() {
  const [stand, setStand] = useState<Stand | null>(null)
  const [fehler, setFehler] = useState(false)

  useEffect(() => {
    let lebt = true
    const holen = async () => {
      try {
        const r = await fetch('/api/takt/healthz')
        const d = (await r.json()) as Stand
        if (lebt) {
          setStand(d)
          setFehler(false)
        }
      } catch {
        if (lebt) setFehler(true)
      }
    }
    void holen()
    // Nachfragen, solange jemand hinsieht — der Takt schlägt jede Minute.
    const uhr = setInterval(() => void holen(), 60_000)
    return () => {
      lebt = false
      clearInterval(uhr)
    }
  }, [])

  if (fehler) {
    return (
      <div className="buero-hinweis warn">
        <strong>Stand des Taktes nicht abrufbar.</strong> Dafür braucht es Netz.
      </div>
    )
  }

  if (!stand) return null

  if (!stand.takt) {
    return (
      <div className="buero-hinweis warn">
        <strong>Der Takt steht still.</strong>{' '}
        {stand.letzterSchlagVorSekunden
          ? `Der letzte Schlag war ${alterText(stand.letzterSchlagVorSekunden)}.`
          : 'Es liegt kein Lebenszeichen vor.'}{' '}
        Solange das so ist, gibt es keine nächtliche Sicherung, keine Erinnerungen und keine
        Meldung über neue Post. Der Takt läuft in einem eigenen Container — wer nachsehen will,
        schaut dort nach `vh-website-takt`.
      </div>
    )
  }

  return (
    <p className="buero-unterzeile" style={{ marginTop: '-.6rem' }}>
      Der Takt läuft — letzter Schlag{' '}
      {alterText(stand.letzterSchlagVorSekunden ?? 0)}. Er arbeitet in einem eigenen Prozess,
      damit ein langer Postfach-Blick die Website nicht ausbremst.
    </p>
  )
}
