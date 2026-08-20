'use client'

import { usePathname } from 'next/navigation'
import React, { useEffect, useState } from 'react'

/**
 * Trägt den Namen der offenen Seite in die Kopfleiste — am Handy.
 *
 * **Warum überhaupt.** Oben standen ein Schriftzug, der zur Übersicht
 * verlinkt, und „Abmelden". Die Übersicht ist unten der erste Tab, und
 * abgemeldet wird selten. Zusammen mit dem Sicherheitsrand des Geräts kostete
 * die Leiste damit rund 116 Pixel für nichts, was man dort braucht.
 *
 * **Warum aus dem Inhalt gelesen und nicht aus einer Tabelle.** Eine Liste
 * „Pfad → Name" müsste jede der Seiten kennen und liefe bei jeder neuen aus
 * dem Takt; bei Detailseiten stünde ohnehin nur „Auftrag" statt
 * „Auftrag AU-2026-0001". Die Überschrift der Seite weiß es bereits. Sie
 * wandert nach oben, und im Inhalt entfällt sie — die Zeile darunter, die
 * erklärt, worum es geht, bleibt stehen.
 *
 * **Warum die Überschrift per Klasse ausgeblendet wird und nicht fest.**
 * Ohne Skript passiert hier gar nichts, dann bleibt sie stehen, wo sie war.
 * Erst wenn der Name wirklich oben angekommen ist, setzt diese Komponente
 * `titel-oben` — die Seite ist damit nie ohne Überschrift.
 */
export function Kopftitel() {
  const pfad = usePathname()
  const [titel, setTitel] = useState('')

  useEffect(() => {
    const inhalt = document.querySelector('.buero-inhalt')
    if (!inhalt) return

    const lesen = () => {
      const h1 = inhalt.querySelector('h1')
      const text = (h1?.textContent ?? '').trim()
      setTitel(text)
      document.documentElement.classList.toggle('titel-oben', Boolean(text))
    }

    lesen()

    /*
     * Die Überschrift steht nicht immer sofort da: Das Büro rechnet seine
     * Seiten aus dem Bestand im Gerät, und der ist einen Wimpernschlag später
     * fertig. Ohne Beobachter bliebe die Leiste bei „wird geholt …" stehen.
     */
    const beobachter = new MutationObserver(lesen)
    beobachter.observe(inhalt, { childList: true, subtree: true, characterData: true })
    return () => {
      beobachter.disconnect()
      document.documentElement.classList.remove('titel-oben')
    }
  }, [pfad])

  if (!titel) return null
  return <span className="buero-kopftitel">{titel}</span>
}
