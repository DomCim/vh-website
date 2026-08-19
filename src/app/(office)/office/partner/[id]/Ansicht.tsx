'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { PartnerFormular } from '../../../../../components/office/PartnerFormular'
import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'
import { datum, euro } from '../../../../../lib/format'
import { AUSGABEN_KATEGORIEN } from '../../../../../lib/listen'

/**
 * Ein Partner samt seinen letzten Belegen.
 *
 * Die Zuordnung der Belege passiert hier im Gerät — früher war das eine
 * zweite Abfrage an die Datenbank, jetzt ein Filter über eine Liste, die
 * ohnehin schon dasteht.
 */

type Partner = { id: number | string; name?: string | null; [feld: string]: unknown }
type Beleg = {
  id: number | string
  supplier?: number | string | null
  title?: string | null
  invoiceNumber?: string | null
  invoiceDate?: string | null
  grossAmount?: number | null
}

export function PartnerBearbeitenAnsicht() {
  const { id } = useParams<{ id: string }>()
  const k = useDatensatz<Partner>('partner', id)
  const alleBelege = useBestand<Beleg>('belege')
  const { bereit } = useAbgleich()

  const belege = useMemo(
    () =>
      alleBelege
        .filter((b) => b.supplier !== null && String(b.supplier) === String(id))
        .sort((a, b) => (b.invoiceDate ?? '').localeCompare(a.invoiceDate ?? ''))
        .slice(0, 10),
    [alleBelege, id],
  )

  if (!k) {
    return (
      <>
        <h1>Geschäftspartner</h1>
        <div className="buero-leer">
          {bereit ? 'Diesen Partner gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  return (
    <>
      <h1>{k.name}</h1>
      <p className="buero-unterzeile">
        {[
          k.line1 as string,
          [k.postalCode, k.city].filter(Boolean).join(' '),
          k.country as string,
        ]
          .filter(Boolean)
          .join(', ') || 'ohne Anschrift'}
      </p>

      <PartnerFormular
        werte={{
          id: k.id,
          name: k.name as string,
          role: (k.role as string) ?? 'beides',
          email: k.email as string,
          phone: k.phone as string,
          line1: k.line1 as string,
          postalCode: k.postalCode as string,
          city: k.city as string,
          country: k.country as string,
          vatId: k.vatId as string,
          siret: k.siret as string,
          defaultCategory: k.defaultCategory as string,
          notes: k.notes as string,
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
