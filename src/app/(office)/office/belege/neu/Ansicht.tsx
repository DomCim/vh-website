'use client'

import React from 'react'

import { BelegFormular } from '../../../../../components/office/BelegFormular'
import { useRahmen } from '../../../../../lib/buero/bestand'
import { AUSGABEN_KATEGORIEN } from '../../../../../lib/listen'

/** Neuer Beleg — braucht nichts vom Server außer der Frage, ob die KI da ist. */
export function NeuerBelegAnsicht() {
  const { kiVerfuegbar } = useRahmen()

  return (
    <>
      <h1>Beleg erfassen</h1>
      <p className="buero-unterzeile">
        Beleg fotografieren, kurz prüfen, speichern. Der Scan bleibt am Eintrag hängen.
      </p>
      <BelegFormular
        werte={{ invoiceDate: new Date().toISOString().slice(0, 10) }}
        kategorien={[...AUSGABEN_KATEGORIEN]}
        kiVerfuegbar={kiVerfuegbar}
      />
    </>
  )
}
