'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React from 'react'

import { RechnungFormular } from '../../../../../components/office/RechnungFormular'
import { StornoKnopf } from '../../../../../components/office/StornoKnopf'
import { VersandKnopf } from '../../../../../components/office/VersandKnopf'
import { useAbgleich, useDatensatz, useRahmen } from '../../../../../lib/buero/bestand'
import { MAHN_TITEL } from '../../../../../lib/listen'

/**
 * Eine Rechnung zum Bearbeiten.
 *
 * Die Liste dessen, was der elektronischen Fassung noch fehlt, entsteht hier —
 * lieber an dieser Stelle auffallen als beim Empfänger, der die Rechnung sonst
 * kommentarlos abweist. Die eigenen Angaben dazu kommen aus dem Rahmen, den
 * der Abgleich mitliefert.
 */

type Posten = {
  description?: string | null
  quantity?: number | null
  unit?: string | null
  unitPrice?: number | null
  vatRate?: number | null
}

type Mahnung = { level?: number | null; sentAt?: string | null }

type Rechnung = {
  id: number | string
  invoiceNumber?: string | null
  customerName?: string | null
  items?: Posten[] | null
  reminders?: Mahnung[] | null
  [feld: string]: unknown
}

export function RechnungAnsicht() {
  const { id } = useParams<{ id: string }>()
  const r = useDatensatz<Rechnung>('rechnungen', id)
  const { firma } = useRahmen()
  const { bereit } = useAbgleich()

  if (!r) {
    return (
      <>
        <h1>Rechnung</h1>
        <div className="buero-leer">
          {bereit ? 'Diese Rechnung gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  const mahnungen = r.reminders ?? []

  // Beide Richtungen des Storno-Paares: Was hebt diese Rechnung auf, und
  // gilt sie überhaupt noch?
  const kennung = (wert: unknown) =>
    typeof wert === 'object' && wert ? String((wert as { id?: number }).id ?? '') : wert ? String(wert) : ''
  const stornoVon = kennung(r.stornoVon)
  const storniertDurch = kennung(r.storniertDurch)
  const istStorno = Boolean(stornoVon)
  const stornierbar = Boolean(r.invoiceNumber) && !istStorno && !storniertDurch && r.status !== 'storniert'

  const fehlt = [
    !firma.siret && 'SIRET des eigenen Betriebs (Einstellungen)',
    !firma.vatId && 'eigene TVA-Nummer (Einstellungen)',
    !firma.iban && 'eigene IBAN (Einstellungen)',
    !r.customerSiret && 'SIRET/SIREN des Kunden — bei Geschäftskunden Pflicht',
    !r.customerAddress && 'Rechnungsanschrift',
  ].filter(Boolean) as string[]

  return (
    <>
      <h1>{r.invoiceNumber ?? 'Entwurf'}</h1>
      <p className="buero-unterzeile">{r.customerName ?? 'ohne Kunde'}</p>

      {r.invoiceNumber && (
        <>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', margin: '.6rem 0 1rem' }}>
            <a className="buero-knopf leise schmal" href={`/api/office/rechnung/${r.id}/pdf`}>
              PDF ansehen
            </a>
            <a className="buero-knopf leise schmal" href={`/api/office/rechnung/${r.id}/xml`}>
              XML herunterladen
            </a>
            {r.status === 'gestellt' && <VersandKnopf art="mahnung" id={r.id} leise />}
            {stornierbar && <StornoKnopf id={r.id} nummer={r.invoiceNumber!} />}
          </div>

          {istStorno && (
            <div className="buero-hinweis">
              <strong>Das ist eine Stornorechnung.</strong> Sie hebt eine andere Rechnung auf und
              fordert nichts —{' '}
              <Link href={`/office/rechnungen/${stornoVon}`} style={{ textDecoration: 'underline' }}>
                zur stornierten Rechnung
              </Link>
              .
            </div>
          )}
          {storniertDurch && (
            <div className="buero-hinweis warn">
              <strong>Diese Rechnung ist storniert</strong>
              {r.stornoGrund ? ` — ${String(r.stornoGrund)}` : ''}. Sie gilt nicht mehr;{' '}
              <Link
                href={`/office/rechnungen/${storniertDurch}`}
                style={{ textDecoration: 'underline' }}
              >
                zur Stornorechnung
              </Link>
              .
            </div>
          )}

          {mahnungen.length > 0 && (
            <p className="buero-unterzeile" style={{ marginTop: '-.6rem' }}>
              Bereits verschickt:{' '}
              {mahnungen
                .map(
                  (m) =>
                    `${MAHN_TITEL[(m.level ?? 1) as 1 | 2 | 3]} am ${new Date(
                      m.sentAt ?? '',
                    ).toLocaleDateString('de-DE')}`,
                )
                .join(' · ')}
            </p>
          )}
          {fehlt.length > 0 && (
            <div className="buero-hinweis warn">
              <strong>Für die elektronische Rechnung fehlt noch:</strong> {fehlt.join(' · ')}. Das
              PDF entsteht trotzdem — eine Plattform würde es aber zurückweisen.
            </div>
          )}
        </>
      )}
      <RechnungFormular
        werte={{
          id: r.id,
          invoiceNumber: r.invoiceNumber,
          status: r.status as string,
          customerName: r.customerName,
          customerAddress: r.customerAddress as string,
          customerSiret: r.customerSiret as string,
          customerVatId: r.customerVatId as string,
          deliveryAddress: r.deliveryAddress as string,
          deliveryDate: r.deliveryDate as string,
          businessType: r.businessType as string,
          buyerReference: r.buyerReference as string,
          issueDate: r.issueDate as string,
          dueDate: r.dueDate as string,
          paidDate: r.paidDate as string,
          items: (r.items ?? []).map((p) => ({
            description: p.description ?? '',
            quantity: p.quantity ?? 1,
            unit: p.unit ?? 'Stück',
            unitPrice: p.unitPrice ?? 0,
            vatRate: p.vatRate ?? 0,
          })),
          reverseCharge: Boolean(r.reverseCharge),
          note: r.note as string,
        }}
      />
    </>
  )
}
