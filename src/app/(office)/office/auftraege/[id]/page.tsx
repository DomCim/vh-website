import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { AuftragFormular } from '../../../../../components/office/AuftragFormular'
import { payloadClient } from '../../../../../lib/data'
import { bestandsPruefung } from '../../../../../lib/material'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function AuftragBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const j = await payload
    .findByID({ collection: 'jobs', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!j) notFound()

  const [{ docs: posten }, bedarf] = await Promise.all([
    payload.find({
      collection: 'inventory-items',
      sort: 'name',
      limit: 300,
      depth: 0,
      overrideAccess: true,
    }),
    bestandsPruefung(payload, j.material ?? []),
  ])

  const fehlend = bedarf.filter((b) => b.fehlt > 0)
  const bestellId = typeof j.order === 'object' ? j.order?.id : j.order
  const angebotId = typeof j.quote === 'object' ? j.quote?.id : j.quote

  return (
    <>
      <h1>{j.jobNumber}</h1>
      <p className="buero-unterzeile">{j.title}</p>

      {(bestellId || angebotId) && (
        <p className="buero-unterzeile">
          {bestellId && (
            <Link href={`/admin/collections/orders/${bestellId}`} style={{ textDecoration: 'underline' }}>
              Zur Bestellung
            </Link>
          )}
          {bestellId && angebotId && ' · '}
          {angebotId && (
            <Link href={`/office/angebote/${angebotId}`} style={{ textDecoration: 'underline' }}>
              Zum Angebot
            </Link>
          )}
        </p>
      )}

      {fehlend.length > 0 && !j.materialGebucht && (
        <p className="buero-hinweis">
          Material fehlt:{' '}
          {fehlend.map((f) => `${f.name} — ${f.fehlt} ${f.einheit} nachbestellen`).join(', ')}
        </p>
      )}

      <AuftragFormular
        werte={{
          id: j.id,
          jobNumber: j.jobNumber,
          status: j.status,
          source: j.source,
          title: j.title,
          customerName: j.customerName,
          startDate: j.startDate,
          dueDate: j.dueDate,
          notes: j.notes,
          materialGebucht: Boolean(j.materialGebucht),
          positions: (j.positions ?? []).map((p) => ({
            description: p.description,
            quantity: p.quantity ?? 1,
            price: p.price,
          })),
          material: (j.material ?? []).map((m) => ({
            item: (typeof m.item === 'object' ? m.item?.id : m.item) as number,
            quantity: m.quantity,
          })),
        }}
        posten={posten.map((p) => ({
          id: p.id,
          name: p.name,
          unit: p.unit ?? '',
          quantity: p.quantity ?? 0,
        }))}
      />
    </>
  )
}
