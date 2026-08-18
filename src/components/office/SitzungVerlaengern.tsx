'use client'

import { useEffect } from 'react'

/**
 * Hält die Anmeldung am Leben, solange das Büro benutzt wird.
 *
 * Die Anmeldung gilt eine Woche. Ohne Verlängerung hieße das: Wer täglich
 * arbeitet, wird trotzdem jeden siebten Tag herausgeworfen — und zwar
 * mitten in etwas, denn ausgerechnet dann steht man an der Werkbank. Also
 * bittet die Seite bei jedem Aufruf um eine frische Woche.
 *
 * Sicherer ist das obendrein als ein von vornherein langes Fenster: Ein
 * Gerät, das eine Woche lang nicht angefasst wurde, ist danach nicht mehr
 * angemeldet.
 */
export function SitzungVerlaengern() {
  useEffect(() => {
    const verlaengern = () => {
      // Fehler sind hier bedeutungslos: Wer nicht angemeldet ist, wird
      // ohnehin zur Anmeldung geschickt.
      void fetch('/api/users/refresh-token', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => undefined)
    }

    verlaengern()

    // Wer das Büro als App den ganzen Tag offen hat, soll ebenfalls nicht
    // herausfallen — alle sechs Stunden und beim Zurückkehren zur App.
    const uhr = window.setInterval(verlaengern, 6 * 60 * 60 * 1000)
    const beiRueckkehr = () => {
      if (document.visibilityState === 'visible') verlaengern()
    }
    document.addEventListener('visibilitychange', beiRueckkehr)

    return () => {
      window.clearInterval(uhr)
      document.removeEventListener('visibilitychange', beiRueckkehr)
    }
  }, [])

  return null
}
