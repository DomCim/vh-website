'use client'

import React, { useMemo } from 'react'

import { AuftragFormular } from '../../../../../components/office/AuftragFormular'
import { useBestand } from '../../../../../lib/buero/bestand'
import type { Posten } from '../../../../../lib/buero/material'

/** Neuer Auftrag — die Inventarposten kommen aus dem Bestand im Gerät. */
export default function NeuerAuftragSeite() {
  const inventar = useBestand<Posten>('inventar')
  const posten = useMemo(
    () =>
      [...inventar]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((p) => ({
          id: Number(p.id),
          name: p.name ?? '',
          unit: p.unit ?? '',
          quantity: p.quantity ?? 0,
        })),
    [inventar],
  )

  return (
    <>
      <h1>Neuer Auftrag</h1>
      <p className="buero-unterzeile">Für alles, was nicht aus dem Shop oder einem Angebot kommt.</p>
      <AuftragFormular werte={{}} posten={posten} />
    </>
  )
}
