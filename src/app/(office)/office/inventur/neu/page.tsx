'use client'

import React, { useMemo } from 'react'

import { InventurFormular } from '../../../../../components/office/InventurFormular'
import { useBestand } from '../../../../../lib/buero/bestand'
import type { Posten } from '../../../../../lib/buero/material'

/**
 * Neue Inventur — die Zählliste entsteht aus dem Inventar im Gerät.
 *
 * Das ist genau der Fall, für den sich die Umstellung lohnt: Inventur macht
 * man im Lager, und dort ist das Netz am schlechtesten.
 */
export default function NeueInventurSeite() {
  const inventar = useBestand<Posten>('inventar')
  const heute = new Date()

  const zeilen = useMemo(
    () =>
      [...inventar]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((i) => ({
          item: Number(i.id),
          name: i.name ?? '',
          einheit: i.unit ?? '',
          expected: i.quantity ?? 0,
          counted: i.quantity ?? 0,
          unitValue: i.unitValue ?? 0,
        })),
    [inventar],
  )

  return (
    <>
      <h1>Neue Inventur</h1>
      <p className="buero-unterzeile">
        Die Zählliste steht schon: alle Posten mit ihrem Soll-Bestand. Eintragen, was wirklich da
        ist — der Rest ergibt sich.
      </p>
      <InventurFormular
        werte={{
          title: `Inventur ${heute.getFullYear()}`,
          date: heute.toISOString().slice(0, 10),
          status: 'offen',
          lines: zeilen,
        }}
      />
    </>
  )
}
