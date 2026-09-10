import type { Payload } from 'payload'

import { absenderVon } from './absender'
import { artikelBildPfad, medienBildPfad } from './artikelbild'
import { belegAblegen, belegLesen } from './belegablage'
import { facturXml, type FacturXDaten } from './facturx'
import { xmlAusPdf } from './facturxLesen'
import { euro } from './format'
import { bestellungAlsRechnung, rechnungPdf } from './invoice'
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
   * Welche Mail-Vorlage für die Begleitmail gilt, und womit sie gefüllt wird.
   *
   * Die Reihenfolge beim Verschicken (siehe api/office/versand): Ein im Büro
   * getippter Text hat Vorrang — wer die Mail von Hand schreibt, will genau
   * die. Sonst die Vorlage aus den Einstellungen, sonst `text` von hier.
   */
  vorlage?: { art: string; werte: Record<string, string> }
  /**
   * Was nach dem erfolgreichen Verschicken festzuhalten ist — etwa die
   * verschickte Mahnstufe. Bewusst erst danach: Beim Ansehen im Browser wird
   * dasselbe Dokument erzeugt, und das darf nichts verändern.
   */
  nachSenden?: () => Promise<void>
}

export type DokumentArt = 'angebot' | 'rechnung' | 'bestaetigung' | 'mahnung' | 'lieferschein'

/*
 * Wer eine Dokumentart verschicken darf, richtet sich nach dem Modul, aus
 * dem sie stammt — nicht nach einem Sammelrecht. Vorher genügte „Anfragen
 * bearbeiten" für alles: Wer nur Anfragen beantworten durfte, konnte Mahnungen
 * verschicken, und wer Rechnungen schreiben durfte, konnte sie nicht versenden.
 */
export const DOKUMENT_RECHT = {
  angebot: 'angebote.schreiben',
  rechnung: 'rechnungen.schreiben',
  mahnung: 'rechnungen.schreiben',
  bestaetigung: 'auftraege.bearbeiten',
  lieferschein: 'auftraege.bearbeiten',
} as const satisfies Record<DokumentArt, string>

const datum = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')

async function firma(payload: Payload) {
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  return firmenAngaben(settings)
}

/**
 * Den abgelegten Beleg herausgeben — und beim ersten Mal ablegen.
 *
 * **Warum überhaupt.** Ein Beleg ist ein Gegenstand, keine Ansicht. Wird er
 * bei jedem Abruf neu gebaut, verändert ihn alles, was sich seither geändert
 * hat: der Briefkopf, die Vorlage, sogar das Artikelbild, das am Produkt
 * hängt. Was der Kunde bekommen hat, wäre dann nicht mehr herstellbar.
 *
 * **Warum beim ersten Abruf und nicht beim Festschreiben.** Das PDF zu bauen
 * dauert und kann scheitern — an einer fehlenden Schrift, an einem kaputten
 * Bild. Im Speichern der Rechnung hätte das zur Folge, dass die Rechnung nicht
 * gespeichert wird, und das wäre der schlechtere Fehler. Der erste Abruf ist
 * ohnehin der Moment, in dem der Beleg zum ersten Mal gebraucht wird: ansehen
 * oder verschicken. Die Firmenangaben sind da bereits eingefroren
 * (`lib/absender.ts`), das Blatt also schon dasselbe wie beim Festschreiben.
 *
 * **Scheitert das Ablegen, geht der Beleg trotzdem hinaus.** Eine volle Platte
 * darf keine Rechnung aufhalten; sie kommt dann beim nächsten Abruf in die
 * Ablage.
 */
async function belegDatei(
  abgelegt: string | null | undefined,
  kennung: string,
  bauen: () => Promise<Buffer>,
  merken: (datename: string) => Promise<void>,
): Promise<Buffer> {
  const vorhanden = await belegLesen(abgelegt)
  if (vorhanden) return vorhanden

  const datei = await bauen()
  try {
    await merken(await belegAblegen(kennung, datei))
  } catch (err) {
    console.error('Beleg konnte nicht abgelegt werden:', err)
  }
  return datei
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

  // Einmal festhalten: In der Funktion unten weiß TypeScript nicht mehr, dass
  // die Prüfung oben die Nummer schon ausgeschlossen hat.
  const nummer = a.quoteNumber
  const angaben = await absenderVon(payload, a.absender)

  /*
   * Gebaut wird nur, wenn nichts abgelegt ist — deshalb steckt das Blatt in
   * einer Funktion und nicht in einer Zuweisung. Die Bilder der Positionen
   * kommen aus der Datenbank; das ist Arbeit, die für ein Angebot, das
   * längst als PDF daliegt, niemand mehr tun muss.
   */
  const bauen = async () =>
    rechnungPdf(
      {
        art: 'angebot',
        nummer,
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
      angaben,
    )

  // Die Fassung gehört in den Dateinamen: Im Ordner liegen sonst zwei Blätter
  // derselben Nummer nebeneinander, ohne dass man sie unterscheiden könnte.
  const fassungsKennung = `${nummer}${(a.revision ?? 1) > 1 ? `-F${a.revision}` : ''}`

  const datei = await belegDatei(a.pdfAblage, fassungsKennung, bauen, async (name) => {
    await payload.update({
      collection: 'quotes',
      id: a.id,
      overrideAccess: true,
      data: { pdfAblage: name },
    })
  })

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
    vorlage: {
      art: 'angebot',
      werte: {
        kunde: a.customerName ?? '',
        nummer: `${a.quoteNumber ?? ''}${fassung}`,
        gueltigBis: a.validUntil ? datum(a.validUntil) : '',
      },
    },
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

  /*
   * Die eigenen Angaben aus der Abschrift am Beleg, nicht aus den heutigen
   * Einstellungen. Sie stehen auf dem Blatt, im GiroCode und in der
   * eingebetteten Factur-X-XML — siehe `lib/absender.ts`.
   */
  const angaben = await absenderVon(payload, r.absender)
  // Siehe oben beim Angebot: die Nummer einmal festhalten.
  const nummer = r.invoiceNumber

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

  const bauen = async () =>
    rechnungPdf(
      {
        art: original ? 'storno' : 'rechnung',
        storniert: original
          ? { nummer: original.invoiceNumber ?? '', datum: original.issueDate }
          : null,
        nummer,
        datum: r.issueDate,
        faelligAm: r.dueDate,
        preiseSind: 'netto',
        empfaenger: {
          name: r.customerName,
          anschrift: (r.customerAddress ?? '').split('\n').filter(Boolean),
          kennung: r.customerSiret,
          umsatzsteuerId: r.customerVatId,
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

  const datei = await belegDatei(
    r.pdfAblage,
    alsDateiname(r.invoiceNumber),
    bauen,
    async (name) => {
      await payload.update({
        collection: 'outgoing-invoices',
        id: r.id,
        overrideAccess: true,
        data: { pdfAblage: name },
      })
    },
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
    vorlage: {
      art: 'rechnung',
      werte: {
        kunde: r.customerName ?? '',
        nummer: r.invoiceNumber ?? '',
        betrag: euro(r.total ?? 0),
        faelligAm: r.dueDate ? datum(r.dueDate) : '',
      },
    },
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

  const dateiname = `${alsDateiname(r.invoiceNumber)}-factur-x.xml`

  /*
   * Zuerst die XML aus dem abgelegten PDF holen.
   *
   * Sie ist der rechtlich maßgebliche Teil der Rechnung, und der Empfänger
   * prüft sie gegen das Bild daneben. Würde sie hier neu gerechnet, während
   * das PDF aus der Ablage kommt, könnten beide auseinanderlaufen — genau der
   * Widerspruch, an dem jede Empfängerplattform zuerst hängen bleibt. Also
   * wird herausgegeben, was eingebettet ist.
   */
  const abgelegt = await belegLesen(r.pdfAblage)
  const eingebettet = abgelegt ? xmlAusPdf(abgelegt) : null
  if (eingebettet) return { xml: eingebettet, dateiname }

  const angaben = await absenderVon(payload, r.absender)
  return { xml: facturXml(facturxAusRechnung(r, angaben), angaben), dateiname }
}

/**
 * Die Rechnung zu einer Shop-Bestellung.
 *
 * Sie entsteht einmal, beim Eingang der Zahlung, und geht als Anhang der
 * Bestätigungsmail hinaus (`lib/orderHooks.ts`). Seit dieser Fassung bleibt
 * dieselbe Datei im Haus — vorher lag sie ausschließlich im Postfach des
 * Kunden, obwohl sie acht Jahre aufzubewahren ist.
 *
 * Für Bestellungen von vorher gibt es nichts abzuholen. Dann wird das Blatt
 * neu gebaut, aus der Abschrift falls vorhanden und sonst aus den heutigen
 * Einstellungen. Das ist eine Annäherung und keine Kopie — mehr ist für die
 * Zeit vor der Ablage nicht zu haben.
 */
export async function bestellungRechnung(
  payload: Payload,
  id: string | number,
): Promise<{ datei: Buffer; dateiname: string }> {
  const o = (await payload.findByID({
    collection: 'orders',
    id,
    depth: 0,
    overrideAccess: true,
  })) as Record<string, any>
  if (!o) throw new Error('nicht-gefunden')

  const dateiname = `Rechnung-${o.orderNumber}.pdf`
  const abgelegt = await belegLesen(o.pdfAblage)
  if (abgelegt) return { datei: abgelegt, dateiname }

  const angaben = await absenderVon(payload, o.absender)
  return { datei: await bestellungAlsRechnung(o as never, angaben), dateiname }
}

/**
 * Eine Mahnung zu einer Rechnung — die nächste Stufe oder eine verschickte.
 *
 * **Die nächste Stufe** ergibt sich aus dem, was schon hinausgegangen ist;
 * niemand muss sich merken, ob die Erinnerung raus war. Die Frist ist bewusst
 * kurz (zehn Tage bei der Erinnerung, sieben danach): Eine Mahnung ohne Datum
 * ist eine Bitte.
 *
 * **Eine verschickte Stufe** (`zeile`) kommt so wieder heraus, wie sie
 * hinausgegangen ist. Das ging vorher gar nicht: Stufe, Frist und Pauschale
 * wurden bei jedem Aufruf neu gerechnet. War die Erinnerung raus, lieferte
 * derselbe Knopf die erste Mahnung mit einer neuen Frist — und das verschickte
 * Schreiben war nicht mehr herstellbar. Ausgerechnet dort, wo die Frist der
 * ganze Punkt ist: An ihr hängt der Verzug.
 */
export async function mahnungDokument(
  payload: Payload,
  id: string | number,
  /** Die wievielte verschickte Mahnung (ab 0). Ohne Angabe: die nächste Stufe. */
  zeile?: number,
): Promise<Dokument> {
  const r = await payload.findByID({
    collection: 'outgoing-invoices',
    id,
    depth: 0,
    overrideAccess: true,
  })
  if (!r?.invoiceNumber) throw new Error('entwurf')

  type Mahnzeile = {
    level?: number | null
    sentAt?: string | null
    lateFee?: number | null
    fristBis?: string | null
    pdfAblage?: string | null
    id?: string | null
  }
  const mahnungen = (r.reminders ?? []) as Mahnzeile[]
  const verschickt = typeof zeile === 'number' ? mahnungen[zeile] : null
  if (typeof zeile === 'number' && !verschickt) throw new Error('nicht-gefunden')

  /*
   * Eine neue Mahnung gibt es nur zu einer offenen Rechnung. Eine verschickte
   * dagegen jederzeit, auch nach der Zahlung: Was damals gefordert wurde, ist
   * eine Tatsache und muss belegbar bleiben — im Zweifel vor Gericht.
   */
  if (!verschickt && (r.status === 'bezahlt' || r.status === 'storniert')) {
    throw new Error('nicht-offen')
  }

  const stufe = (
    verschickt
      ? Math.min(Math.max(verschickt.level ?? 1, 1), 3)
      : Math.min(mahnungen.length + 1, 3)
  ) as Mahnstufe

  const angaben = await absenderVon(payload, r.absender)
  // Erst ab der zweiten Stufe: Die Pauschale steht dem Betrieb zwar ab Verzug
  // zu, aber eine freundliche Erinnerung mit Gebühr ist keine freundliche
  // Erinnerung mehr.
  const pauschale = verschickt ? (verschickt.lateFee ?? 0) : stufe >= 2 ? 40 : 0

  const frist = verschickt?.fristBis ? new Date(verschickt.fristBis) : new Date()
  if (!verschickt?.fristBis) frist.setDate(frist.getDate() + (stufe === 1 ? 10 : 7))

  const titel = MAHN_TITEL[stufe]
  // Siehe oben beim Angebot: die Nummer einmal festhalten.
  const nummer = r.invoiceNumber
  const dateiname = `${titel.replace(/ /g, '-')}-${alsDateiname(nummer)}.pdf`
  const kennung = dateiname.replace(/\.pdf$/, '')

  const bauen = async () =>
    mahnungPdf(
      {
        stufe,
        rechnungsnummer: nummer,
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

  /*
   * Abgelegt wird nur, was auch belegt ist.
   *
   * Mahnzeilen aus der Zeit vor dieser Umstellung führen keine Frist mit. Ihr
   * Schreiben lässt sich deshalb nur annähern — mit einer Frist von heute an
   * gerechnet, die so nie verschickt wurde. Das darf man ansehen, aber nicht
   * ablegen: Sonst stünde eine geratene Frist für immer als das Schreiben da,
   * das hinausgegangen ist.
   */
  const datei = !verschickt
    ? await bauen()
    : !verschickt.fristBis
    ? await bauen()
    : await belegDatei(verschickt.pdfAblage, kennung, bauen, async (name) => {
        await payload.update({
          collection: 'outgoing-invoices',
          id: r.id,
          overrideAccess: true,
          data: {
            reminders: mahnungen.map((m, n) => (n === zeile ? { ...m, pdfAblage: name } : m)),
          },
        })
      })

  return {
    datei,
    dateiname,
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
    vorlage: {
      art: 'mahnung',
      werte: {
        kunde: r.customerName ?? '',
        // Eine Vorlage für alle drei Stufen: Der Titel kommt als Wert, damit
        // nicht drei fast gleiche Texte gepflegt werden müssen.
        stufe: titel,
        nummer: r.invoiceNumber ?? '',
        betrag: euro(r.total ?? 0),
        faelligWar: r.dueDate ? datum(r.dueDate) : '',
        tage: r.dueDate
          ? String(
              Math.max(
                0,
                Math.floor((Date.now() - new Date(r.dueDate).getTime()) / 86_400_000),
              ),
            )
          : '',
      },
    },
    // Eine verschickte Mahnung wird beim Ansehen nicht noch einmal gezählt.
    nachSenden: verschickt
      ? undefined
      : async () => {
          /*
           * Das Schreiben kommt in die Ablage, und die Zeile hält fest, was
           * darin steht: Stufe, Frist und Pauschale. Erst zusammen ergibt das
           * ein Schreiben, das sich in drei Jahren noch herstellen lässt.
           */
          let pdfAblage: string | undefined
          try {
            pdfAblage = await belegAblegen(kennung, datei)
          } catch (err) {
            console.error('Mahnung konnte nicht abgelegt werden:', err)
          }
          await payload.update({
            collection: 'outgoing-invoices',
            id: r.id,
            overrideAccess: true,
            data: {
              reminders: [
                ...mahnungen,
                {
                  level: stufe,
                  sentAt: new Date().toISOString(),
                  lateFee: pauschale || undefined,
                  fristBis: frist.toISOString(),
                  pdfAblage,
                },
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

  /*
   * Das Datum der Zusage, nicht das von heute.
   *
   * Vorher stand hier `new Date()`. Wer die Bestätigung Wochen später noch
   * einmal öffnete, bekam ein anderes Blatt als der Kunde in der Hand hält —
   * und bei einer Zusage ist das Datum der Kern der Aussage.
   */
  const zugesagt = auftrag.confirmedAt ?? new Date().toISOString()
  const angaben = await absenderVon(payload, auftrag.absender)

  const bauen = async () =>
    rechnungPdf(
      {
        art: 'angebot',
        nummer: `Auftragsbestätigung ${auftrag.jobNumber}`,
        datum: zugesagt,
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
      angaben,
    )

  const datei = await belegDatei(
    auftrag.pdfAblage,
    `Auftragsbestaetigung-${auftrag.jobNumber}`,
    bauen,
    async (name) => {
      await payload.update({
        collection: 'jobs',
        id: auftrag.id,
        overrideAccess: true,
        data: { pdfAblage: name },
      })
    },
  )

  /*
   * Erst nach erfolgreichem Erzeugen festhalten, wann zugesagt wurde — und
   * mit demselben Zeitpunkt, der oben auf dem Blatt steht. Dazu die
   * Firmenangaben als Abschrift: Ab jetzt ist die Bestätigung eine Zusage und
   * kein Entwurf mehr, und sie soll in zwei Jahren dasselbe sagen.
   */
  if (!auftrag.confirmedAt) {
    await payload
      .update({
        collection: 'jobs',
        id: auftrag.id,
        overrideAccess: true,
        data: { confirmedAt: zugesagt, absender: angaben },
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
    vorlage: {
      art: 'bestaetigung',
      werte: {
        kunde: auftrag.customerName ?? '',
        auftragsnummer: auftrag.jobNumber ?? '',
      },
    },
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
  /** Mit Unterschrift wird aus dem Lieferschein das Abnahmeprotokoll */
  abnahme?: { bild: Buffer; name?: string | null; ort?: string | null; datum: Date },
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
      abnahme,
      /*
       * Die Übergabefotos — Zustand und Verpackung, bevor das Stück wegfährt.
       *
       * Ein Foto, dessen Datei fehlt oder das die Mediathek nur als WebP
       * hergibt, fällt hier heraus statt das Dokument aufzuhalten
       * (`medienBildPfad` gibt dann `null`). Der Lieferschein muss entstehen,
       * auch wenn ein Bild kaputt ist.
       */
      uebergabefotos: (
        await Promise.all(
          (auftrag.uebergabefotos ?? []).map(async (f) => ({
            pfad: await medienBildPfad(payload, f.bild),
            bemerkung: f.bemerkung ?? null,
          })),
        )
      ).flatMap((f) => (f.pfad ? [{ pfad: f.pfad, bemerkung: f.bemerkung }] : [])),
    },
    await firma(payload),
  )

  return {
    datei,
    dateiname: `${abnahme ? 'Abnahme' : 'Lieferschein'}-${auftrag.jobNumber}.pdf`,
    betreff: `Lieferschein zu ${auftrag.jobNumber}${auftrag.title ? ` — ${auftrag.title}` : ''}`,
    an: await partnerMail(payload, auftrag.contact),
    text:
      `Guten Tag${auftrag.customerName ? ` ${auftrag.customerName}` : ''},\n\n` +
      `anbei der Lieferschein zu ${auftrag.jobNumber}.\n` +
      `\nBitte prüfen Sie die Lieferung auf sichtbare Schäden und bestätigen Sie den Empfang.`,
    vorlage: {
      art: 'lieferschein',
      werte: {
        kunde: auftrag.customerName ?? '',
        auftragsnummer: auftrag.jobNumber ?? '',
      },
    },
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
