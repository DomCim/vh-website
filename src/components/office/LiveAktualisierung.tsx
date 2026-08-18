'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * Hält die Büro-Seiten aktuell, ohne dass jemand nachladen muss.
 *
 * Die Verbindung meldet nur, *dass* sich etwas getan hat — nachgeladen wird
 * dann die Seite, auf der man gerade steht. Das ist genauer als jeder Versuch,
 * einzelne Werte über die Leitung zu schicken: Die Seite rechnet ihre Zahlen
 * ohnehin selbst aus, und so kann nichts auseinanderlaufen.
 *
 * Drei Rücksichten, weil das Ding auf einem Handy in der Werkstatt läuft:
 * Bei verdecktem Fenster wird die Verbindung geschlossen, nach dem Aufwachen
 * neu aufgebaut, und mehrere Meldungen in kurzer Folge lösen nur ein Nachladen
 * aus.
 */
export function LiveAktualisierung() {
  const router = useRouter()
  const draht = useRef<WebSocket | null>(null)
  const zeitgeber = useRef<number | null>(null)
  const versuche = useRef(0)
  const beendet = useRef(false)

  useEffect(() => {
    beendet.current = false

    const nachladen = () => {
      if (zeitgeber.current) window.clearTimeout(zeitgeber.current)
      // Kurz sammeln: Eine Bestellung löst mehrere Änderungen zugleich aus
      zeitgeber.current = window.setTimeout(() => router.refresh(), 400)
    }

    const verbinden = async () => {
      if (beendet.current || document.visibilityState !== 'visible') return
      if (draht.current && draht.current.readyState <= 1) return

      let karte: string
      try {
        const antwort = await fetch('/api/office/live', { credentials: 'include' })
        if (!antwort.ok) return
        karte = (await antwort.json()).karte
      } catch {
        return
      }
      if (beendet.current) return

      const protokoll = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(
        `${protokoll}://${window.location.host}/ws/buero?karte=${encodeURIComponent(karte)}`,
      )
      draht.current = ws

      ws.onopen = () => {
        versuche.current = 0
      }

      ws.onmessage = (nachricht) => {
        try {
          const ereignis = JSON.parse(nachricht.data as string)
          if (ereignis?.bereich && ereignis.bereich !== 'verbunden') nachladen()
        } catch {
          // Unverständliches ignorieren
        }
      }

      ws.onclose = () => {
        draht.current = null
        if (beendet.current) return
        // Wartezeit verdoppeln, aber höchstens eine halbe Minute
        const warten = Math.min(30_000, 1000 * 2 ** versuche.current)
        versuche.current += 1
        window.setTimeout(verbinden, warten)
      }
    }

    const beiSichtbarkeit = () => {
      if (document.visibilityState === 'visible') {
        // Beim Zurückkehren sofort nachladen — in der Zwischenzeit kann
        // einiges passiert sein
        nachladen()
        void verbinden()
      } else {
        draht.current?.close()
      }
    }

    void verbinden()
    document.addEventListener('visibilitychange', beiSichtbarkeit)

    return () => {
      beendet.current = true
      document.removeEventListener('visibilitychange', beiSichtbarkeit)
      if (zeitgeber.current) window.clearTimeout(zeitgeber.current)
      draht.current?.close()
    }
  }, [router])

  return null
}
