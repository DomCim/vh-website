import type { Payload } from 'payload'

import { rechnungPdf } from './invoice'
import { firmenAngaben } from './settings'

/**
 * Kundendokumente an einer Stelle.
 *
 * Angebot, Rechnung und Auftragsbestätigung entstehen hier — egal ob sie im
 * Browser angesehen oder per Mail verschickt werden. Vorher lag dieselbe
 * Aufbereitung in jeder Route noch einmal; damit wären Ansicht und Anhang
 * über kurz oder lang auseinandergelaufen.
 */

export type Dokument = {
  datei: Buffer
  dateiname: string
  /** Vorschlag für die Betreffzeile */
  betreff: string
  /** Empfängeradresse, soweit bekannt */
  an?: string | null
  /** Vorschlag für den Mailtext */
  text: string
}

export type DokumentArt = 'angebot' | 'rechnung' | 'bestaetigung'

const datum = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')

async function firma(payload: Payload) {
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  return firmenAngaben(settings)
}

/** Adresse aus einem verknüpften Geschäftspartner, sonst leer */
async function partnerMail(payload: Payload, id: unknown): Promise<string | null> {
  const nummer = typeof id === 'object' ? (id as { id?: number })?.id : id
  if (typeof nummer !== 'number') return null
  const partner = await payload
    .findByID({ collection: 'contacts', id: nummer, depth: 0, overrideAccess: true })
    .catch(() => null)
  return partner?.email ?? null
}

export async function angebotDokument(payload: Payload, id: string | number): Promise<Dokument> {
  const a = await payload.findByID({ collection: 'quotes', id, depth: 0, overrideAccess: true })
  if (!a?.quoteNumber) throw new Error('entwurf')

  const datei = await rechnungPdf(
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
      rabatt: a.discountTotal
        ? { bezeichnung: a.discountReason || 'Nachlass', betrag: a.discountTotal }
        : null,
      fassung: a.revision,
      hinweis: a.note,
    },
    await firma(payload),
  )

  const fassung = (a.revision ?? 1) > 1 ? ` (Fassung ${a.revision})` : ''
  return {
    datei,
    dateiname: `${a.quoteNumber}.pdf`,
    betreff: `Angebot ${a.quoteNumber}${fassung}${a.title ? ` — ${a.title}` : ''}`,
    an: await partnerMail(payload, a.customer),
    text:
      `Guten Tag${a.customerName ? ` ${a.customerName}` : ''},\n\n` +
      `anbei unser Angebot ${a.quoteNumber}${fassung} vom ${datum(a.issueDate)}.\n` +
      (a.validUntil ? `Es gilt bis zum ${datum(a.validUntil)}.\n` : '') +
      (a.productionTime ? `Fertigungszeit: ${a.productionTime}.\n` : '') +
      `\nFür Rückfragen stehe ich gern zur Verfügung.`,
  }
}

export async function rechnungDokument(payload: Payload, id: string | number): Promise<Dokument> {
  const r = await payload.findByID({
    collection: 'outgoing-invoices',
    id,
    depth: 0,
    overrideAccess: true,
  })
  if (!r?.invoiceNumber) throw new Error('entwurf')

  const datei = await rechnungPdf(
    {
      nummer: r.invoiceNumber,
      datum: r.issueDate,
      faelligAm: r.dueDate,
      preiseSind: 'netto',
      empfaenger: {
        name: r.customerName,
        anschrift: (r.customerAddress ?? '').split('\n').filter(Boolean),
      },
      positionen: (r.items ?? []).map((p) => ({
        bezeichnung: p.description,
        zusatz: p.unit && p.unit !== 'Stück' ? p.unit : null,
        menge: p.quantity,
        einzelpreis: p.unitPrice,
        steuersatz: p.vatRate,
      })),
      rabatt: r.discountTotal
        ? { bezeichnung: r.discountReason || 'Nachlass', betrag: r.discountTotal }
        : null,
      hinweis: r.note,
      reverseCharge: Boolean(r.reverseCharge),
    },
    await firma(payload),
  )

  return {
    datei,
    dateiname: `${r.invoiceNumber}.pdf`,
    betreff: `Rechnung ${r.invoiceNumber}`,
    an: await partnerMail(payload, r.customer),
    text:
      `Guten Tag${r.customerName ? ` ${r.customerName}` : ''},\n\n` +
      `anbei die Rechnung ${r.invoiceNumber} vom ${datum(r.issueDate)}.\n` +
      (r.dueDate ? `Zahlbar bis zum ${datum(r.dueDate)}.\n` : '') +
      `\nVielen Dank für die Zusammenarbeit.`,
  }
}

export async function bestaetigungDokument(
  payload: Payload,
  id: string | number,
): Promise<Dokument> {
  const auftrag = await payload.findByID({
    collection: 'jobs',
    id,
    depth: 0,
    overrideAccess: true,
  })
  if (!auftrag) throw new Error('nicht-gefunden')

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
    auftrag.orderedAt ? `vom ${datum(auftrag.orderedAt)}` : null,
    auftrag.dueDate ? `Voraussichtlich fertig: ${datum(auftrag.dueDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const datei = await rechnungPdf(
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
    await firma(payload),
  )

  // Erst nach erfolgreichem Erzeugen festhalten, wann zugesagt wurde
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

  return {
    datei,
    dateiname: `Auftragsbestaetigung-${auftrag.jobNumber}.pdf`,
    betreff: `Auftragsbestätigung ${auftrag.jobNumber}${auftrag.title ? ` — ${auftrag.title}` : ''}`,
    an: await partnerMail(payload, auftrag.contact),
    text:
      `Guten Tag${auftrag.customerName ? ` ${auftrag.customerName}` : ''},\n\n` +
      `vielen Dank für Ihren Auftrag. Anbei die Auftragsbestätigung ${auftrag.jobNumber}.\n` +
      (auftrag.dueDate ? `Voraussichtlich fertig: ${datum(auftrag.dueDate)}.\n` : '') +
      `\nJedes Stück entsteht einzeln in unserer Werkstatt — ich melde mich, sobald es losgeht.`,
  }
}

export async function dokument(
  payload: Payload,
  art: DokumentArt,
  id: string | number,
): Promise<Dokument> {
  if (art === 'angebot') return angebotDokument(payload, id)
  if (art === 'rechnung') return rechnungDokument(payload, id)
  return bestaetigungDokument(payload, id)
}
