'use client'

import React, { useMemo } from 'react'

import { InventarFormular } from '../../../../../components/office/InventarFormular'
import { useBestand } from '../../../../../lib/buero/bestand'

/** Neuer Posten — die Lieferantenliste kommt aus dem Bestand im Gerät. */
type Partner = { id: number | string; name?: string | null }

export default function NeuerPostenSeite() {
  const partner = useBestand<Partner>('partner')
  const lieferanten = useMemo(
    () =>
      [...partner]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((l) => ({ id: Number(l.id), name: l.name ?? '' })),
    [partner],
  )

  return (
    <>
      <h1>Neuer Posten</h1>
      <p className="buero-unterzeile">Material, Werkzeug oder Maschine — alles, was im Haus ist.</p>
      <InventarFormular werte={{}} lieferanten={lieferanten} />
    </>
  )
}
