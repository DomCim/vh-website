'use client'

import { useParams } from 'next/navigation'
import React from 'react'

import { InventurFormular } from '../../../../../components/office/InventurFormular'
import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'
import type { Posten } from '../../../../../lib/buero/material'
import { datum } from '../../../../../lib/format'

/** Ein Inventurlauf — Namen und Einheiten kommen aus dem Inventar im Gerät. */

type Zeile = {
  item?: unknown
  expected?: number | null
  counted?: number | null
  unitValue?: number | null
  note?: string | null
}

type Inventur = {
  id: number | string
  title?: string | null
  date?: string | null
  status?: string | null
  notes?: string | null
  lines?: Zeile[] | null
}

export function InventurBearbeitenAnsicht() {
  const { id } = useParams<{ id: string }>()
  const s = useDatensatz<Inventur>('inventur', id)
  const inventar = useBestand<Posten>('inventar')
  const { bereit } = useAbgleich()

  if (!s) {
    return (
      <>
        <h1>Inventur</h1>
        <div className="buero-leer">
          {bereit ? 'Diesen Lauf gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  return (
    <>
      <h1>{s.title}</h1>
      <p className="buero-unterzeile">Stichtag {datum(s.date)}</p>
      <InventurFormular
        werte={{
          id: s.id,
          title: s.title ?? '',
          date: s.date ?? '',
          status: s.status ?? 'offen',
          notes: s.notes,
          lines: (s.lines ?? []).map((z) => {
            const itemId = Number(
              typeof z.item === 'object' ? (z.item as { id?: number })?.id : z.item,
            )
            const p = inventar.find((x) => Number(x.id) === itemId)
            return {
              item: itemId,
              name: p?.name ?? `Posten ${itemId}`,
              einheit: p?.unit ?? '',
              expected: z.expected ?? 0,
              counted: z.counted ?? 0,
              unitValue: z.unitValue ?? 0,
              note: z.note,
            }
          }),
        }}
      />
    </>
  )
}
