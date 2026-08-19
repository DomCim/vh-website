'use client'

import { useSearchParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { WareneingangFormular } from '../../../../../components/office/WareneingangFormular'
import { useBestand } from '../../../../../lib/buero/bestand'
import { bestellmenge, lieferantenId, type Lagerposten } from '../../../../../lib/nachbestellung'

/**
 * Eine Lieferung buchen.
 *
 * Kommt man von der Nachbestellliste (`?lieferant=7`), sind Lieferant und die
 * erwarteten Posten schon eingetragen — das ist der Regelfall: Bestellt wurde
 * dort, geliefert wird das, was bestellt war.
 */

type Partner = { id: number | string; name?: string | null }

export function WareneingangNeuAnsicht() {
  const suche = useSearchParams()
  const inventar = useBestand<Lagerposten>('inventar')
  const partner = useBestand<Partner>('partner')

  const lieferant = Number(suche.get('lieferant')) || undefined

  const posten = useMemo(
    () =>
      [...inventar]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((p) => ({ id: Number(p.id), name: p.name ?? '', unit: p.unit ?? '' })),
    [inventar],
  )

  const lieferanten = useMemo(
    () =>
      [...partner]
        .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'de'))
        .map((p) => ({ id: Number(p.id), name: p.name ?? '' })),
    [partner],
  )

  // Vorbelegen mit dem, was bei diesem Lieferanten als bestellt vermerkt ist
  const vorbelegung = useMemo(() => {
    if (!lieferant) return undefined
    const erwartet = inventar.filter(
      (p) => p.reorderedAt && Number(lieferantenId(p.supplier)) === lieferant,
    )
    return {
      supplier: lieferant,
      lines: erwartet.map((p) => ({
        item: Number(p.id),
        quantity: bestellmenge(p),
      })),
    }
  }, [inventar, lieferant])

  return (
    <>
      <h1>Lieferung buchen</h1>
      <p className="buero-unterzeile">
        {vorbelegung?.lines?.length
          ? 'Vorbelegt mit dem, was bei diesem Lieferanten als bestellt vermerkt ist — Mengen prüfen und buchen.'
          : 'Posten, Menge, Lieferschein. Der Bestand wird beim Buchen erhöht.'}
      </p>

      <WareneingangFormular
        posten={posten}
        lieferanten={lieferanten}
        vorbelegung={vorbelegung}
      />
    </>
  )
}
