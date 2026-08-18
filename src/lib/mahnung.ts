import PDFDocument from 'pdfkit'

import type { CompanyInfo } from './mail'
import { briefkopf, fusszeile, LINKS, RECHTS, schriftenSetzen } from './pdfkopf'

/**
 * Zahlungserinnerung und Mahnung.
 *
 * Bisher gab es die Rechnung — und danach nichts. Wer nicht zahlt, wurde
 * höchstens angerufen, wenn es jemandem einfiel. Das hier ist der Rest des
 * Wegs, in drei Stufen:
 *
 *   1. Zahlungserinnerung — höflich, ohne Kosten. Meistens ist es wirklich
 *      nur übersehen worden.
 *   2. Mahnung — mit Verzugszinsen und der gesetzlichen Pauschale für
 *      Beitreibungskosten von 40 € (Art. L441-10 Code de commerce). Die steht
 *      dem Betrieb zu, sobald Verzug eingetreten ist; sie zu verschenken wäre
 *      freundlich, aber teuer.
 *   3. Letzte Mahnung — mit Frist und der Ankündigung, was danach kommt.
 */

export type Mahnstufe = 1 | 2 | 3

export type MahnungsDaten = {
  stufe: Mahnstufe
  rechnungsnummer: string
  rechnungsdatum?: string | null
  faelligAm?: string | null
  /** Offener Bruttobetrag der Rechnung */
  betrag: number
  /** Gesetzliche Pauschale für Beitreibungskosten — ab Stufe 2 */
  pauschale?: number
  /** Zahlungsfrist dieser Mahnung */
  fristBis: Date
  empfaenger: { name?: string | null; anschrift?: string[] }
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

const tag = (v?: string | null | Date) =>
  v ? new Date(v).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')

export const MAHN_TITEL: Record<Mahnstufe, string> = {
  1: 'Zahlungserinnerung',
  2: 'Mahnung',
  3: 'Letzte Mahnung',
}

/** Tage zwischen Fälligkeit und heute — für den Satz „seit X Tagen überfällig" */
export function tageUeberfaellig(faelligAm?: string | null): number {
  if (!faelligAm) return 0
  const faellig = new Date(faelligAm)
  faellig.setHours(0, 0, 0, 0)
  const heute = new Date()
  heute.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((heute.getTime() - faellig.getTime()) / 86400000))
}

function anrede(name?: string | null): string {
  return name ? `Guten Tag ${name},` : 'Guten Tag,'
}

function absaetze(daten: MahnungsDaten, company?: CompanyInfo): string[] {
  const tage = tageUeberfaellig(daten.faelligAm)
  const seit = tage > 0 ? ` — seit ${tage} ${tage === 1 ? 'Tag' : 'Tagen'} überfällig` : ''
  const bezug = `unsere Rechnung ${daten.rechnungsnummer} vom ${tag(daten.rechnungsdatum)} über ${euro(daten.betrag)} war am ${tag(daten.faelligAm)} zur Zahlung fällig${seit}. Ein Zahlungseingang ist bei uns bisher nicht verbucht.`

  if (daten.stufe === 1) {
    return [
      anrede(daten.empfaenger.name),
      bezug,
      'Vermutlich ist die Rechnung im Alltag untergegangen — das passiert. Wir möchten Sie deshalb freundlich daran erinnern und bitten um Ausgleich bis zum ' +
        `${tag(daten.fristBis)}.`,
      'Haben Sie die Zahlung bereits veranlasst, betrachten Sie dieses Schreiben bitte als gegenstandslos. Sollte mit der Rechnung etwas nicht stimmen, melden Sie sich gern — dann klären wir das kurz.',
    ]
  }

  if (daten.stufe === 2) {
    return [
      anrede(daten.empfaenger.name),
      bezug,
      `Trotz unserer Zahlungserinnerung ist der Betrag offen geblieben. Wir setzen Ihnen deshalb eine letzte freiwillige Frist bis zum ${tag(daten.fristBis)}.`,
      daten.pauschale
        ? `Mit dem Verzug ist die gesetzliche Pauschale für Beitreibungskosten in Höhe von ${euro(daten.pauschale)} fällig geworden (Art. L441-10 Code de commerce); sie ist unten aufgeführt. Verzugszinsen behalten wir uns vor.`
        : 'Verzugszinsen behalten wir uns vor.',
      company?.latePaymentNote ?? '',
    ].filter(Boolean)
  }

  return [
    anrede(daten.empfaenger.name),
    bezug,
    `Zahlungserinnerung und Mahnung sind ohne Reaktion geblieben. Wir fordern Sie hiermit letztmalig auf, den offenen Betrag bis zum ${tag(daten.fristBis)} auszugleichen.`,
    'Geht die Zahlung bis dahin nicht ein, geben wir die Forderung ohne weitere Ankündigung zur gerichtlichen Beitreibung ab. Die dadurch entstehenden Kosten tragen Sie.',
    'Uns wäre ein Anruf lieber als ein Verfahren. Wenn es gerade klemmt, sprechen Sie uns an — eine Ratenzahlung lässt sich vereinbaren.',
  ]
}

export async function mahnungPdf(
  daten: MahnungsDaten,
  company?: CompanyInfo,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  schriftenSetzen(doc)

  const teile: Buffer[] = []
  doc.on('data', (t: Buffer) => teile.push(t))
  const fertig = new Promise<Buffer>((auf) => doc.on('end', () => auf(Buffer.concat(teile))))

  const fussZeichnen = fusszeile(doc, company)
  const cortenStrich = briefkopf(doc, company)

  // ── Empfänger ─────────────────────────────────────────────────────────────
  doc.moveDown(2)
  doc.fontSize(10)
  if (daten.empfaenger.name) doc.text(daten.empfaenger.name, LINKS, doc.y)
  for (const zeile of daten.empfaenger.anschrift ?? []) if (zeile) doc.text(zeile)

  // ── Betreff ───────────────────────────────────────────────────────────────
  doc.moveDown(2)
  doc.fontSize(9).fillColor('#666').text(tag(new Date()), LINKS, doc.y, {
    width: RECHTS - LINKS,
    align: 'right',
  })
  doc.fillColor('#000')
  doc.fontSize(14).text(MAHN_TITEL[daten.stufe], LINKS, doc.y)
  cortenStrich()
  doc.fontSize(10).text(`zur Rechnung ${daten.rechnungsnummer}`)

  // ── Text ──────────────────────────────────────────────────────────────────
  doc.moveDown(1.2)
  for (const absatz of absaetze(daten, company)) {
    doc.fontSize(10).text(absatz, LINKS, doc.y, { width: RECHTS - LINKS, align: 'left' })
    doc.moveDown(0.8)
  }

  // ── Aufstellung ───────────────────────────────────────────────────────────
  doc.moveDown(0.4)
  doc.moveTo(LINKS, doc.y).lineTo(RECHTS, doc.y).strokeColor('#ddd').stroke()
  doc.moveDown(0.6)

  const zeile = (beschriftung: string, wert: string, fett = false) => {
    const y = doc.y
    doc.fontSize(fett ? 11 : 10)
    doc.text(beschriftung, LINKS, y, { width: 330 })
    doc.text(wert, 380, y, { width: RECHTS - 380, align: 'right' })
    doc.moveDown(0.4)
  }

  zeile(`Rechnung ${daten.rechnungsnummer}`, euro(daten.betrag))
  if (daten.pauschale) {
    zeile('Pauschale für Beitreibungskosten', euro(daten.pauschale))
  }
  zeile('Zu zahlen', euro(daten.betrag + (daten.pauschale ?? 0)), true)

  doc.moveDown(0.6)
  doc.fontSize(10).text(`Zahlbar bis: ${tag(daten.fristBis)}`, LINKS, doc.y)

  if (company?.iban) {
    doc.moveDown(0.8)
    doc.fontSize(9).fillColor('#444')
    doc.text(
      `Bankverbindung: IBAN ${company.iban}${company.bic ? ` · BIC ${company.bic}` : ''}`,
      LINKS,
      doc.y,
      { width: RECHTS - LINKS },
    )
    doc.fillColor('#000')
  }

  doc.moveDown(1.5)
  doc.fontSize(10).text('Mit freundlichen Grüßen', LINKS, doc.y)
  doc.moveDown(0.3)
  doc.text(company?.legalName || company?.name || 'Vincent Hellmann')

  fussZeichnen()
  doc.end()
  return fertig
}
