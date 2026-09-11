'use client'

import { useSearchParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { WareneingangFormular } from '../../../../../components/office/WareneingangFormular'
import { useBestand } from '../../../../../lib/buero/bestand'
import {
  lieferantenId,
  OFFENE_STAENDE,
  type Lagerposten,
  type Lieferantenbestellung,
} from '../../../../../lib/nachbestellung'

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
  const bestellungen = useBestand<Lieferantenbestellung>('lieferantenbestellungen')

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

  /*
   * Vorbelegt mit dem, was bei diesem Lieferanten offen ist — aus der
   * Bestellung, nicht neu gerechnet.
   *
   * Vorher stand hier `bestellmenge(p)`: die Menge, die sich aus
   * Mindestbestand und Gebinde *ergäbe*. Wer beim Bestellen 3 auf 5 geändert
   * hatte, bekam trotzdem 3 vorgeschlagen — die 5 war nirgends gespeichert.
   * Jetzt steht sie an der Bestellzeile, und hier steht, was davon noch
   * aussteht.
   */
  const vorbelegung = useMemo(() => {
    if (!lieferant) return undefined
    const offen = bestellungen.filter(
      (b) =>
        OFFENE_STAENDE.includes((b.status ?? '') as 'bestellt') &&
        Number(lieferantenId(b.supplier)) === lieferant,
    )
    const zeilen = new Map<number, number>()
    for (const b of offen) {
      for (const z of b.lines ?? []) {
        const id = Number(lieferantenId(z.item))
        const fehlt = Math.max((z.quantity ?? 0) - (z.deliveredQuantity ?? 0), 0)
        if (!id || fehlt <= 0) continue
        zeilen.set(id, (zeilen.get(id) ?? 0) + fehlt)
      }
    }
    return {
      supplier: lieferant,
      lines: [...zeilen.entries()].map(([item, quantity]) => ({ item, quantity })),
    }
  }, [bestellungen, lieferant])

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
