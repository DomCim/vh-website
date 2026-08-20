'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Wo eine Seite beginnt — oben bei einem neuen Ziel, beim alten Stand hinter
 * dem Zurück-Knopf.
 *
 * Beides klingt selbstverständlich und ist es im Büro gerade nicht, und zwar
 * aus **derselben** Ursache: Die Seiten entstehen aus dem Bestand im Gerät,
 * sind im Moment des Wechsels also noch fast leer. Der Browser setzt den
 * Stand, solange die Seite null Pixel hoch ist — danach wächst sie, und der
 * gesetzte Stand passt zu nichts mehr.
 *
 * Nach vorne fällt das am iPhone auf: Man landet mitten in einer Liste, die
 * man nie gesehen hat, weil WebKit den gemerkten Stand der vorigen Seite
 * wieder herstellt. Nach hinten fällt es überall auf: Man kommt aus einem
 * Beleg zurück in die Liste und steht ganz oben, statt bei dem Beleg, den man
 * gerade angesehen hat.
 *
 * Deshalb übernimmt diese Komponente beides selbst:
 *
 * **Der Stand wird laufend gemerkt**, je Adresse, in der Sitzungsablage —
 * gedrosselt, damit das Scrollen nicht ins Stocken gerät.
 *
 * **Nach vorne** geht es nach oben, dreimal: sofort, im nächsten Bild und
 * kurz danach. Das deckt ab, dass der Inhalt später steht.
 *
 * **Nach hinten** wird gewartet, bis die Seite überhaupt hoch genug ist, und
 * erst dann zurückgesprungen. Ohne dieses Warten liefe der Sprung ins Leere.
 */

const ABLAGE = 'buero-scroll:'
/** Höchstens so lange auf den Inhalt warten — danach bleibt es eben oben. */
const GEDULD_MS = 1200

export function Scrollstart() {
  const pfad = usePathname()
  const vomZurueck = useRef(false)

  useEffect(() => {
    /*
     * Der Browser soll sich heraushalten. Seine eigene Wiederherstellung
     * greift zu früh — siehe oben — und würde gegen die hier arbeiten.
     */
    const vorher = history.scrollRestoration
    history.scrollRestoration = 'manual'
    /*
     * Nicht jedes Zurück meldet sich mit `popstate`: Kommt man aus dem
     * Payload-Admin oder von einer gewöhnlichen Verknüpfung zurück, lädt der
     * Browser das Dokument neu, und dann gibt es kein `popstate` mehr, das
     * hier ankommen könnte. Ohne diese Abfrage landete man in genau dem Fall
     * ganz oben. Der Browser verrät die Art der Navigation selbst.
     */
    const art = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    if (art?.type === 'back_forward') vomZurueck.current = true
    const merken = () => {
      vomZurueck.current = true
    }
    window.addEventListener('popstate', merken)
    return () => {
      window.removeEventListener('popstate', merken)
      history.scrollRestoration = vorher
    }
  }, [])

  // Den Stand dieser Seite laufend festhalten
  useEffect(() => {
    let geplant = 0
    const schreiben = () => {
      geplant = 0
      try {
        sessionStorage.setItem(ABLAGE + pfad, String(Math.round(window.scrollY)))
      } catch {
        // Sitzungsablage kann voll oder gesperrt sein — dann eben ohne
      }
    }
    const beiScroll = () => {
      if (!geplant) geplant = window.setTimeout(schreiben, 200)
    }
    window.addEventListener('scroll', beiScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', beiScroll)
      if (geplant) clearTimeout(geplant)
      /*
       * Beim Aufräumen wird **nicht** mehr geschrieben, und das ist der Kern
       * der Sache: Diese Aufräumarbeit läuft beim Seitenwechsel, und da steht
       * der Stand längst wieder auf 0. Der gemerkte Wert wurde damit
       * ausgerechnet in dem Moment mit einer Null überschrieben, in dem er
       * gebraucht wird. Gemerkt wird nur beim Scrollen selbst — höchstens
       * 200 Millisekunden alt, und das genügt.
       */
    }
  }, [pfad])

  useEffect(() => {
    const hoch = () => window.scrollTo(0, 0)

    if (!vomZurueck.current) {
      hoch()
      const bild = requestAnimationFrame(hoch)
      const spaeter = setTimeout(hoch, 150)
      return () => {
        cancelAnimationFrame(bild)
        clearTimeout(spaeter)
      }
    }

    vomZurueck.current = false
    const ziel = Number(sessionStorage.getItem(ABLAGE + pfad) ?? 0)
    if (!ziel) return

    /*
     * Warten, bis die Seite den Stand überhaupt hergibt. Springt man zu früh,
     * klemmt der Browser den Wert auf die dann noch geringe Höhe — und man
     * steht wieder oben, obwohl alles richtig gemerkt war.
     */
    const beginn = Date.now()
    const takt = window.setInterval(() => {
      const passt = document.body.scrollHeight >= ziel + window.innerHeight
      if (passt || Date.now() - beginn > GEDULD_MS) {
        window.scrollTo(0, ziel)
        clearInterval(takt)
      }
    }, 50)
    return () => clearInterval(takt)
  }, [pfad])

  return null
}
