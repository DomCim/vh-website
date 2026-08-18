import Link from 'next/link'
import { notFound } from 'next/navigation'
import React from 'react'

import { ArtikelFormular } from '../../../../../components/office/ArtikelFormular'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'

export const dynamic = 'force-dynamic'

export default async function ArtikelBearbeiten({ params }: { params: Promise<{ id: string }> }) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const p = await payload
    .findByID({ collection: 'products', id, depth: 0, locale: 'de', overrideAccess: true })
    .catch(() => null)
  if (!p) notFound()

  const [{ docs: posten }, { docs: partner }, einstellungen] = await Promise.all([
    payload.find({
      collection: 'inventory-items',
      sort: 'name',
      limit: 300,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'contacts',
      sort: 'name',
      limit: 300,
      depth: 0,
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'site-settings', depth: 0 }),
  ])

  return (
    <>
      <h1>{p.title}</h1>
      <p className="buero-unterzeile">
        {typeof p.price === 'number' ? `Website-Preis ${p.price} €` : 'ohne Preis'} ·{' '}
        <Link href={`/admin/collections/products/${p.id}`} style={{ textDecoration: 'underline' }}>
          Artikel in der Website-Verwaltung
        </Link>
      </p>

      <ArtikelFormular
        produktId={p.id as number}
        verkaufspreis={p.price}
        stueckliste={(p.billOfMaterials ?? []).map((z) => ({
          item: (typeof z.item === 'object' ? z.item?.id : z.item) as number,
          quantity: z.quantity,
          note: z.note,
        }))}
        dienstleister={(p.serviceProviders ?? []).map((d) => ({
          contact: (typeof d.contact === 'object' ? d.contact?.id : d.contact) as number,
          service: d.service,
          cost: d.cost,
          leadTime: d.leadTime,
          note: d.note,
        }))}
        posten={posten.map((x) => ({
          id: x.id,
          name: x.name,
          unit: x.unit ?? '',
          unitValue: x.unitValue ?? 0,
        }))}
        partner={partner.map((x) => ({ id: x.id, name: x.name }))}
        arbeitsminuten={p.productionMinutes}
        stundensatz={einstellungen?.craft?.hourlyRate ?? 65}
        wunschaufschlag={einstellungen?.craft?.targetMargin ?? 40}
      />
    </>
  )
}
