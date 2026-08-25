import type { Payload, PayloadRequest } from 'payload'

import {
  abzugsZeilen,
  auftragsWert,
  geplanteStufen,
  stufenBerechnen,
  type Stufe,
  type Vorstufe,
  type Zahlplan,
} from './anzahlung'
import { RECHNUNG_STUFEN, textKarte } from './listen'
import { liveMelden } from './live'
import { nachCommit } from './nachCommit'
import { benachrichtige } from './push'

/**
 * Rechnungsentwürfe an den drei Auslösern.
 *
 * Wann welche Stufe fällig wird, ist keine Rechenfrage, sondern eine
 * Vereinbarung:
 *
 * | Stufe            | Auslöser                                    |
 * | ---------------- | ------------------------------------------- |
 * | Anzahlung        | der Auftrag entsteht (Auftragsbestätigung)  |
 * | Zwischenrechnung | `meilenstein.erreichtAm` wird gesetzt       |
 * | Schlussrechnung  | Status springt auf „fertig", vor Lieferung  |
 *
 * **Vorbereiten, nicht verschicken.** Der Auslöser legt einen Entwurf an und
 * stellt ihn im Büro auf die Liste; abgeschickt wird von Hand. Ein
 * versehentlich gesetzter Status kostet dann einen Entwurf und keine Rechnung
 * beim Kunden — und eine Rechnung, die draußen ist, holt niemand zurück.
 *
 * Deshalb bekommt der Entwurf hier auch keine Nummer und kein Rechnungsdatum:
 * Beides entsteht erst beim Festschreiben (siehe `collections/
 * OutgoingInvoices.ts`), sonst rissen verworfene Entwürfe Lücken in die Reihe.
 */

/** Was ein Auftrag mitbringen muss, damit hier etwas entstehen kann. */
type Auftrag = {
  id: number | string
  jobNumber?: string | null
  title?: string | null
  source?: string | null
  customerName?: string | null
  contact?: unknown
  zahlplan?: Zahlplan | null
  positions?: { description?: string | null; quantity?: number | null; price?: number | null }[] | null
  meilenstein?: { bezeichnung?: string | null; erreichtAm?: string | null } | null
}

const BEZEICHNUNG = textKarte(RECHNUNG_STUFEN) as Record<Stufe, string>

/*
 * Alle Abfragen hier bekommen `req` mit — und das ist keine Formsache.
 *
 * Die Auslöser sitzen in `afterChange`, und das läuft **innerhalb** der
 * Transaktion, die den Auftrag schreibt. Eine Abfrage ohne `req` nimmt eine
 * andere Verbindung: Sie sieht den eben angelegten Auftrag nicht (er ist noch
 * nicht festgeschrieben) und wartet, sobald sie eine Zeile anfassen will, die
 * die offene Transaktion hält. Beim ersten Probelauf war beides zu sehen — der
 * Entwurf zur Anzahlung entstand nicht, und das Skript blieb danach stehen.
 */

/** Der Steuersatz des Betriebs — je Auftrag gibt es keinen eigenen. */
export async function steuersatz(payload: Payload, req?: PayloadRequest): Promise<number> {
  try {
    const einstellungen = (await payload.findGlobal({ slug: 'site-settings', depth: 0, req })) as {
      company?: { vatRate?: number | null } | null
    }
    return Number(einstellungen?.company?.vatRate) || 0
  } catch {
    return 0
  }
}

/** Die schon gestellten Stufen eines Auftrags — Grundlage der Abzugszeilen. */
export async function vorstufen(
  payload: Payload,
  auftragId: number | string,
  req?: PayloadRequest,
): Promise<Vorstufe[]> {
  const { docs } = await payload.find({
    collection: 'outgoing-invoices',
    where: {
      auftrag: { equals: auftragId },
      stufe: { in: ['anzahlung', 'zwischen'] },
      status: { in: ['gestellt', 'bezahlt'] },
    },
    limit: 10,
    depth: 0,
    overrideAccess: true,
    sort: 'issueDate',
    req,
  })

  return docs.map((r) => ({
    nummer: r.invoiceNumber,
    stufe: r.stufe,
    datum: r.issueDate,
    netto: Number(r.netTotal) || 0,
  }))
}

/**
 * Legt den Entwurf für eine Stufe an — oder tut nichts.
 *
 * Nichts passiert, wenn der Auftrag gar nicht gestuft zahlt, wenn es die Stufe
 * schon gibt oder wenn der Betrag null wäre. Der Aufrufer muss das nicht
 * prüfen: Die Auslöser sitzen in Hooks, die auch dann feuern, wenn jemand
 * einen Datensatz nur anfasst — ein zweiter Entwurf für dieselbe Anzahlung
 * wäre die naheliegendste Art, hier Schaden anzurichten.
 */
export async function entwurfFuerStufe(
  payload: Payload,
  auftragId: number | string,
  stufe: Stufe,
  req?: PayloadRequest,
): Promise<number | string | null> {
  const auftrag = (await payload
    .findByID({ collection: 'jobs', id: auftragId, depth: 0, overrideAccess: true, req })
    .catch(() => null)) as Auftrag | null
  if (!auftrag) return null

  /*
   * PayPal-Bestellungen sind bezahlt, bevor der Auftrag überhaupt entsteht —
   * eine Anzahlungsrechnung für Geld, das längst da ist, wäre schlicht
   * falsch. Der Kauf auf Rechnung dagegen ist Projektgeschäft mit
   * Shop-Herkunft: Jedes Stück entsteht einzeln, bezahlt wird in Stufen —
   * für den läuft alles hier ganz normal durch.
   */
  if (auftrag.source === 'shop') {
    const bestellId = typeof (auftrag as { order?: unknown }).order === 'object'
      ? ((auftrag as { order?: { id?: number } }).order?.id)
      : (auftrag as { order?: number }).order
    if (!bestellId) return null
    const bestellung = await payload
      .findByID({ collection: 'orders', id: bestellId, depth: 0, overrideAccess: true, req })
      .catch(() => null)
    if (bestellung?.paymentProvider !== 'rechnung') return null
  }

  const plan = auftrag.zahlplan ?? {}
  const stufen = geplanteStufen(plan)
  if (!stufen.includes(stufe)) return null

  // Gibt es die Stufe schon? Dann bleibt es dabei — auch als verworfener Entwurf.
  const { totalDocs } = await payload.count({
    collection: 'outgoing-invoices',
    where: { auftrag: { equals: auftrag.id }, stufe: { equals: stufe } },
    overrideAccess: true,
    req,
  })
  if (totalDocs > 0) return null

  const gesamt = auftragsWert(auftrag.positions)
  const betraege = stufenBerechnen(gesamt, plan)
  const betrag = betraege[stufe]
  if (!(betrag > 0)) return null

  const satz = await steuersatz(payload, req)
  const bezug = auftrag.jobNumber ? `Auftrag ${auftrag.jobNumber}` : 'Auftrag'
  const anteil = (wert: unknown) => `${Number(wert) || 0} %`

  let posten: { description: string; quantity: number; unit: string; unitPrice: number; vatRate: number }[]

  if (stufe === 'schluss') {
    /*
     * Die Schlussrechnung führt die ganze Leistung auf und zieht die schon
     * gestellten Stufen einzeln wieder ab — mit Nummer, Datum und ihrer
     * Umsatzsteuer. Ohne benannten Abzug wäre dieselbe Steuer zweimal
     * erklärt, und beim Finanzamt zählt die höhere.
     */
    posten = (auftrag.positions ?? [])
      .filter((p) => p.description?.trim())
      .map((p) => ({
        description: p.description as string,
        quantity: Number(p.quantity) || 0,
        unit: 'Stück',
        unitPrice: Number(p.price) || 0,
        vatRate: satz,
      }))

    for (const zeile of abzugsZeilen(await vorstufen(payload, auftrag.id, req))) {
      posten.push({
        description: zeile.bezeichnung,
        quantity: 1,
        unit: 'Pauschal',
        unitPrice: zeile.betrag,
        vatRate: satz,
      })
    }
  } else {
    const prozent = stufe === 'anzahlung' ? plan.anzahlungProzent : plan.zwischenProzent
    const woran =
      stufe === 'zwischen' && auftrag.meilenstein?.bezeichnung
        ? `${auftrag.meilenstein.bezeichnung} — `
        : ''
    posten = [
      {
        description: `${BEZEICHNUNG[stufe]} ${anteil(prozent)}: ${woran}${auftrag.title ?? ''} (${bezug})`.trim(),
        quantity: 1,
        unit: 'Pauschal',
        unitPrice: betrag,
        vatRate: satz,
      },
    ]
  }

  const kontakt = typeof auftrag.contact === 'object' ? (auftrag.contact as { id?: number })?.id : auftrag.contact

  const rechnung = await payload.create({
    collection: 'outgoing-invoices',
    overrideAccess: true,
    req,
    data: {
      status: 'entwurf',
      stufe,
      auftrag: Number(auftrag.id),
      customer: typeof kontakt === 'number' ? kontakt : undefined,
      customerName: auftrag.customerName ?? undefined,
      items: posten,
      note:
        stufe === 'schluss'
          ? 'Bereits berechnete Stufen sind einzeln abgezogen.'
          : stufe === 'anzahlung'
            ? 'Fällig mit der Auftragsbestätigung, vor Fertigungsbeginn.'
            : 'Fällig mit dem erreichten Meilenstein.',
    },
  })

  payload.logger.info(
    `Rechnungsentwurf ${BEZEICHNUNG[stufe]} zu ${auftrag.jobNumber ?? auftrag.id} angelegt (${betrag} EUR netto)`,
  )

  /*
   * Die Meldung ist der eigentliche Punkt: Ein Entwurf, von dem niemand weiß,
   * ist so gut wie keiner. Vincent steht meist in der Werkstatt und nicht vor
   * der Rechnungsliste.
   *
   * Sie geht aber erst hinaus, wenn der Entwurf wirklich festgeschrieben ist
   * (siehe `lib/nachCommit.ts`). Vorher lief beides aus der offenen
   * Transaktion heraus: Das Handy meldete einen Entwurf, den die Rechnungs-
   * liste im selben Augenblick noch nicht kannte — und wegen des Abgleichs nie
   * mehr kennenlernte. Wer daraufhin ins Büro schaute, fand nichts und suchte
   * den Fehler bei sich.
   *
   * Das Live-Signal steht hier mit dabei: Der allgemeine Haken an der
   * Rechnungssammlung feuert weiterhin früh, das ist seit der Überlappung im
   * Abgleich folgenlos — dieses eine kommt garantiert danach.
   */
  /*
   * Gemeldet wird, was auf dem Entwurf steht — nicht, was der Zahlplan
   * vorsah.
   *
   * Beides ist meist dasselbe, aber nicht immer: Die Schlussrechnung zieht nur
   * Stufen ab, die auch gestellt sind. Liegt die Anzahlung noch als Entwurf
   * herum, steht auf der Schlussrechnung der volle Betrag — die Meldung nannte
   * bis eben trotzdem den geplanten Anteil. Wer sie las und den Entwurf
   * aufmachte, fand eine andere Zahl vor und wusste nicht, welche gilt.
   */
  const gemeldeterBetrag = Number((rechnung as { netTotal?: number | null }).netTotal) || betrag
  const betragText = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(gemeldeterBetrag)
  const wer = auftrag.customerName?.trim()
  const worum = auftrag.title?.trim()

  nachCommit(payload, 'outgoing-invoices', rechnung.id, async () => {
    liveMelden(payload, 'rechnungen', 'neu', rechnung.id)
    await benachrichtige(payload, {
      /*
       * „Entwurf" steht vorn, weil auf dem Sperrbildschirm nur der Anfang
       * ankommt — und „vorbereitet" ließ offen, ob schon jemand etwas
       * verschickt hat.
       */
      titel: wer
        ? `Entwurf: ${BEZEICHNUNG[stufe]} für ${wer}`
        : `Entwurf: ${BEZEICHNUNG[stufe]} ${bezug}`,
      text: `${bezug}${worum ? ` — ${worum}` : ''}: ${betragText} netto. Bitte prüfen und verschicken — von allein geht sie nicht raus.`,
      url: `/office/rechnungen/${rechnung.id}`,
      tag: `stufe-${auftrag.id}-${stufe}`,
    }).catch(() => undefined)
  })

  return rechnung.id
}

/**
 * Eine vollständige Rechnung aus einem Auftrag — von Hand angestoßen.
 *
 * Der Weg, der bislang fehlte. Alles darüber entsteht an Auslösern und nur
 * für Aufträge mit Zahlplan: Anzahlung bei der Bestätigung, Zwischenrechnung
 * am Meilenstein, Schlussrechnung bei „fertig". Ein ganz gewöhnlicher
 * Auftrag ohne Zahlplan bekam damit nie eine Rechnung — `geplanteStufen`
 * gibt für ihn eine leere Liste zurück, und `entwurfFuerStufe` steigt still
 * aus.
 *
 * Im Büro sah das so aus: Am Auftrag stand alles, was auf die Rechnung
 * gehört, aber es gab keinen Knopf, der sie anlegt. Wer trotzdem eine
 * brauchte, tippte sie im Rechnungsformular von Hand ab — mit jeder
 * Position, jeder Menge und jedem Preis, und mit der Gefahr, dass eine Zahl
 * abweicht und niemand es merkt.
 *
 * Deshalb `stufe: 'vollstaendig'` und nicht eine der drei Stufen: Das ist
 * keine Rate eines Zahlplans, sondern die ganze Leistung auf einem Blatt.
 * Dieselbe Kennzeichnung benutzt das Storno, und die Zahlungsleiste zeigt
 * sie schlicht als „Rechnung".
 *
 * Angelegt wird ein **Entwurf** — ohne Nummer und ohne Rechnungsdatum, wie
 * bei den Stufen auch. Beides entsteht erst beim Festschreiben, sonst rissen
 * verworfene Entwürfe Lücken in die Reihe.
 */
export async function rechnungAusAuftrag(
  payload: Payload,
  auftragId: number | string,
  req?: PayloadRequest,
): Promise<number | string | null> {
  const auftrag = (await payload
    .findByID({ collection: 'jobs', id: auftragId, depth: 0, overrideAccess: true, req })
    .catch(() => null)) as Auftrag | null
  if (!auftrag) return null

  const posten = (auftrag.positions ?? []).filter((p) => p.description?.trim())
  if (!posten.length) return null

  const satz = await steuersatz(payload, req)
  const kontakt =
    typeof auftrag.contact === 'object' ? (auftrag.contact as { id?: number })?.id : auftrag.contact

  const rechnung = await payload.create({
    collection: 'outgoing-invoices',
    overrideAccess: true,
    req,
    data: {
      status: 'entwurf',
      stufe: 'vollstaendig',
      auftrag: Number(auftrag.id),
      customer: typeof kontakt === 'number' ? kontakt : undefined,
      customerName: auftrag.customerName ?? undefined,
      items: posten.map((p) => ({
        description: p.description as string,
        quantity: Number(p.quantity) || 0,
        unit: 'Stück',
        unitPrice: Number(p.price) || 0,
        vatRate: satz,
      })),
    },
  })

  payload.logger.info(
    `Rechnungsentwurf zu ${auftrag.jobNumber ?? auftrag.id} von Hand angelegt (${posten.length} Positionen)`,
  )

  /*
   * Gemeldet wird wie bei den Stufen — erst nach dem Festschreiben, sonst
   * kennt die Rechnungsliste den Entwurf noch nicht, wenn die Meldung
   * ankommt (siehe lib/nachCommit.ts).
   *
   * Anders als dort ist hier jemand am Gerät, der gerade selbst getippt hat:
   * Die Meldung ist deshalb keine Nachricht an einen Abwesenden, sondern die
   * Bestätigung für den, der es angestoßen hat — und für jeden anderen im
   * Büro der Hinweis, dass da ein Entwurf liegt.
   */
  const wer = auftrag.customerName?.trim()
  const worum = auftrag.title?.trim()
  const bezug = auftrag.jobNumber ? `Auftrag ${auftrag.jobNumber}` : 'Auftrag'
  const betragText = new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(Number((rechnung as { netTotal?: number | null }).netTotal) || 0)

  nachCommit(payload, 'outgoing-invoices', rechnung.id, async () => {
    liveMelden(payload, 'rechnungen', 'neu', rechnung.id)
    await benachrichtige(payload, {
      titel: wer ? `Entwurf: Rechnung für ${wer}` : `Entwurf: Rechnung ${bezug}`,
      text: `${bezug}${worum ? ` — ${worum}` : ''}: ${betragText} netto. Bitte prüfen und verschicken — von allein geht sie nicht raus.`,
      url: `/office/rechnungen/${rechnung.id}`,
      tag: `rechnung-${auftrag.id}`,
    }).catch(() => undefined)
  })

  return rechnung.id
}
