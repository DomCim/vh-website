'use client'

import React, { useEffect, useRef, useState } from 'react'

/**
 * Der Pfeil, der zurück an den Seitenanfang bringt.
 *
 * **Warum es ihn überhaupt gibt.** Bis 09/2026 stand ein „↑" im Fuß. Der ist
 * dort, wo man ohnehin am Ende der Seite steht — er half also genau dann,
 * wenn man ihn am wenigsten braucht, und kostete am Handy eine ganze Zeile in
 * einem Streifen, der ohnehin eng ist.
 *
 * **Und warum er trotzdem zurückhaltend sein muss.** Die Kopfleiste ist
 * `fixed` (siehe `Header.tsx`) und fährt immer mit: Menü, Warenkorb und Konto
 * sind in jeder Scrolltiefe einen Tipper entfernt. Das übliche Argument für so
 * einen Knopf — „ich komme nicht mehr an die Navigation" — zieht hier also
 * nicht. Was bleibt, ist der Weg zurück an den Anfang einer langen Liste:
 * Kollektion, Referenzen, häufige Fragen. Auf einer kurzen Seite ist das
 * nichts, und deshalb erscheint er dort auch nicht.
 *
 * Zwei Regeln halten ihn klein:
 *
 *  - Er kommt erst, wenn zwei Bildschirmhöhen gescrollt sind.
 *  - Er geht wieder, sobald der Fuß in Sicht kommt — dort endet die Seite
 *    ohnehin, und zwei Wege nach oben auf einem Bildschirm wären albern.
 *
 * **Kein Horcher am Scrollen.** Ein `scroll`-Ereignis feuert bei jedem
 * Bildwechsel; auf einem älteren Telefon ist das genau die Sorte Arbeit, die
 * das Scrollen hakelig macht. Zwei `IntersectionObserver` melden stattdessen
 * nur die zwei Übergänge, auf die es ankommt.
 */
export function NachOben({ beschriftung }: { beschriftung: string }) {
  const [weitUnten, setWeitUnten] = useState(false)
  const [amEnde, setAmEnde] = useState(false)
  const wache = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const merker = wache.current
    if (!merker || typeof IntersectionObserver === 'undefined') return

    /*
     * `rootMargin` mit 200 % nach oben heißt: Der Merkpunkt gilt so lange als
     * sichtbar, wie er höchstens zwei Bildschirmhöhen über dem Fenster liegt.
     * Damit ist „weit unten" eine Frage der Bildschirmhöhe und nicht einer
     * festen Pixelzahl — auf einem Telefon greift es früher als am großen
     * Bildschirm, und genau so soll es sein.
     */
    const oben = new IntersectionObserver(([e]) => setWeitUnten(!e.isIntersecting), {
      rootMargin: '200% 0px 0px 0px',
    })
    oben.observe(merker)

    /*
     * Den Fuß sucht der Knopf sich selbst, statt ihn gereicht zu bekommen: Er
     * soll sich überall einhängen lassen, ohne dass das Grundgerüst eine
     * Verbindung zwischen zwei Bauteilen herstellen muss. Es gibt genau ein
     * `<footer>` je Seite.
     */
    const fuss = document.querySelector('footer')
    const unten = fuss
      ? new IntersectionObserver(([e]) => setAmEnde(e.isIntersecting), {
          rootMargin: '0px 0px 10% 0px',
        })
      : null
    if (fuss && unten) unten.observe(fuss)

    return () => {
      oben.disconnect()
      unten?.disconnect()
    }
  }, [])

  const zeigen = weitUnten && !amEnde

  function hoch() {
    // Wer Bewegung abbestellt hat, bekommt keine — sonst gleitet es wie überall
    // sonst auf der Seite (`scroll-behavior: smooth` in globals.css).
    const sanft = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: sanft ? 'smooth' : 'auto' })
  }

  return (
    <>
      {/*
        Der Merkpunkt liegt am Anfang des Dokuments, das Bauteil selbst steht
        aber unter dem Fuß. Beides geht zusammen, weil `absolute` ohne
        positionierten Vorfahren am Seitenanfang misst — so bleibt der Knopf
        ein einziges Bauteil, das man an einer Stelle einhängt.
      */}
      <div ref={wache} aria-hidden="true" className="pointer-events-none absolute top-0 h-px w-px" />

      <button
        type="button"
        onClick={hoch}
        aria-label={beschriftung}
        aria-hidden={!zeigen}
        tabIndex={zeigen ? 0 : -1}
        className={`border-line bg-paper/85 text-ink-soft hover:text-ink hover:border-ink-soft fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex h-11 w-11 items-center justify-center rounded-full border shadow-lg backdrop-blur transition-[opacity,transform,color,border-color] duration-200 sm:right-6 sm:bottom-6 ${
          zeigen ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
        } motion-reduce:transition-none`}
      >
        <span aria-hidden="true">↑</span>
      </button>
    </>
  )
}
