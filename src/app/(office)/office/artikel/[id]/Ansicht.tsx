'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { ArtikelFormular } from '../../../../../components/office/ArtikelFormular'
import { useAbgleich, useBestand, useDatensatz, useRahmen } from '../../../../../lib/buero/bestand'

/** Ein Artikel mit Stückliste, Dienstleistern und Kalkulation. */

type Artikel = {
  id: number | string
  title?: string | null
  price?: number | null
  productionMinutes?: number | null
  billOfMaterials?: { item?: unknown; quantity?: number | null; note?: string | null }[] | null
  serviceProviders?:
    | {
        contact?: unknown
        service?: string | null
        cost?: number | null
        leadTime?: string | null
        note?: string | null
      }[]
    | null
}

type Posten = {
  id: number | string
  name?: string | null
  unit?: string | null
  unitValue?: number | null
}
type Partner = { id: number | string; name?: string | null }

const kennung = (wert: unknown) =>
  Number(typeof wert === 'object' ? (wert as { id?: number })?.id : wert)

export function ArtikelBearbeitenAnsicht() {
  const { id } = useParams<{ id: string }>()
  const p = useDatensatz<Artikel>('artikel', id)
  const inventar = useBestand<Posten>('inventar')
  const kontakte = useBestand<Partner>('partner')
  const { stundensatz, wunschaufschlag } = useRahmen()
  const { bereit } = useAbgleich()

  const posten = useMemo(
    () =>
      [...inventar]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((x) => ({
          id: Number(x.id),
          name: x.name ?? '',
          unit: x.unit ?? '',
          unitValue: x.unitValue ?? 0,
        })),
    [inventar],
  )

  const partner = useMemo(
    () =>
      [...kontakte]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((x) => ({ id: Number(x.id), name: x.name ?? '' })),
    [kontakte],
  )

  if (!p) {
    return (
      <>
        <h1>Artikel</h1>
        <div className="buero-leer">
          {bereit ? 'Diesen Artikel gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

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
        produktId={Number(p.id)}
        verkaufspreis={p.price}
        stueckliste={(p.billOfMaterials ?? []).map((z) => ({
          item: kennung(z.item),
          quantity: z.quantity ?? 0,
          note: z.note,
        }))}
        dienstleister={(p.serviceProviders ?? []).map((d) => ({
          contact: kennung(d.contact),
          service: d.service ?? '',
          cost: d.cost,
          leadTime: d.leadTime,
          note: d.note,
        }))}
        posten={posten}
        partner={partner}
        arbeitsminuten={p.productionMinutes}
        stundensatz={stundensatz}
        wunschaufschlag={wunschaufschlag}
      />
    </>
  )
}
