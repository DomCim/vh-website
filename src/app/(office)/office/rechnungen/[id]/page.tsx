import { notFound } from 'next/navigation'
import React from 'react'

import { RechnungFormular } from '../../../../../components/office/RechnungFormular'
import { VersandKnopf } from '../../../../../components/office/VersandKnopf'
import { payloadClient } from '../../../../../lib/data'
import { bueroBenutzer } from '../../../../../lib/office'
import { MAHN_TITEL } from '../../../../../lib/mahnung'
import { firmenAngaben } from '../../../../../lib/settings'

export const dynamic = 'force-dynamic'

export default async function RechnungBearbeiten({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await bueroBenutzer()
  const { id } = await params
  const payload = await payloadClient()

  const r = await payload
    .findByID({ collection: 'outgoing-invoices', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!r) notFound()

  const angaben = firmenAngaben(await payload.findGlobal({ slug: 'site-settings', depth: 0 }))
  const mahnungen = r.reminders ?? []

  // Was der elektronischen Fassung noch fehlt. Lieber hier auffallen als beim
  // Empfänger, der die Rechnung kommentarlos abweist.
  const fehlt = [
    !angaben.siret && 'SIRET des eigenen Betriebs (Website-Einstellungen)',
    !angaben.vatId && 'eigene TVA-Nummer (Website-Einstellungen)',
    !angaben.iban && 'eigene IBAN (Website-Einstellungen)',
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
            <a className="buero-knopf schmal" href={`/api/office/rechnung/${r.id}/pdf`}>
              PDF ansehen
            </a>
            <a className="buero-knopf schmal" href={`/api/office/rechnung/${r.id}/xml`}>
              XML herunterladen
            </a>
            {r.status === 'gestellt' && <VersandKnopf art="mahnung" id={r.id} leise />}
          </div>

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
          status: r.status,
          customerName: r.customerName,
          customerAddress: r.customerAddress,
          customerSiret: r.customerSiret,
          customerVatId: r.customerVatId,
          deliveryAddress: r.deliveryAddress,
          deliveryDate: r.deliveryDate,
          businessType: r.businessType,
          buyerReference: r.buyerReference,
          issueDate: r.issueDate,
          dueDate: r.dueDate,
          paidDate: r.paidDate,
          items: (r.items ?? []).map((p) => ({
            description: p.description,
            quantity: p.quantity,
            unit: p.unit ?? 'Stück',
            unitPrice: p.unitPrice,
            vatRate: p.vatRate,
          })),
          reverseCharge: Boolean(r.reverseCharge),
          note: r.note,
        }}
      />
    </>
  )
}
