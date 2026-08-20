import type { Payload } from 'payload'

import { artikelBildPfad } from './artikelbild'
import { facturXml, type FacturXDaten } from './facturx'
import { rechnungPdf } from './invoice'
import { lieferscheinPdf } from './lieferschein'
import { MAHN_TITEL, type Mahnstufe, mahnungPdf } from './mahnung'
import { firmenAngaben } from './settings'
import { alsDateiname } from './nummernkreis'

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
  /**
   * Was nach dem erfolgreichen Verschicken festzuhalten ist — etwa die
   * verschickte Mahnstufe. Bewusst erst danach: Beim Ansehen im Browser wird
   * dasselbe Dokument erzeugt, und das darf nichts verändern.
   */
  nachSenden?: () => Promise<void>
}

export type DokumentArt = 'angebot' | 'rechnung' | 'bestaetigung' | 'mahnung' | 'lieferschein'

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
      positionen: await Promise.all(
        (a.items ?? []).map(async (p) => ({
          bezeichnung: p.description,
          zusatz: p.unit && p.unit !== 'Stück' ? p.unit : null,
          menge: p.quantity,
          einzelpreis: p.unitPrice,
          steuersatz: p.vatRate,
          bild: await artikelBildPfad(payload, p.product),
        })),
      ),
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
    // Ab wann nachgefasst wird, hängt daran — deshalb erst nach dem Versand
    // setzen und nicht schon beim Ansehen im Browser.
    nachSenden: a.sentAt
      ? undefined
      : async () => {
          await payload.update({
            collection: 'quotes',
            id: a.id,
            overrideAccess: true,
            data: { sentAt: new Date().toISOString() },
          })
        },
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

/**
 * Die Rechnung noch einmal als Datensatz — Grundlage der Factur-X-XML im PDF.
 *
 * Bewusst aus denselben Feldern wie das Blatt: Zwei getrennte Aufbereitungen
 * laufen früher oder später auseinander, und dann steht im PDF eine andere
 * Summe als in der XML. Genau das prüft jede Empfängerplattform zuerst.
 */
function facturxAusRechnung(
  r: Record<string, any>,
  firmenangaben: { vatRate?: number | null; iban?: string | null; bic?: string | null },
): FacturXDaten {
  return {
    nummer: r.invoiceNumber,
    datum: r.issueDate ? new Date(r.issueDate) : new Date(),
    faelligAm: r.dueDate ? new Date(r.dueDate) : null,
    /*
     * 381 statt 380, sobald die Rechnung eine andere aufhebt.
     *
     * Der Typcode ist das, woran eine Plattform eine Gutschrift erkennt.
     * Stünde dort 380, käme die Stornorechnung als zweite Forderung an —
     * mit negativen Beträgen, die manche Prüfung rundweg ablehnt.
     */
    typ: r.stornoVon ? '381' : '380',
    kunde: {
      name: r.customerName || '—',
      anschrift: (r.customerAddress ?? '').split('\n').filter(Boolean),
      kennung: r.customerSiret,
      umsatzsteuerId: r.customerVatId,
    },
    lieferung: r.deliveryAddress
      ? { name: r.customerName, anschrift: String(r.deliveryAddress).split('\n').filter(Boolean) }
      : null,
    lieferdatum: r.deliveryDate ? new Date(r.deliveryDate) : null,
    bestellreferenz: r.buyerReference,
    positionen: (r.items ?? []).map((p: Record<string, any>) => ({
      bezeichnung: [p.description, p.unit && p.unit !== 'Stück' ? `(${p.unit})` : null]
        .filter(Boolean)
        .join(' '),
      menge: p.quantity ?? 1,
      einzelpreis: p.unitPrice ?? 0,
      steuersatz: p.vatRate ?? firmenangaben.vatRate ?? 20,
    })),
    rabatt: r.discountTotal
      ? { bezeichnung: r.discountReason || 'Nachlass', betrag: r.discountTotal }
      : null,
    reverseCharge: Boolean(r.reverseCharge),
    iban: firmenangaben.iban,
    bic: firmenangaben.bic,
    hinweis: r.note,
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

  const angaben = await firma(payload)

  /*
   * Eine Stornorechnung ist dasselbe Blatt mit anderem Kopf: Sie heißt
   * „Stornorechnung", nennt die aufgehobene Rechnung und fordert nichts.
   * Welche das ist, steht am Datensatz — nachgeschlagen wird sie nur fürs
   * Papier, denn dort gehört ihre Nummer hin und nicht ihre Kennung.
   */
  const storniertId =
    typeof r.stornoVon === 'object' ? (r.stornoVon as { id?: number })?.id : r.stornoVon
  const original = storniertId
    ? await payload
        .findByID({
          collection: 'outgoing-invoices',
          id: storniertId as number,
          depth: 0,
          overrideAccess: true,
        })
        .catch(() => null)
    : null

  const datei = await rechnungPdf(
    {
      art: original ? 'storno' : 'rechnung',
      storniert: original
        ? { nummer: original.invoiceNumber ?? '', datum: original.issueDate }
        : null,
      nummer: r.invoiceNumber,
      datum: r.issueDate,
      faelligAm: r.dueDate,
      preiseSind: 'netto',
      empfaenger: {
        name: r.customerName,
        anschrift: (r.customerAddress ?? '').split('\n').filter(Boolean),
      },
      positionen: await Promise.all(
        (r.items ?? []).map(async (p) => ({
          bezeichnung: p.description,
          zusatz: p.unit && p.unit !== 'Stück' ? p.unit : null,
          menge: p.quantity,
          einzelpreis: p.unitPrice,
          steuersatz: p.vatRate,
          bild: await artikelBildPfad(payload, p.product),
        })),
      ),
      rabatt: r.discountTotal
        ? { bezeichnung: r.discountReason || 'Nachlass', betrag: r.discountTotal }
        : null,
      hinweis: r.note,
      reverseCharge: Boolean(r.reverseCharge),
      facturx: facturxAusRechnung(r, angaben),
    },
    angaben,
  )

  if (original) {
    return {
      datei,
      dateiname: `${alsDateiname(r.invoiceNumber)}.pdf`,
      betreff: `Stornorechnung ${r.invoiceNumber} zu ${original.invoiceNumber}`,
      an: await partnerMail(payload, r.customer),
      text:
        `Guten Tag${r.customerName ? ` ${r.customerName}` : ''},\n\n` +
        `anbei die Stornorechnung ${r.invoiceNumber}. Sie hebt die Rechnung ` +
        `${original.invoiceNumber} vom ${datum(original.issueDate)} auf; ` +
        `daraus ist nichts mehr zu zahlen.\n` +
        (r.stornoGrund ? `\nGrund: ${r.stornoGrund}\n` : '') +
        `\nEntschuldigen Sie die Umstände.`,
    }
  }

  return {
    datei,
    dateiname: `${alsDateiname(r.invoiceNumber)}.pdf`,
    betreff: `Rechnung ${r.invoiceNumber}`,
    an: await partnerMail(payload, r.customer),
    text:
      `Guten Tag${r.customerName ? ` ${r.customerName}` : ''},\n\n` +
      `anbei die Rechnung ${r.invoiceNumber} vom ${datum(r.issueDate)}.\n` +
      (r.dueDate ? `Zahlbar bis zum ${datum(r.dueDate)}.\n` : '') +
      `\nVielen Dank für die Zusammenarbeit.`,
  }
}

/**
 * Die reine XML einer Rechnung — für den Steuerberater oder die Plattform,
 * die sie ohne das PDF drumherum haben will.
 */
export async function rechnungFacturX(
  payload: Payload,
  id: string | number,
): Promise<{ xml: string; dateiname: string }> {
  const r = (await payload.findByID({
    collection: 'outgoing-invoices',
    id,
    depth: 0,
    overrideAccess: true,
  })) as Record<string, any>
  if (!r?.invoiceNumber) throw new Error('entwurf')

  const angaben = await firma(payload)
  return {
    xml: facturXml(facturxAusRechnung(r, angaben), angaben),
    dateiname: `${alsDateiname(r.invoiceNumber)}-factur-x.xml`,
  }
}

/**
 * Die nächste Mahnstufe zu einer offenen Rechnung.
 *
 * Welche Stufe dran ist, ergibt sich aus dem, was schon verschickt wurde —
 * niemand muss sich merken, ob die Erinnerung raus war. Die Frist ist bewusst
 * kurz (zehn Tage bei der Erinnerung, sieben danach): Eine Mahnung ohne Datum
 * ist eine Bitte.
 */
export async function mahnungDokument(
  payload: Payload,
  id: string | number,
): Promise<Dokument> {
  const r = await payload.findByID({
    collection: 'outgoing-invoices',
    id,
    depth: 0,
    overrideAccess: true,
  })
  if (!r?.invoiceNumber) throw new Error('entwurf')
  if (r.status === 'bezahlt' || r.status === 'storniert') throw new Error('nicht-offen')

  const bisher = (r.reminders ?? []).length
  const stufe = Math.min(bisher + 1, 3) as Mahnstufe

  const angaben = await firma(payload)
  // Erst ab der zweiten Stufe: Die Pauschale steht dem Betrieb zwar ab Verzug
  // zu, aber eine freundliche Erinnerung mit Gebühr ist keine freundliche
  // Erinnerung mehr.
  const pauschale = stufe >= 2 ? 40 : 0

  const frist = new Date()
  frist.setDate(frist.getDate() + (stufe === 1 ? 10 : 7))

  const datei = await mahnungPdf(
    {
      stufe,
      rechnungsnummer: r.invoiceNumber,
      rechnungsdatum: r.issueDate,
      faelligAm: r.dueDate,
      betrag: r.total ?? 0,
      pauschale,
      fristBis: frist,
      empfaenger: {
        name: r.customerName,
        anschrift: (r.customerAddress ?? '').split('\n').filter(Boolean),
      },
    },
    angaben,
  )

  const titel = MAHN_TITEL[stufe]

  return {
    datei,
    dateiname: `${titel.replace(/ /g, '-')}-${alsDateiname(r.invoiceNumber)}.pdf`,
    betreff: `${titel} zur Rechnung ${r.invoiceNumber}`,
    an: await partnerMail(payload, r.customer),
    text:
      `Guten Tag${r.customerName ? ` ${r.customerName}` : ''},\n\n` +
      `anbei ${stufe === 1 ? 'eine Zahlungserinnerung' : 'unsere Mahnung'} zur Rechnung ` +
      `${r.invoiceNumber} vom ${datum(r.issueDate)}.\n` +
      `Wir bitten um Ausgleich bis zum ${datum(frist.toISOString())}.\n` +
      (stufe === 1
        ? `\nSollte sich die Zahlung überschnitten haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.`
        : `\nBitte melden Sie sich, falls es Gründe für die Verzögerung gibt — eine Ratenzahlung lässt sich vereinbaren.`),
    nachSenden: async () => {
      await payload.update({
        collection: 'outgoing-invoices',
        id: r.id,
        overrideAccess: true,
        data: {
          reminders: [
            ...(r.reminders ?? []),
            { level: stufe, sentAt: new Date().toISOString(), lateFee: pauschale || undefined },
          ],
        },
      })
    },
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
    ? await Promise.all(
        angebot.items.map(async (p) => ({
          bezeichnung: p.description,
          zusatz: p.unit && p.unit !== 'Stück' ? p.unit : null,
          menge: p.quantity,
          einzelpreis: p.unitPrice,
          steuersatz: p.vatRate,
          bild: await artikelBildPfad(payload, p.product),
        })),
      )
    : await Promise.all(
        (auftrag.positions ?? []).map(async (p) => ({
          bezeichnung: p.description,
          zusatz: null,
          menge: p.quantity ?? 1,
          einzelpreis: p.price ?? 0,
          steuersatz: 20,
          bild: await artikelBildPfad(payload, p.product),
        })),
      )

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

/**
 * Was der Auftraggeber beigestellt hat — mit Namen aus dem Inventar.
 *
 * Bei Lohnfertigung schickt der Kunde sein Blech; auf dem Lieferschein muss
 * stehen, was davon zurückkommt. Ohne den Namen aus dem Inventar stünde dort
 * nur eine Nummer.
 */
async function beigestelltesMaterial(
  payload: Payload,
  material: { item?: unknown; quantity?: number | null; beigestellt?: boolean | null }[] | null | undefined,
): Promise<{ bezeichnung: string; menge: number; einheit?: string | null }[]> {
  const zeilen = (material ?? []).filter((m) => m.beigestellt && m.quantity)
  return Promise.all(
    zeilen.map(async (m) => {
      const id = typeof m.item === 'object' ? (m.item as { id?: number })?.id : m.item
      const posten = id
        ? await payload
            .findByID({ collection: 'inventory-items', id: Number(id), depth: 0, overrideAccess: true })
            .catch(() => null)
        : null
      return {
        bezeichnung: posten?.name ?? `Posten ${id ?? '?'}`,
        menge: m.quantity ?? 0,
        einheit: posten?.unit ?? null,
      }
    }),
  )
}

/**
 * Lieferschein zu einem Auftrag.
 *
 * Die Nummer ist die des Auftrags mit einem Zusatz — ein eigener Nummernkreis
 * wäre eine Reihe mehr, die lückenlos sein müsste, ohne dass jemand etwas
 * davon hätte.
 */
export async function lieferscheinDokument(
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

  // Anschrift aus der Shop-Bestellung, falls der Auftrag daher kommt
  const bestellId = typeof auftrag.order === 'object' ? auftrag.order?.id : auftrag.order
  const bestellung = bestellId
    ? await payload
        .findByID({ collection: 'orders', id: bestellId, depth: 0, overrideAccess: true })
        .catch(() => null)
    : null

  const a = bestellung?.shippingAddress
  const anschrift = a
    ? [a.line1, a.line2, [a.postalCode, a.city].filter(Boolean).join(' '), a.country].filter(
        (z): z is string => Boolean(z),
      )
    : []

  const datei = await lieferscheinPdf(
    {
      nummer: `LS-${auftrag.jobNumber}`,
      datum: new Date().toISOString(),
      auftrag: auftrag.jobNumber,
      bestellreferenz: auftrag.customerOrderRef ?? bestellung?.orderNumber,
      empfaenger: {
        name: auftrag.customerName ?? bestellung?.customer?.name,
        anschrift,
      },
      positionen: await Promise.all(
        (auftrag.positions ?? []).map(async (p) => ({
          bezeichnung: p.description,
          menge: p.quantity ?? 1,
          einheit: 'Stück',
          bild: await artikelBildPfad(payload, p.product),
        })),
      ),
      beistellung: await beigestelltesMaterial(payload, auftrag.material),
      hinweis: auftrag.notes,
    },
    await firma(payload),
  )

  return {
    datei,
    dateiname: `Lieferschein-${auftrag.jobNumber}.pdf`,
    betreff: `Lieferschein zu ${auftrag.jobNumber}${auftrag.title ? ` — ${auftrag.title}` : ''}`,
    an: await partnerMail(payload, auftrag.contact),
    text:
      `Guten Tag${auftrag.customerName ? ` ${auftrag.customerName}` : ''},\n\n` +
      `anbei der Lieferschein zu ${auftrag.jobNumber}.\n` +
      `\nBitte prüfen Sie die Lieferung auf sichtbare Schäden und bestätigen Sie den Empfang.`,
  }
}

export async function dokument(
  payload: Payload,
  art: DokumentArt,
  id: string | number,
): Promise<Dokument> {
  if (art === 'angebot') return angebotDokument(payload, id)
  if (art === 'rechnung') return rechnungDokument(payload, id)
  if (art === 'mahnung') return mahnungDokument(payload, id)
  if (art === 'lieferschein') return lieferscheinDokument(payload, id)
  return bestaetigungDokument(payload, id)
}
