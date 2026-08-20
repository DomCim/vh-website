'use client'

import React, { useState } from 'react'

import { useAbgleichstand } from '../../lib/buero/abgleichstand'

/**
 * Der Abgleich als Punkt in der Kopfleiste.
 *
 * Die Meldeleiste über dem Inhalt sagt alles im Klartext, kostet dafür aber
 * eine Zeile — und sie erscheint nur im Störfall. Der Punkt steht immer an
 * derselben Stelle und kostet nichts: Man lernt, dorthin zu schauen, statt
 * eine Zeile zu suchen, die meistens fehlt.
 *
 * Grau heißt ohne Netz — ein Zustand, kein Fehler; in der Werkstatt ist das
 * der Normalfall. Bronze heißt: geht noch raus. Rot heißt: Der Server hat
 * etwas zurückgewiesen, und das geht von selbst nicht weg.
 *
 * Antippen zeigt den Klartext — auf einem Handy gibt es kein Überfahren mit
 * der Maus, also braucht die Farbe einen Weg, sich zu erklären.
 */
export function Abgleichpunkt() {
  const stand = useAbgleichstand()
  const [offen, setOffen] = useState(false)

  if (!stand) return null

  return (
    <span className="buero-abgleichpunkt-huelle">
      <button
        type="button"
        className={`buero-abgleichpunkt ist-${stand.art}`}
        aria-label={`Abgleich: ${stand.text}`}
        aria-expanded={offen}
        onClick={() => setOffen((v) => !v)}
      />
      {offen && (
        <span className="buero-abgleichpunkt-text" role="status">
          {stand.text}
        </span>
      )}
    </span>
  )
}
