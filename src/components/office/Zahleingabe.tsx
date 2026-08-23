'use client'

import React, { useState } from 'react'

import { textAusZahl, zahlAusText } from '../../lib/zahleingabe'

/**
 * Ein Feld für eine Zahl — mit Komma.
 *
 * Warum es das gibt und was vorher kaputt war, steht bei den Regeln in
 * `lib/zahleingabe.ts`. Hier steht nur der Teil, der ein Bauteil braucht: der
 * **Zustand des Tippens**.
 *
 * Solange jemand tippt, gilt der getippte Text — auch „0," oder „-", also
 * Zwischenstände, die noch keine Zahl sind. Nach oben gemeldet wird trotzdem
 * bei jedem Anschlag die Zahl, die sich daraus schon ergibt; die Summe unter
 * dem Formular rechnet also mit. Verliert das Feld die Aufmerksamkeit, fällt
 * der Text weg und es zeigt wieder das, was wirklich gespeichert ist. Wer
 * Unsinn getippt hat, sieht dann die letzte gültige Zahl.
 *
 * Bewusst **kein** `type="number"`: Das zeigt am Handy zwar eine Zifferntastatur,
 * bringt aber Pfeilchen, verschluckt je nach Browser und Sprache das Komma und
 * meldet bei ungültiger Eingabe eine leere Zeichenkette — man weiß dann nicht
 * mehr, ob das Feld leer ist oder unfertig. `inputMode="decimal"` bringt
 * dieselbe Tastatur ohne diesen Ballast.
 */

type Eigene = {
  wert: number | null | undefined
  aendern: (wert: number | null) => void
  /**
   * Was ein geleertes Feld bedeutet. `null` heißt „nicht gesetzt" (Mindestbestand,
   * Einkaufswert), `0` heißt „null Stück" (Mengen und Preise in Positionen).
   */
  beiLeer?: number | null
}

type Uebrig = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'inputMode' | 'type'
>

export function Zahleingabe({ wert, aendern, beiLeer = null, ...rest }: Eigene & Uebrig) {
  const [getippt, setGetippt] = useState<string | null>(null)

  return (
    <input
      {...rest}
      inputMode="decimal"
      value={getippt ?? textAusZahl(wert)}
      onChange={(e) => {
        setGetippt(e.target.value)
        aendern(zahlAusText(e.target.value, beiLeer))
      }}
      onBlur={(e) => {
        setGetippt(null)
        rest.onBlur?.(e)
      }}
    />
  )
}
