import { notFound } from 'next/navigation'
import React from 'react'

import { RechnungFormular } from '../../../../../components/office/RechnungFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function RechnungBearbeiten({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const r = await payload
    .findByID({ collection: 'outgoing-invoices', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!r) notFound()

  return (
    <>
      <h1>{r.invoiceNumber ?? 'Entwurf'}</h1>
      <p className="buero-unterzeile">{r.customerName ?? 'ohne Kunde'}</p>
      <RechnungFormular
        werte={{
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          status: r.status,
          customerName: r.customerName,
          customerAddress: r.customerAddress,
          issueDate: r.issueDate,
          dueDate: r.dueDate,
          paidDate: r.paidDate,
          items: (r.items ?? []).map((p) => ({
            description: p.description,
            quantity: p.quantity,
            unit: p.unit ?? 'Stück',
            unitPrice: p.unitPrice,
            vatRate: p.vatRate,
          })),
          reverseCharge: Boolean(r.reverseCharge),
          note: r.note,
        }}
      />
    </>
  )
}
