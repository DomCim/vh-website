import { payloadClient } from '../../../../../../../lib/data'
import { rechnungPdf } from '../../../../../../../lib/invoice'
import { firmenAngaben } from '../../../../../../../lib/settings'

export const dynamic = 'force-dynamic'

/** Ausgangsrechnung als PDF — nur für festgeschriebene Rechnungen. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  const rechnung = await payload
    .findByID({ collection: 'outgoing-invoices', id, depth: 1, overrideAccess: true })
    .catch(() => null)
  if (!rechnung) return new Response('Nicht gefunden', { status: 404 })
  if (!rechnung.invoiceNumber) {
    return new Response('Diese Rechnung ist noch ein Entwurf und hat keine Nummer.', { status: 409 })
  }

  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  const pdf = await rechnungPdf(
    {
      nummer: rechnung.invoiceNumber,
      datum: rechnung.issueDate,
      faelligAm: rechnung.dueDate,
      preiseSind: 'netto',
      empfaenger: {
        name: rechnung.customerName,
        anschrift: (rechnung.customerAddress ?? '').split('\n').filter(Boolean),
      },
      positionen: (rechnung.items ?? []).map((p) => ({
        bezeichnung: p.description,
        zusatz: p.unit && p.unit !== 'Stück' ? p.unit : null,
        menge: p.quantity,
        einzelpreis: p.unitPrice,
        steuersatz: p.vatRate,
      })),
      hinweis: rechnung.note,
      reverseCharge: Boolean(rechnung.reverseCharge),
    },
    firmenAngaben(settings),
  )

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${rechnung.invoiceNumber}.pdf"`,
    },
  })
}
