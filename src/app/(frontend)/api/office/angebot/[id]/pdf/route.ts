import { payloadClient } from '../../../../../../../lib/data'
import { rechnungPdf } from '../../../../../../../lib/invoice'
import { firmenAngaben } from '../../../../../../../lib/settings'

export const dynamic = 'force-dynamic'

/** Angebot als PDF — erst ab „Versendet", vorher gibt es keine Nummer. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  const a = await payload
    .findByID({ collection: 'quotes', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!a) return new Response('Nicht gefunden', { status: 404 })
  if (!a.quoteNumber) {
    return new Response('Dieses Angebot ist noch ein Entwurf und hat keine Nummer.', { status: 409 })
  }

  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  const pdf = await rechnungPdf(
    {
      art: 'angebot',
      nummer: a.quoteNumber,
      datum: a.issueDate,
      gueltigBis: a.validUntil,
      fertigungszeit: a.productionTime,
      preiseSind: 'netto',
      empfaenger: {
        name: a.customerName,
        anschrift: (a.customerAddress ?? '').split('\n').filter(Boolean),
      },
      positionen: (a.items ?? []).map((p) => ({
        bezeichnung: p.description,
        zusatz: p.unit && p.unit !== 'Stück' ? p.unit : null,
        menge: p.quantity,
        einzelpreis: p.unitPrice,
        steuersatz: p.vatRate,
      })),
      hinweis: a.note,
    },
    firmenAngaben(settings),
  )

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${a.quoteNumber}.pdf"`,
    },
  })
}
