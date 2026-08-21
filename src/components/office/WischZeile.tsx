'use client'

import React, { useRef } from 'react'

/**
 * Eine Listenzeile, die sich am Handy wischen lässt.
 *
 * Nach links wischen löst die eine Aktion aus (typisch: Löschen), nach rechts
 * die andere (typisch: als ungelesen markieren) — die Geste, die jede
 * Mail-App kann. Unter der Zeile liegt dabei die Farbfläche mit dem Wort,
 * damit man vor dem Loslassen sieht, was gleich passiert; ab der Schwelle
 * wird sie satt.
 *
 * Das Scrollen bleibt ungestört: `touch-action: pan-y` überlässt Senkrechtes
 * dem Browser, und die erste Bewegung entscheidet die Achse — wer schräg nach
 * unten zieht, scrollt, und die Zeile bleibt liegen. Am Rechner ohne
 * Berührung passiert hier schlicht nichts; dort gibt es die Knöpfe.
 */

export type WischAktion = {
  text: string
  /** 'rot' für Endgültiges, 'bronze' für Markierendes */
  art: 'rot' | 'bronze'
  tun: () => void
}

/** Ab dieser Strecke wird beim Loslassen ausgelöst */
const SCHWELLE = 72
/** Weiter folgt die Zeile dem Finger nicht */
const KAPPE = 120

export function WischZeile({
  nachLinks,
  nachRechts,
  children,
}: {
  /** Aktion beim Wischen nach links (Fläche erscheint rechts) */
  nachLinks?: WischAktion
  /** Aktion beim Wischen nach rechts (Fläche erscheint links) */
  nachRechts?: WischAktion
  children: React.ReactNode
}) {
  const inhalt = useRef<HTMLDivElement>(null)
  const linksFlaeche = useRef<HTMLDivElement>(null)
  const rechtsFlaeche = useRef<HTMLDivElement>(null)
  const stand = useRef<{
    startX: number
    startY: number
    /** null = Achse noch nicht entschieden, false = Scrollen gewonnen */
    aktiv: boolean | null
    dx: number
  }>({ startX: 0, startY: 0, aktiv: false, dx: 0 })

  const zeichnen = (dx: number) => {
    const el = inhalt.current
    if (!el) return
    el.style.transform = dx ? `translateX(${dx}px)` : ''
    el.style.transition = dx ? 'none' : 'transform 0.18s ease-out'
    const bereitLinks = dx <= -SCHWELLE
    const bereitRechts = dx >= SCHWELLE
    linksFlaeche.current?.classList.toggle('bereit', bereitLinks)
    rechtsFlaeche.current?.classList.toggle('bereit', bereitRechts)
    if (linksFlaeche.current) linksFlaeche.current.style.opacity = dx < 0 ? '1' : '0'
    if (rechtsFlaeche.current) rechtsFlaeche.current.style.opacity = dx > 0 ? '1' : '0'
  }

  const anfang = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    stand.current = {
      startX: e.touches[0]!.clientX,
      startY: e.touches[0]!.clientY,
      aktiv: null,
      dx: 0,
    }
  }

  const ziehen = (e: React.TouchEvent) => {
    const s = stand.current
    if (s.aktiv === false) return
    const dx = e.touches[0]!.clientX - s.startX
    const dy = e.touches[0]!.clientY - s.startY

    // Die erste klare Bewegung entscheidet die Achse — danach bleibt es dabei
    if (s.aktiv === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      s.aktiv = Math.abs(dx) > Math.abs(dy)
      if (!s.aktiv) return
    }

    let begrenzt = Math.max(-KAPPE, Math.min(KAPPE, dx))
    if (begrenzt < 0 && !nachLinks) begrenzt = 0
    if (begrenzt > 0 && !nachRechts) begrenzt = 0
    s.dx = begrenzt
    zeichnen(begrenzt)
  }

  const ende = () => {
    const s = stand.current
    const dx = s.dx
    stand.current = { startX: 0, startY: 0, aktiv: false, dx: 0 }
    if (!dx) return
    zeichnen(0)
    if (dx <= -SCHWELLE && nachLinks) nachLinks.tun()
    else if (dx >= SCHWELLE && nachRechts) nachRechts.tun()
  }

  return (
    <div
      className="buero-wisch"
      onTouchStart={anfang}
      onTouchMove={ziehen}
      onTouchEnd={ende}
      onTouchCancel={ende}
    >
      {nachRechts && (
        <div ref={rechtsFlaeche} className={`buero-wisch-flaeche links ${nachRechts.art}`}>
          {nachRechts.text}
        </div>
      )}
      {nachLinks && (
        <div ref={linksFlaeche} className={`buero-wisch-flaeche rechts ${nachLinks.art}`}>
          {nachLinks.text}
        </div>
      )}
      <div ref={inhalt} className="buero-wisch-inhalt">
        {children}
      </div>
    </div>
  )
}
