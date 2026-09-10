'use client'

import React, { useState } from 'react'

/**
 * Ein Fragezeichen, hinter dem die Erklärung steht.
 *
 * **Warum nicht der Titel-Schwebetext.** Die Büro-App läuft am
 * Werkstatt-Tablet; dort gibt es kein Schweben, und ein `title` ist damit für
 * genau die Leute unsichtbar, die ihn am ehesten brauchen. Also ein Knopf, der
 * antippbar ist.
 *
 * **Warum nicht dauerhaft danebenschreiben.** Der Steuerfall braucht drei
 * Absätze Erklärung, damit er entscheidbar ist. Ständig sichtbar wären sie
 * Lärm für den, der die Antwort längst kennt, und der Rest des Formulars
 * rutschte nach unten.
 */
export function Erklaerung({ titel, children }: { titel: string; children: React.ReactNode }) {
  const [offen, setOffen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="buero-fragezeichen"
        aria-expanded={offen}
        aria-label={offen ? `Erklärung zu ${titel} schließen` : `Was bedeutet ${titel}?`}
        onClick={() => setOffen((o) => !o)}
      >
        ?
      </button>
      {offen && (
        <div className="buero-hinweis" style={{ marginTop: '.5rem' }}>
          {children}
        </div>
      )}
    </>
  )
}
