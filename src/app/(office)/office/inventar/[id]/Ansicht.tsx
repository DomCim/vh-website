'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { Bestandskorrektur, type Bewegung } from '../../../../../components/office/Bestandskorrektur'
import { InventarFormular } from '../../../../../components/office/InventarFormular'
import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'

/**
 * Ein Inventarposten.
 *
 * „Gebraucht für" durchsucht die Stücklisten der Artikel — im Gerät, ohne
 * Anfrage. Nützlich, bevor man einen Posten ändert oder wegwirft.
 */

type Posten = { id: number | string; name?: string | null; [feld: string]: unknown }
type Artikel = {
  id: number | string
  title?: string | null
  billOfMaterials?: { item?: unknown }[] | null
  variants?: { billOfMaterials?: { item?: unknown }[] | null }[] | null
}

export function PostenAnsicht() {
  const { id } = useParams<{ id: string }>()
  const i = useDatensatz<Posten>('inventar', id)
  const artikel = useBestand<Artikel>('artikel')
  const { bereit } = useAbgleich()

  const verwendet = useMemo(() => {
    const trifft = (zeilen: { item?: unknown }[] | null | undefined) =>
      (zeilen ?? []).some((z) => {
        const zeilenId = typeof z.item === 'object' ? (z.item as { id?: number })?.id : z.item
        return String(zeilenId) === String(id)
      })
    // Auch die Listen der Varianten: Ein Posten, der nur in der großen Größe
    // steckt, wäre sonst scheinbar nirgends gebraucht.
    return artikel
      .filter((p) => trifft(p.billOfMaterials) || (p.variants ?? []).some((v) => trifft(v.billOfMaterials)))
      .slice(0, 20)
  }, [artikel, id])

  if (!i) {
    return (
      <>
        <h1>Inventar</h1>
        <div className="buero-leer">
          {bereit ? 'Diesen Posten gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  return (
    <>
      <h1>{i.name}</h1>
      <p className="buero-unterzeile">
        Bestand {(i.quantity as number) ?? 0} {(i.unit as string) ?? ''}
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
          type: i.type as string,
          quantity: i.quantity as number,
          unit: i.unit as string,
          minQuantity: i.minQuantity as number,
          orderQuantity: i.orderQuantity as number,
          supplierRef: i.supplierRef as string,
          unitValue: i.unitValue as number,
          location: i.location as string,
          purchaseDate: i.purchaseDate as string,
          purchaseValue: i.purchaseValue as number,
          // Eine vorläufige Kennung bleibt stehen: Der Posten kann ohne Netz
          // angelegt worden sein und auf einen Lieferanten zeigen, den der
          // Server noch nicht kennt.
          supplier:
            typeof i.supplier === 'string' && i.supplier.startsWith('neu:')
              ? i.supplier
              : Number(i.supplier) || undefined,
          notes: i.notes as string,
        }}
      />

      <Bestandskorrektur
        postenId={i.id}
        bestand={(i.quantity as number) ?? 0}
        einheit={(i.unit as string) ?? ''}
        verlauf={(i.movements as Bewegung[]) ?? []}
      />
    </>
  )
}
