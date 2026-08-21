'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useMemo } from 'react'

import { AngebotFormular } from '../../../../../components/office/AngebotFormular'
import { Vorgangsdateien } from '../../../../../components/office/Vorgangsdateien'
import { useAbgleich, useBestand, useDatensatz } from '../../../../../lib/buero/bestand'

/**
 * Ein Angebot zum Bearbeiten.
 *
 * Der Hinweis „daraus entstanden" war früher zwei zusätzliche Abfragen; jetzt
 * ist es ein Filter über Aufträge und Rechnungen, die ohnehin schon im Gerät
 * liegen.
 */

type Posten = {
  description?: string | null
  quantity?: number | null
  unit?: string | null
  unitPrice?: number | null
  vatRate?: number | null
  product?: unknown
}

type Angebot = {
  id: number | string
  quoteNumber?: string | null
  title?: string | null
  customerName?: string | null
  items?: Posten[] | null
  [feld: string]: unknown
}

type MitAngebot = { id: number | string; quote?: number | string | null } & Record<string, unknown>

export function AngebotAnsicht() {
  const { id } = useParams<{ id: string }>()
  const a = useDatensatz<Angebot>('angebote', id)
  const alleAuftraege = useBestand<MitAngebot>('auftraege')
  const alleRechnungen = useBestand<MitAngebot>('rechnungen')
  const { bereit } = useAbgleich()

  const gehoertDazu = (x: MitAngebot) => x.quote != null && String(x.quote) === String(id)
  const auftraege = useMemo(
    () => alleAuftraege.filter(gehoertDazu).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alleAuftraege, id],
  )
  const rechnungen = useMemo(
    () => alleRechnungen.filter(gehoertDazu).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alleRechnungen, id],
  )

  if (!a) {
    return (
      <>
        <h1>Angebot</h1>
        <div className="buero-leer">
          {bereit ? 'Dieses Angebot gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  return (
    <>
      <h1>{a.quoteNumber ?? 'Entwurf'}</h1>
      <p className="buero-unterzeile">{a.title || a.customerName || 'ohne Bezeichnung'}</p>

      {(auftraege.length > 0 || rechnungen.length > 0) && (
        <p className="buero-hinweis">
          Daraus entstanden:{' '}
          {auftraege.map((j) => (
            <Link
              key={j.id}
              href={`/office/auftraege/${j.id}`}
              style={{ textDecoration: 'underline' }}
            >
              {(j.jobNumber as string) ?? 'Auftrag'}{' '}
            </Link>
          ))}
          {rechnungen.map((r) => (
            <Link
              key={r.id}
              href={`/office/rechnungen/${r.id}`}
              style={{ textDecoration: 'underline' }}
            >
              {(r.invoiceNumber as string) ?? 'Rechnung'}{' '}
            </Link>
          ))}
        </p>
      )}

      <AngebotFormular
        werte={{
          id: a.id,
          quoteNumber: a.quoteNumber,
          status: a.status as string,
          title: a.title,
          customer:
            typeof a.customer === 'object'
              ? ((a.customer as { id?: number })?.id ?? '')
              : ((a.customer as number) ?? ''),
          inquiry:
            typeof a.inquiry === 'object'
              ? (a.inquiry as { id?: number })?.id
              : (a.inquiry as number),
          customerName: a.customerName,
          customerAddress: a.customerAddress as string,
          issueDate: a.issueDate as string,
          validUntil: a.validUntil as string,
          productionTime: a.productionTime as string,
          items: (a.items ?? []).map((p) => ({
            description: p.description ?? '',
            quantity: p.quantity ?? 1,
            unit: p.unit ?? 'Stück',
            unitPrice: p.unitPrice ?? 0,
            vatRate: p.vatRate ?? 0,
            product: (p.product as number) ?? '',
          })),
          note: a.note as string,
          discountKind: a.discountKind as string,
          discountValue: a.discountValue as number,
          discountReason: a.discountReason as string,
          revision: a.revision as number,
        }}
      />

      <Vorgangsdateien
        angebot={a.id}
        kontakt={
          typeof a.customer === 'object' ? (a.customer as { id?: number })?.id : (a.customer as number)
        }
      />
    </>
  )
}
