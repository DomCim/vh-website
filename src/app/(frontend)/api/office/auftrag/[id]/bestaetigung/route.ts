import { payloadClient } from '../../../../../../../lib/data'
import { rechnungPdf } from '../../../../../../../lib/invoice'
import { firmenAngaben } from '../../../../../../../lib/settings'

export const dynamic = 'force-dynamic'

/**
 * Auftragsbestätigung als PDF.
 *
 * Das Gegenstück zur Bestellung des Kunden: Er bestellt auf Grundlage des
 * Angebots, hier bestätigt Vincent, was er zu welchem Preis und bis wann
 * baut. Preise kommen aus dem Angebot, wenn es eines gibt — sonst aus den
 * Positionen des Auftrags.
 *
 * Das Erzeugen setzt das Bestätigungsdatum; danach ist belegt, wann zugesagt
 * wurde.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const payload = await payloadClient()
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user as { role?: string }).role !== 'inhaber') {
    return new Response('Nicht erlaubt', { status: 403 })
  }

  const { id } = await params
  const auftrag = await payload
    .findByID({ collection: 'jobs', id, depth: 0, overrideAccess: true })
    .catch(() => null)
  if (!auftrag) return new Response('Nicht gefunden', { status: 404 })

  const angebotId = typeof auftrag.quote === 'object' ? auftrag.quote?.id : auftrag.quote
  const angebot = angebotId
    ? await payload
        .findByID({ collection: 'quotes', id: angebotId, depth: 0, overrideAccess: true })
        .catch(() => null)
    : null

  const positionen = angebot?.items?.length
    ? angebot.items.map((p) => ({
        bezeichnung: p.description,
        zusatz: p.unit && p.unit !== 'Stück' ? p.unit : null,
        menge: p.quantity,
        einzelpreis: p.unitPrice,
        steuersatz: p.vatRate,
      }))
    : (auftrag.positions ?? []).map((p) => ({
        bezeichnung: p.description,
        zusatz: null,
        menge: p.quantity ?? 1,
        einzelpreis: p.price ?? 0,
        steuersatz: 20,
      }))

  const bezug = [
    angebot?.quoteNumber ? `Unser Angebot ${angebot.quoteNumber}` : null,
    auftrag.customerOrderRef ? `Ihre Bestellung ${auftrag.customerOrderRef}` : null,
    auftrag.orderedAt
      ? `vom ${new Date(auftrag.orderedAt).toLocaleDateString('de-DE')}`
      : null,
    auftrag.dueDate
      ? `Voraussichtlich fertig: ${new Date(auftrag.dueDate).toLocaleDateString('de-DE')}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  const pdf = await rechnungPdf(
    {
      art: 'angebot',
      nummer: `Auftragsbestätigung ${auftrag.jobNumber}`,
      datum: new Date().toISOString(),
      fertigungszeit: angebot?.productionTime,
      preiseSind: 'netto',
      empfaenger: {
        name: auftrag.customerName,
        anschrift: (angebot?.customerAddress ?? '').split('\n').filter(Boolean),
      },
      positionen,
      rabatt: angebot?.discountTotal
        ? { bezeichnung: angebot.discountReason || 'Nachlass', betrag: angebot.discountTotal }
        : null,
      hinweis: [bezug, auftrag.notes].filter(Boolean).join('\n'),
    },
    firmenAngaben(settings),
  )

  // Erst nach erfolgreichem Erzeugen festhalten
  if (!auftrag.confirmedAt) {
    await payload
      .update({
        collection: 'jobs',
        id: auftrag.id,
        overrideAccess: true,
        data: { confirmedAt: new Date().toISOString() },
      })
      .catch(() => undefined)
  }

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Auftragsbestaetigung-${auftrag.jobNumber}.pdf"`,
    },
  })
}
