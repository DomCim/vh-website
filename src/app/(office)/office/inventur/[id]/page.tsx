import { notFound } from 'next/navigation'
import React from 'react'

import { InventurFormular } from '../../../../../components/office/InventurFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer, datum } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function InventurBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const s = await payload
    .findByID({ collection: 'stocktakes', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!s) notFound()

  // Namen und Einheiten dazuholen — in der Inventur stehen nur die Verweise
  const ids = (s.lines ?? [])
    .map((z) => (typeof z.item === 'object' ? z.item?.id : z.item))
    .filter((x): x is number => typeof x === 'number')

  const { docs: posten } = ids.length
    ? await payload.find({
        collection: 'inventory-items',
        where: { id: { in: ids } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] }

  return (
    <>
      <h1>{s.title}</h1>
      <p className="buero-unterzeile">Stichtag {datum(s.date)}</p>
      <InventurFormular
        werte={{
          id: s.id,
          title: s.title,
          date: s.date,
          status: s.status,
          notes: s.notes,
          lines: (s.lines ?? []).map((z) => {
            const itemId = (typeof z.item === 'object' ? z.item?.id : z.item) as number
            const p = posten.find((x) => x.id === itemId)
            return {
              item: itemId,
              name: p?.name ?? `Posten ${itemId}`,
              einheit: p?.unit ?? '',
              expected: z.expected,
              counted: z.counted ?? 0,
              unitValue: z.unitValue,
              note: z.note,
            }
          }),
        }}
      />
    </>
  )
}
