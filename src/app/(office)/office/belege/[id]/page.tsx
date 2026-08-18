import { notFound } from 'next/navigation'
import React from 'react'

import { AUSGABEN_KATEGORIEN } from '../../../../../collections/Expenses'
import { BelegFormular } from '../../../../../components/office/BelegFormular'
import { payloadClient } from '../../../../../lib/data'
import { kiZugang } from '../../../../../lib/ki'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function BelegBearbeiten({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const beleg = await payload
    .findByID({ collection: 'expenses', id, depth: 1, overrideAccess: true })
    .catch(() => null)
  if (!beleg) notFound()

  const ki = await kiZugang(payload)
  const dokument = typeof beleg.document === 'object' ? beleg.document : null

  return (
    <>
      <h1>{beleg.title || 'Beleg'}</h1>
      <p className="buero-unterzeile">Änderungen wirken sich auf den Steuer-Export aus.</p>
      <BelegFormular
        werte={{
          id: beleg.id,
          title: beleg.title,
          supplierName: beleg.supplierName,
          invoiceNumber: beleg.invoiceNumber,
          invoiceDate: beleg.invoiceDate,
          dueDate: beleg.dueDate,
          netAmount: beleg.netAmount,
          vatRate: beleg.vatRate,
          vatAmount: beleg.vatAmount,
          grossAmount: beleg.grossAmount,
          category: beleg.category,
          paymentMethod: beleg.paymentMethod,
          paid: beleg.paid ?? true,
          deductible: beleg.deductible ?? true,
          notes: beleg.notes,
          documentId: dokument?.id ?? (typeof beleg.document === 'number' ? beleg.document : null),
          documentUrl: dokument?.url ?? null,
          extraction: beleg.extraction,
        }}
        kategorien={[...AUSGABEN_KATEGORIEN]}
        kiVerfuegbar={Boolean(ki)}
      />
    </>
  )
}
