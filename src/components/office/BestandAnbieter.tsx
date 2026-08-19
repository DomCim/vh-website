'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import { istBereich } from '../../lib/bereiche'
import { abgleichen, bestandLaden, netzZustandSetzen } from '../../lib/buero/bestand'
import { abarbeiten, warteschlangeLaden } from '../../lib/buero/warteschlange'

/**
 * Hält den Bestand im Gerät aktuell.
 *
 * Drei Wege führen zu einem Abgleich, und alle drei werden gebraucht:
 *
 *   1. Beim Öffnen der App — was über Nacht passiert ist, fehlt sonst.
 *   2. Die Live-Verbindung meldet jede Änderung, sobald sie geschieht. Das
 *      ist der schnelle Weg, aber er setzt Netz voraus.
 *   3. Ein Rückfall alle paar Minuten, falls die Verbindung unbemerkt
 *      abgerissen ist. Ein Handy in der Hosentasche verliert sie öfter, als
 *      der Browser meldet.
 *
 * Dazu die offensichtlichen Auslöser: Netz wieder da, Fenster wieder sichtbar.
 */

/** Rückfall, falls die Live-Verbindung unbemerkt tot ist. */
const RUECKFALL_MS = 5 * 60_000

/** Kurz sammeln: Eine Bestellung löst mehrere Änderungen zugleich aus. */
const SAMMELN_MS = 400

export function BestandAnbieter() {
  const router = useRouter()
  const pfad = usePathname()
  const draht = useRef<WebSocket | null>(null)
  const sammler = useRef<number | null>(null)
  const offen = useRef(new Set<string>())
  const versuche = useRef(0)
  const beendet = useRef(false)

  useEffect(() => {
    beendet.current = false

    void bestandLaden().then(() => {
      void warteschlangeLaden()
      void abarbeiten()
      return abgleichen()
    })

    /** Gesammelte Meldungen abarbeiten. */
    const nachziehen = () => {
      if (sammler.current) window.clearTimeout(sammler.current)
      sammler.current = window.setTimeout(() => {
        const bereiche = [...offen.current]
        offen.current.clear()
        void abgleichen(bereiche.filter(istBereich))

        // Solange die Büro-Seiten noch auf dem Server rendern, müssen sie
        // zusätzlich nachgeladen werden. Fällt weg, sobald alle Ansichten aus
        // dem Bestand lesen.
        router.refresh()
      }, SAMMELN_MS)
    }

    /** Wartezeit verdoppeln, aber höchstens eine halbe Minute. */
    const spaeterNochmal = () => {
      if (beendet.current) return
      const warten = Math.min(30_000, 1000 * 2 ** versuche.current)
      versuche.current += 1
      window.setTimeout(verbinden, warten)
    }

    const verbinden = async () => {
      if (beendet.current || document.visibilityState !== 'visible') return
      if (draht.current && draht.current.readyState <= 1) return

      let karte: string
      try {
        const antwort = await fetch('/api/office/live', { credentials: 'include' })
        // Die Seiten selbst fragen den Server nicht mehr, also merkt niemand
        // sonst, dass die Anmeldung abgelaufen ist. Hier schon.
        if (antwort.status === 401 || antwort.status === 403) {
          if (!pfad.startsWith('/office/login') && !pfad.startsWith('/office/kein-zugang')) {
            router.replace('/office/login')
          }
        }
        // Auf der Anmeldeseite gibt es noch keine Karte. Nicht aufgeben,
        // sondern nachfassen — sonst bliebe die Verbindung nach dem Anmelden
        // aus, weil diese Hülle dabei nicht neu geladen wird.
        if (!antwort.ok) return spaeterNochmal()
        karte = (await antwort.json()).karte
      } catch {
        return spaeterNochmal()
      }
      if (beendet.current) return

      const protokoll = window.location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(
        `${protokoll}://${window.location.host}/ws/buero?karte=${encodeURIComponent(karte)}`,
      )
      draht.current = ws

      ws.onopen = () => {
        versuche.current = 0
        // Zwischen dem letzten Abgleich und dieser Verbindung kann einiges
        // passiert sein — etwa die Anmeldung selbst.
        void abarbeiten()
        void abgleichen()
      }

      ws.onmessage = (nachricht) => {
        try {
          const ereignis = JSON.parse(nachricht.data as string)
          if (!ereignis?.bereich || ereignis.bereich === 'verbunden') return
          offen.current.add(ereignis.bereich)
          nachziehen()
        } catch {
          // Unverständliches ignorieren
        }
      }

      ws.onclose = () => {
        draht.current = null
        spaeterNochmal()
      }
    }

    const beiSichtbarkeit = () => {
      if (document.visibilityState === 'visible') {
        void abarbeiten()
        void abgleichen()
        void verbinden()
      } else {
        draht.current?.close()
      }
    }

    const beiOnline = () => {
      netzZustandSetzen(true)
      // Zuerst das Eigene loswerden, dann nachsehen was fremd dazugekommen ist
      void abarbeiten()
      void abgleichen()
      void verbinden()
    }
    const beiOffline = () => netzZustandSetzen(false)

    // Der Service Worker hält das Gerüst bereit — ohne ihn zeigt der Browser
    // ohne Netz seine eigene Fehlerseite, und der Bestand im Gerät nützt nichts.
    // Bewusst hier und nicht erst beim Einschalten der Benachrichtigungen:
    // Offline arbeiten will man auch ohne Meldungen aufs Handy.
    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/office-sw.js', { scope: '/office' }).catch(() => {
        // Ohne Worker läuft alles weiter, nur eben nicht ohne Netz
      })
    }

    netzZustandSetzen(navigator.onLine)
    void verbinden()

    const uhr = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void abarbeiten()
      void abgleichen()
    }, RUECKFALL_MS)

    document.addEventListener('visibilitychange', beiSichtbarkeit)
    window.addEventListener('online', beiOnline)
    window.addEventListener('offline', beiOffline)

    return () => {
      beendet.current = true
      window.clearInterval(uhr)
      document.removeEventListener('visibilitychange', beiSichtbarkeit)
      window.removeEventListener('online', beiOnline)
      window.removeEventListener('offline', beiOffline)
      if (sammler.current) window.clearTimeout(sammler.current)
      draht.current?.close()
    }
  }, [pfad, router])

  return null
}
