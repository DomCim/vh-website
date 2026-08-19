import type { Payload, Where } from 'payload'

import { stufenBerechnen } from './anzahlung'
import { zahlungsstand, type StufenRechnung } from './zahlungsstand'

/**
 * Was ein Kunde im Portal von sich sehen darf.
 *
 * Der Zugang hängt an einer bestätigten E-Mail-Adresse (siehe
 * `lib/kundenportal.ts`). Von dort führen zwei Wege zu Vorgängen:
 *
 *  - **Shop:** die Bestellung trägt die Adresse selbst.
 *  - **Projektgeschäft:** die Adresse steht am Geschäftspartner, und daran
 *    hängen Aufträge und Rechnungen.
 *
 * Alles läuft über diese Datei, damit es genau eine Stelle gibt, an der
 * entschieden wird, wem was gehört. Verstreut über drei Seiten wäre die vierte
 * die, die es falsch macht — und ein Kundenportal, das den falschen Auftrag
 * zeigt, ist schlimmer als keines.
 *
 * Zwei Dinge bleiben bewusst draußen:
 *
 * **Rechnungsentwürfe.** Ein Entwurf ist eine interne Überlegung; er hat noch
 * keine Nummer, kann sich noch ändern und kann verworfen werden. Wer ihn sähe,
 * hielte ihn für eine Forderung.
 *
 * **Alles, was nicht bezahlt heißt.** Kosten, Material, Zeiterfassung, Notizen
 * zur Fertigung — davon geht nichts nach draußen. Das Portal beantwortet genau
 * die Fragen, wegen denen Leute anrufen: Wo steht mein Stück, und was schulde
 * ich noch?
 */

export type PortalAuftrag = {
  id: number | string
  nummer: string
  titel: string
  status: string
  fertigBis?: string | null
  /** Steht eine Zahlung aus, die den Fortgang aufhält? */
  wartetAufZahlung: boolean
  offeneStufe: string | null
  tageUeberfaellig: number
  gesamt: number
  bezahlt: number
}

export type PortalRechnung = {
  id: number | string
  nummer: string
  stufe: string
  status: string
  datum?: string | null
  faelligAm?: string | null
  betrag: number
  auftrag?: string | null
}

export type PortalAngebot = {
  id: number | string
  nummer: string
  titel: string
  status: string
  datum?: string | null
  gueltigBis?: string | null
  betrag: number
  /** Kann die Kundschaft es jetzt annehmen? */
  annehmbar: boolean
  angenommenAm?: string | null
}

export type PortalBestellung = {
  id: number | string
  nummer: string
  status: string
  datum?: string | null
  betrag: number
  zugang?: string | null
}

const runden = (n: number) => Math.round(n * 100) / 100

/** Die Geschäftspartner zu dieser Adresse — der Weg ins Projektgeschäft. */
async function kontaktIds(payload: Payload, email: string): Promise<number[]> {
  const { docs } = await payload.find({
    collection: 'contacts',
    where: { email: { equals: email } },
    limit: 20,
    depth: 0,
    overrideAccess: true,
  })
  return docs.map((k) => k.id as number)
}

/** Gibt es zu dieser Adresse überhaupt etwas? Entscheidet über den Anmeldecode. */
export async function hatVorgaenge(payload: Payload, email: string): Promise<boolean> {
  const bestellungen = await payload.count({
    collection: 'orders',
    where: { 'customer.email': { equals: email } },
    overrideAccess: true,
  })
  if (bestellungen.totalDocs > 0) return true

  const ids = await kontaktIds(payload, email)
  if (!ids.length) return false

  const auftraege = await payload.count({
    collection: 'jobs',
    where: { contact: { in: ids } },
    overrideAccess: true,
  })
  if (auftraege.totalDocs > 0) return true

  const rechnungen = await payload.count({
    collection: 'outgoing-invoices',
    where: { and: [{ customer: { in: ids } }, { status: { in: ['gestellt', 'bezahlt'] } }] },
    overrideAccess: true,
  })
  if (rechnungen.totalDocs > 0) return true

  /*
   * Auch ein verschicktes Angebot ist ein Vorgang.
   *
   * Wer eines bekommen hat, hat noch nichts gekauft — und stand deshalb vor
   * einer Tür, die es für ihn nicht gab. Dabei ist genau er derjenige, der
   * sich anmelden soll: um das Angebot anzusehen und anzunehmen.
   */
  const angebote = await payload.count({
    collection: 'quotes',
    where: {
      and: [{ customer: { in: ids } }, { status: { in: ['versendet', 'angenommen'] } }],
    },
    overrideAccess: true,
  })
  return angebote.totalDocs > 0
}

/**
 * Alles, was dieser Adresse gehört.
 *
 * Die Rechnungen werden zweimal gesucht: über den Geschäftspartner und über
 * die Aufträge. Der zweite Weg ist der wichtigere — bei gestufter Zahlung
 * hängt die Rechnung am Auftrag, und der Partner ist dort nicht immer
 * eingetragen.
 */
export async function vorgaenge(
  payload: Payload,
  email: string,
): Promise<{
  bestellungen: PortalBestellung[]
  auftraege: PortalAuftrag[]
  rechnungen: PortalRechnung[]
  angebote: PortalAngebot[]
}> {
  const ids = await kontaktIds(payload, email)

  const { docs: bestellungen } = await payload.find({
    collection: 'orders',
    where: { 'customer.email': { equals: email } },
    sort: '-createdAt',
    limit: 50,
    depth: 0,
    overrideAccess: true,
  })

  const bestellIds = bestellungen.map((b) => b.id as number)

  const auftragsFilter: Where[] = []
  if (ids.length) auftragsFilter.push({ contact: { in: ids } })
  if (bestellIds.length) auftragsFilter.push({ order: { in: bestellIds } })

  const { docs: auftraege } = auftragsFilter.length
    ? await payload.find({
        collection: 'jobs',
        where: { or: auftragsFilter },
        sort: '-createdAt',
        limit: 50,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] }

  const auftragsIds = auftraege.map((a) => a.id as number)

  const rechnungsFilter: Where[] = []
  if (ids.length) rechnungsFilter.push({ customer: { in: ids } })
  if (auftragsIds.length) rechnungsFilter.push({ auftrag: { in: auftragsIds } })

  const { docs: rechnungen } = rechnungsFilter.length
    ? await payload.find({
        collection: 'outgoing-invoices',
        where: {
          and: [{ or: rechnungsFilter }, { status: { in: ['gestellt', 'bezahlt'] } }],
        },
        sort: '-issueDate',
        limit: 50,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] }

  /*
   * Angebote hängen nur am Geschäftspartner — anders als Rechnungen gibt es
   * keinen zweiten Weg über den Auftrag. Entwürfe bleiben draußen, wie überall
   * hier: Ein Entwurf ist eine interne Überlegung und noch kein Angebot.
   */
  const { docs: angebote } = ids.length
    ? await payload.find({
        collection: 'quotes',
        where: {
          and: [
            { customer: { in: ids } },
            { status: { in: ['versendet', 'angenommen', 'abgelehnt'] } },
          ],
        },
        sort: '-issueDate',
        limit: 50,
        depth: 0,
        overrideAccess: true,
      })
    : { docs: [] }

  const nummerJeAuftrag = new Map(auftraege.map((a) => [String(a.id), a.jobNumber ?? '']))

  return {
    bestellungen: bestellungen.map((b) => ({
      id: b.id,
      nummer: b.orderNumber,
      status: b.status ?? 'pending',
      datum: b.createdAt,
      betrag: Number(b.total) || 0,
      zugang: b.accessToken,
    })),

    auftraege: auftraege.map((a) => {
      const dazu = rechnungen.filter((r) => {
        const id = typeof r.auftrag === 'object' ? (r.auftrag as { id?: number })?.id : r.auftrag
        return String(id ?? '') === String(a.id)
      })
      const stand = zahlungsstand(
        dazu.map(
          (r): StufenRechnung => ({
            stufe: r.stufe,
            status: r.status,
            dueDate: r.dueDate,
            netto: r.netTotal,
            nummer: r.invoiceNumber,
          }),
        ),
      )
      const wert = (a.positions ?? []).reduce(
        (s, p) => s + (Number(p.quantity) || 0) * (Number(p.price) || 0),
        0,
      )
      const stufen = stufenBerechnen(runden(wert), a.zahlplan ?? {})

      return {
        id: a.id,
        nummer: a.jobNumber ?? '',
        titel: a.title ?? '',
        status: a.status ?? 'geplant',
        fertigBis: a.dueDate,
        wartetAufZahlung: stand.wartet,
        offeneStufe: stand.offeneStufe,
        tageUeberfaellig: stand.tageUeberfaellig,
        gesamt: runden(stufen.anzahlung + stufen.zwischen + stufen.schluss),
        bezahlt: runden(
          dazu.filter((r) => r.status === 'bezahlt').reduce((s, r) => s + (Number(r.total) || 0), 0),
        ),
      }
    }),

    angebote: angebote.map((a) => {
      // Abgelaufen heißt nicht ungültig — aber annehmen soll man es nicht mehr
      // per Knopf, sonst entstünde ein Auftrag zu Preisen von vorletztem Jahr.
      const abgelaufen = Boolean(a.validUntil && new Date(a.validUntil).getTime() < Date.now())
      return {
        id: a.id,
        nummer: a.quoteNumber ?? '',
        titel: a.title ?? '',
        status: a.status ?? 'versendet',
        datum: a.issueDate,
        gueltigBis: a.validUntil,
        betrag: Number(a.total) || 0,
        annehmbar: a.status === 'versendet' && !abgelaufen,
        angenommenAm: a.acceptedAt,
      }
    }),

    rechnungen: rechnungen.map((r) => {
      const id = typeof r.auftrag === 'object' ? (r.auftrag as { id?: number })?.id : r.auftrag
      return {
        id: r.id,
        nummer: r.invoiceNumber ?? '',
        stufe: r.stufe ?? 'vollstaendig',
        status: r.status ?? 'gestellt',
        datum: r.issueDate,
        faelligAm: r.dueDate,
        betrag: Number(r.total) || 0,
        auftrag: nummerJeAuftrag.get(String(id ?? '')) ?? null,
      }
    }),
  }
}

/**
 * Darf diese Adresse diese Rechnung herunterladen?
 *
 * Bewusst dieselbe Abfrage wie für die Liste, nur mit einer Rechnung als
 * Frage. Eine eigene, schlankere Prüfung wäre schneller und wäre die Stelle,
 * an der die beiden irgendwann auseinanderlaufen — und dann liegt eine
 * fremde Rechnung hinter einer Nummer, die jemand durchprobiert.
 */
export async function darfAngebotSehen(
  payload: Payload,
  email: string,
  angebotId: string | number,
): Promise<boolean> {
  const meine = await vorgaenge(payload, email)
  return meine.angebote.some((a) => String(a.id) === String(angebotId))
}

export async function darfRechnungSehen(
  payload: Payload,
  email: string,
  rechnungId: string | number,
): Promise<boolean> {
  const meine = await vorgaenge(payload, email)
  return meine.rechnungen.some((r) => String(r.id) === String(rechnungId))
}
