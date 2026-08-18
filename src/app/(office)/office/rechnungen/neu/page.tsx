'use client'

import React from 'react'

import { RechnungFormular } from '../../../../../components/office/RechnungFormular'

/** Neue Rechnung — braucht nichts vom Server. */
export default function NeueRechnungSeite() {
  return (
    <>
      <h1>Rechnung schreiben</h1>
      <p className="buero-unterzeile">
        Preise netto eingeben. Die Nummer wird erst beim Festschreiben vergeben.
      </p>
      <RechnungFormular werte={{ issueDate: new Date().toISOString().slice(0, 10) }} />
    </>
  )
}
