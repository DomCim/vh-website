'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { abgleichen } from '../../lib/buero/bestand'
import { abarbeiten } from '../../lib/buero/warteschlange'

/**
 * Ziehen zum Aktualisieren — die Geste, die jede App am Handy kann.
 *
 * Als installierte App gibt es keinen Neuladen-Knopf und kein eingebautes
 * Herunterziehen des Browsers; wer wissen wollte, ob etwas Neues da ist,
 * musste den Abgleichpunkt oben rechts treffen. Die Geste ist der gelernte
 * Weg, also gibt es sie jetzt auch hier.
 *
 * Was sie tut, ist bewusst **kein** Neuladen der Seite: Das Büro lebt aus dem
 * Bestand im Gerät, und ein harter Reload würde nur das Gerüst neu holen und
 * die Stelle verlieren, an der man stand. Stattdessen passiert das, was
 * „aktualisieren" hier wirklich heißt — Wartendes aus der Warteschlange
 * rausschicken und den Abgleich anstoßen. Genau das, was auch der
 * Abgleichpunkt tut.
 *
 * Die Anfasser sind passiv (kein preventDefault): Die Geste soll dem Scrollen
 * nie im Weg stehen. Dass der Browser dabei am oberen Rand sein eigenes
 * Gummiband zeigt, ist in Ordnung — das eingebaute Seiten-Neuladen von
 * Chrome & Co. schaltet `overscroll-behavior` im Stylesheet ab, sonst liefe
 * beides übereinander.
 */

/** Ab dieser gezogenen Strecke (nach Bremse) wird ausgelöst */
const SCHWELLE = 60
/** Weiter als das folgt der Zeiger dem Finger nicht */
const KAPPE = 90
/** So kurz darf der Kreis nicht verschwinden — sonst wirkt es wie ein Flackern */
const MINDESTDAUER_MS = 600

export function ZiehenAktualisieren() {
  const pfad = usePathname()
  // Vor der Anmeldung gibt es nichts abzugleichen — die Geste würde dort nur
  // eine Fehlermeldung über einen Abgleich erzeugen, den niemand wollte.
  const ohneAnmeldung = pfad === '/office/login' || pfad === '/office/kein-zugang'
  const zeiger = useRef<HTMLDivElement>(null)
  const [laeuft, setLaeuft] = useState(false)
  const stand = useRef<{ startX: number; startY: number; aktiv: boolean; strecke: number }>({
    startX: 0,
    startY: 0,
    aktiv: false,
    strecke: 0,
  })
  const laeuftRef = useRef(false)

  useEffect(() => {
    if (ohneAnmeldung) return

    const obenAm = () => (document.scrollingElement?.scrollTop ?? 0) <= 0

    const zeichnen = (strecke: number) => {
      const el = zeiger.current
      if (!el) return
      const anteil = Math.min(1, strecke / SCHWELLE)
      el.style.transform = `translateX(-50%) translateY(${strecke - 48}px) rotate(${anteil * 270}deg)`
      el.style.opacity = String(anteil)
      el.classList.toggle('bereit', strecke >= SCHWELLE)
    }

    const anfang = (e: TouchEvent) => {
      if (laeuftRef.current || e.touches.length !== 1 || !obenAm()) return
      stand.current = {
        startX: e.touches[0]!.clientX,
        startY: e.touches[0]!.clientY,
        aktiv: true,
        strecke: 0,
      }
    }

    const ziehen = (e: TouchEvent) => {
      if (!stand.current.aktiv || laeuftRef.current) return
      const delta = e.touches[0]!.clientY - stand.current.startY
      const seitlich = Math.abs(e.touches[0]!.clientX - stand.current.startX)
      // Wer nach oben wischt, längst scrollt — oder seitlich wischt (etwa
      // eine Mail-Zeile) —, meint nicht das Neuladen: Geste beenden
      if (delta <= 0 || !obenAm() || (seitlich > 12 && seitlich > delta)) {
        stand.current.aktiv = false
        zeichnen(0)
        return
      }
      // Bremse: der Zeiger folgt dem Finger nur gedämpft, wie überall üblich
      stand.current.strecke = Math.min(KAPPE, delta * 0.45)
      zeichnen(stand.current.strecke)
    }

    const ende = () => {
      if (!stand.current.aktiv) return
      stand.current.aktiv = false
      if (stand.current.strecke < SCHWELLE) {
        zeichnen(0)
        return
      }

      laeuftRef.current = true
      setLaeuft(true)
      const el = zeiger.current
      if (el) {
        el.style.transform = 'translateX(-50%) translateY(16px)'
        el.style.opacity = '1'
      }

      const begonnen = Date.now()
      void Promise.allSettled([abarbeiten(), abgleichen()]).then(() => {
        const rest = Math.max(0, MINDESTDAUER_MS - (Date.now() - begonnen))
        window.setTimeout(() => {
          laeuftRef.current = false
          setLaeuft(false)
          zeichnen(0)
        }, rest)
      })
    }

    // Passiv: die Geste beobachtet das Scrollen nur, sie bremst es nie
    window.addEventListener('touchstart', anfang, { passive: true })
    window.addEventListener('touchmove', ziehen, { passive: true })
    window.addEventListener('touchend', ende, { passive: true })
    window.addEventListener('touchcancel', ende, { passive: true })
    return () => {
      window.removeEventListener('touchstart', anfang)
      window.removeEventListener('touchmove', ziehen)
      window.removeEventListener('touchend', ende)
      window.removeEventListener('touchcancel', ende)
    }
  }, [ohneAnmeldung])

  if (ohneAnmeldung) return null

  return (
    <div
      ref={zeiger}
      className={`buero-ziehen${laeuft ? ' dreht' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        {laeuft ? (
          // Offener Kreis — dreht per CSS, solange abgeglichen wird
          <path d="M12 3a9 9 0 1 1-8.5 6" />
        ) : (
          // Pfeil nach unten — dreht sich mit der gezogenen Strecke mit
          <path d="M12 4v14m0 0l-5-5m5 5l5-5" />
        )}
      </svg>
    </div>
  )
}
