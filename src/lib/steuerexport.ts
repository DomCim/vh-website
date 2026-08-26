import type { Payload } from 'payload'

import { AUSGABEN_KATEGORIEN } from '../collections/Expenses'
import { jahresZeitraum, monatsZeitraum } from './office'

/**
 * Zusammenstellung für den Steuerberater.
 *
 * Beträge stehen so da, wie sie auf den Belegen stehen. Wo nur ein Bruttowert
 * erfasst ist, wird die Steuer nicht heimlich herausgerechnet — sie bleibt
 * leer und fällt damit auf, statt eine Genauigkeit vorzutäuschen, die es
 * nicht gibt.
 */

export type Steuerzeile = {
  art: 'einnahme' | 'ausgabe'
  quelle: string
  datum: string
  nummer: string
  partner: string
  bezeichnung: string
  kategorie: string
  /**
   * Der Schlüssel der Kategorie, nicht ihr Text — für die Kontenzuordnung.
   *
   * `kategorie` ist die Beschriftung fürs Auge („Material & Rohstoffe"), und
   * die darf sich ändern, ohne dass eine Buchung auf einem anderen Konto
   * landet. Der DATEV-Export schlägt deshalb hierüber nach (lib/datev.ts).
   * Bei Einnahmen bleibt das Feld leer — dort gibt es keine Kategorie,
   * sondern nur Erlöse.
   */
  schluessel?: string | null
  /** Ist bei dieser Rechnung Reverse Charge im Spiel? Entscheidet das Erlöskonto. */
  reverseCharge?: boolean
  netto: number | null
  steuersatz: number | null
  steuer: number | null
  brutto: number
  beleg: string | null
}

export type Steuerbericht = {
  jahr: number
  zeilen: Steuerzeile[]
  einnahmen: number
  ausgaben: number
  ergebnis: number
  ausgabenNachKategorie: { kategorie: string; summe: number; anzahl: number }[]
  steuerEinnahmen: number
  steuerAusgaben: number
  ohneBeleg: number
  inventurWert: number | null
  inventurStichtag: string | null
}

const runden = (n: number) => Math.round(n * 100) / 100
const KATEGORIE_TEXT = Object.fromEntries(AUSGABEN_KATEGORIEN.map((k) => [k.value, k.label]))

export async function steuerbericht(
  payload: Payload,
  jahr: number,
  /** 1–12: nur diesen Monat — fürs Monatspaket an den Steuerberater */
  monat?: number,
): Promise<Steuerbericht> {
  const { von, bis } = monat ? monatsZeitraum(jahr, monat) : jahresZeitraum(jahr)

  const [bestellungen, rechnungen, ausgaben, inventuren, settings] = await Promise.all([
    payload.find({
      collection: 'orders',
      where: {
        and: [
          { status: { in: ['paid', 'inProduction', 'shipped'] } },
          { createdAt: { greater_than_equal: von } },
          { createdAt: { less_than: bis } },
        ],
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'outgoing-invoices',
      where: {
        and: [
          // „storniert" gehört dazu: Original und Gegenrechnung erscheinen
          // beide und heben sich auf — sonst fehlte der Betrag doppelt.
          { status: { in: ['gestellt', 'bezahlt', 'storniert'] } },
          { issueDate: { greater_than_equal: von } },
          { issueDate: { less_than: bis } },
        ],
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'expenses',
      where: {
        and: [
          { deductible: { equals: true } },
          { invoiceDate: { greater_than_equal: von } },
          { invoiceDate: { less_than: bis } },
        ],
      },
      limit: 3000,
      depth: 1,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'stocktakes',
      where: { and: [{ status: { equals: 'abgeschlossen' } }, { date: { less_than: bis } }] },
      sort: '-date',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    }),
    payload.findGlobal({ slug: 'site-settings', depth: 0 }),
  ])

  const standardSatz = settings?.company?.vatRate ?? 20
  const zeilen: Steuerzeile[] = []

  for (const o of bestellungen.docs) {
    const brutto = o.total ?? 0
    const netto = runden(brutto / (1 + standardSatz / 100))
    zeilen.push({
      art: 'einnahme',
      quelle: 'Shop',
      datum: String(o.createdAt).slice(0, 10),
      nummer: o.orderNumber,
      partner: o.customer?.name ?? '',
      bezeichnung: (o.items ?? []).map((i) => `${i.quantity}× ${i.titleSnapshot}`).join(', '),
      kategorie: 'Warenverkauf',
      netto,
      steuersatz: standardSatz,
      steuer: runden(brutto - netto),
      brutto,
      beleg: null,
    })
  }

  for (const r of rechnungen.docs) {
    // Der Steuerberater soll das Paar ohne Rückfrage erkennen.
    const stornoHinweis = r.stornoVon
      ? ' — Storno'
      : r.status === 'storniert'
        ? ' — storniert'
        : ''
    zeilen.push({
      art: 'einnahme',
      quelle: 'Projektrechnung',
      datum: String(r.issueDate ?? '').slice(0, 10),
      nummer: r.invoiceNumber ?? '',
      partner: r.customerName ?? '',
      bezeichnung: (r.items ?? []).map((p) => p.description).join(', '),
      kategorie: (r.reverseCharge ? 'Leistung (Reverse Charge)' : 'Leistung') + stornoHinweis,
      reverseCharge: Boolean(r.reverseCharge),
      netto: r.subtotal ?? null,
      steuersatz: r.reverseCharge ? 0 : null,
      steuer: r.vatTotal ?? null,
      brutto: r.total ?? 0,
      beleg: null,
    })
  }

  for (const a of ausgaben.docs) {
    const dok = typeof a.document === 'object' ? a.document : null
    zeilen.push({
      art: 'ausgabe',
      quelle: 'Beleg',
      datum: String(a.invoiceDate ?? '').slice(0, 10),
      nummer: a.invoiceNumber ?? '',
      partner: a.supplierName ?? '',
      bezeichnung: a.title ?? '',
      kategorie: KATEGORIE_TEXT[a.category] ?? a.category,
      schluessel: a.category ?? null,
      netto: a.netAmount ?? null,
      steuersatz: a.vatRate ?? null,
      steuer: a.vatAmount ?? null,
      brutto: a.grossAmount ?? 0,
      beleg: dok?.filename ?? null,
    })
  }

  zeilen.sort((x, y) => x.datum.localeCompare(y.datum))

  const einnahmen = runden(
    zeilen.filter((z) => z.art === 'einnahme').reduce((s, z) => s + z.brutto, 0),
  )
  const ausgabenSumme = runden(
    zeilen.filter((z) => z.art === 'ausgabe').reduce((s, z) => s + z.brutto, 0),
  )

  const nachKategorie = new Map<string, { summe: number; anzahl: number }>()
  for (const z of zeilen.filter((z) => z.art === 'ausgabe')) {
    const bisher = nachKategorie.get(z.kategorie) ?? { summe: 0, anzahl: 0 }
    nachKategorie.set(z.kategorie, {
      summe: runden(bisher.summe + z.brutto),
      anzahl: bisher.anzahl + 1,
    })
  }

  return {
    jahr,
    zeilen,
    einnahmen,
    ausgaben: ausgabenSumme,
    ergebnis: runden(einnahmen - ausgabenSumme),
    ausgabenNachKategorie: [...nachKategorie.entries()]
      .map(([kategorie, w]) => ({ kategorie, ...w }))
      .sort((a, b) => b.summe - a.summe),
    steuerEinnahmen: runden(
      zeilen.filter((z) => z.art === 'einnahme').reduce((s, z) => s + (z.steuer ?? 0), 0),
    ),
    steuerAusgaben: runden(
      zeilen.filter((z) => z.art === 'ausgabe').reduce((s, z) => s + (z.steuer ?? 0), 0),
    ),
    ohneBeleg: zeilen.filter((z) => z.art === 'ausgabe' && !z.beleg).length,
    inventurWert: inventuren.docs[0]?.totalValue ?? null,
    inventurStichtag: inventuren.docs[0]?.date ? String(inventuren.docs[0].date).slice(0, 10) : null,
  }
}

/** Tabelle als CSV — Semikolon und Komma, damit Excel es in Europa direkt öffnet */
export function alsCsv(bericht: Steuerbericht): string {
  const zahl = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
  const feld = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`

  const kopf = [
    'Art',
    'Quelle',
    'Datum',
    'Nummer',
    'Partner',
    'Bezeichnung',
    'Kategorie',
    'Netto',
    'Steuersatz',
    'Steuer',
    'Brutto',
    'Belegdatei',
  ].join(';')

  const zeilen = bericht.zeilen.map((z) =>
    [
      z.art === 'einnahme' ? 'Einnahme' : 'Ausgabe',
      feld(z.quelle),
      z.datum,
      feld(z.nummer),
      feld(z.partner),
      feld(z.bezeichnung),
      feld(z.kategorie),
      zahl(z.netto),
      zahl(z.steuersatz),
      zahl(z.steuer),
      zahl(z.brutto),
      feld(z.beleg ?? ''),
    ].join(';'),
  )

  return ['﻿' + kopf, ...zeilen].join('\r\n')
}
