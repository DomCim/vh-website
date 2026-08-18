import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { InventarFormular } from '../../../../../components/office/InventarFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function PostenBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const i = await payload
    .findByID({ collection: 'inventory-items', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!i) notFound()

  const [{ docs: lieferanten }, { docs: verwendet }] = await Promise.all([
    payload.find({
      collection: 'contacts',
      sort: 'name',
      limit: 300,
      depth: 0,
      overrideAccess: true,
    }),
    // Wo dieser Posten in einer Stückliste steht — nützlich, bevor man ihn ändert
    payload.find({
      collection: 'products',
      where: { 'billOfMaterials.item': { equals: i.id } },
      limit: 20,
      depth: 0,
      locale: 'de',
      overrideAccess: true,
    }),
  ])

  return (
    <>
      <h1>{i.name}</h1>
      <p className="buero-unterzeile">
        Bestand {i.quantity ?? 0} {i.unit ?? ''}
        {i.location ? ` · ${i.location}` : ''}
      </p>

      {verwendet.length > 0 && (
        <p className="buero-unterzeile">
          Gebraucht für:{' '}
          {verwendet.map((p, idx) => (
            <React.Fragment key={p.id}>
              {idx > 0 && ', '}
              <Link href={`/office/artikel/${p.id}`} style={{ textDecoration: 'underline' }}>
                {p.title}
              </Link>
            </React.Fragment>
          ))}
        </p>
      )}

      <InventarFormular
        werte={{
          id: i.id,
          name: i.name,
          type: i.type,
          quantity: i.quantity,
          unit: i.unit,
          minQuantity: i.minQuantity,
          unitValue: i.unitValue,
          location: i.location,
          purchaseDate: i.purchaseDate,
          purchaseValue: i.purchaseValue,
          supplier: (typeof i.supplier === 'object' ? i.supplier?.id : i.supplier) as number,
          notes: i.notes,
        }}
        lieferanten={lieferanten.map((l) => ({ id: l.id, name: l.name }))}
      />
    </>
  )
}
