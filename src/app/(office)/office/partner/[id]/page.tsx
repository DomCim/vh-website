import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { PartnerFormular } from '../../../../../components/office/PartnerFormular'
import { AUSGABEN_KATEGORIEN } from '../../../../../collections/Expenses'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer, datum, euro } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function PartnerBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const k = await payload
    .findByID({ collection: 'contacts', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!k) notFound()

  const { docs: belege } = await payload.find({
    collection: 'expenses',
    where: { supplier: { equals: k.id } },
    sort: '-invoiceDate',
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })

  return (
    <>
      <h1>{k.name}</h1>
      <p className="buero-unterzeile">
        {[k.line1, [k.postalCode, k.city].filter(Boolean).join(' '), k.country]
          .filter(Boolean)
          .join(', ') || 'ohne Anschrift'}
      </p>

      <PartnerFormular
        werte={{
          id: k.id,
          name: k.name,
          role: k.role ?? 'beides',
          email: k.email,
          phone: k.phone,
          line1: k.line1,
          postalCode: k.postalCode,
          city: k.city,
          country: k.country,
          vatId: k.vatId,
          siret: k.siret,
          defaultCategory: k.defaultCategory,
          notes: k.notes,
        }}
        kategorien={AUSGABEN_KATEGORIEN.map((x) => ({ wert: x.value, text: x.label }))}
      />

      {belege.length > 0 && (
        <>
          <h2>Letzte Belege</h2>
          <div className="buero-liste">
            {belege.map((b) => (
              <Link key={b.id} href={`/office/belege/${b.id}`} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{b.title ?? b.invoiceNumber ?? 'Beleg'}</div>
                  <div className="buero-zeile-neben">{datum(b.invoiceDate)}</div>
                </div>
                <span className="buero-betrag">{euro(b.grossAmount)}</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
