import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { AngebotFormular } from '../../../../../components/office/AngebotFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function AngebotBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const a = await payload
    .findByID({ collection: 'quotes', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!a) notFound()

  // Was aus dem Angebot schon geworden ist — damit nichts doppelt entsteht
  const [{ docs: auftraege }, { docs: rechnungen }] = await Promise.all([
    payload.find({
      collection: 'jobs',
      where: { quote: { equals: a.id } },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'outgoing-invoices',
      where: { quote: { equals: a.id } },
      limit: 5,
      depth: 0,
      overrideAccess: true,
    }),
  ])

  return (
    <>
      <h1>{a.quoteNumber ?? 'Entwurf'}</h1>
      <p className="buero-unterzeile">{a.title || a.customerName || 'ohne Bezeichnung'}</p>

      {(auftraege.length > 0 || rechnungen.length > 0) && (
        <p className="buero-hinweis">
          Daraus entstanden:{' '}
          {auftraege.map((j) => (
            <Link key={j.id} href={`/office/auftraege/${j.id}`} style={{ textDecoration: 'underline' }}>
              {j.jobNumber ?? 'Auftrag'}{' '}
            </Link>
          ))}
          {rechnungen.map((r) => (
            <Link
              key={r.id}
              href={`/office/rechnungen/${r.id}`}
              style={{ textDecoration: 'underline' }}
            >
              {r.invoiceNumber ?? 'Rechnung'}{' '}
            </Link>
          ))}
        </p>
      )}

      <AngebotFormular
        werte={{
          id: a.id,
          quoteNumber: a.quoteNumber,
          status: a.status,
          title: a.title,
          customerName: a.customerName,
          customerAddress: a.customerAddress,
          issueDate: a.issueDate,
          validUntil: a.validUntil,
          productionTime: a.productionTime,
          items: (a.items ?? []).map((p) => ({
            description: p.description,
            quantity: p.quantity,
            unit: p.unit ?? 'Stück',
            unitPrice: p.unitPrice,
            vatRate: p.vatRate,
          })),
          note: a.note,
        }}
      />
    </>
  )
}
