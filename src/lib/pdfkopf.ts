import fs from 'fs'
import path from 'path'

import { BRONZE, type CompanyInfo, firmenzeile, pflichtangaben } from './mail'

/**
 * Gemeinsames Blattbild aller Dokumente, die das Haus verlassen.
 *
 * Rechnung, Angebot und Mahnung sollen wie aus einer Hand aussehen — dasselbe
 * Logo, derselbe Corten-Strich, dieselbe Pflichtangaben-Fußzeile. Läge das in
 * jeder Datei noch einmal, liefe es über kurz oder lang auseinander.
 */

export const LINKS = 50
export const RECHTS = 545

/**
 * Schriften für PDF/A.
 *
 * Die in PDF eingebauten Standardschriften sind nicht eingebettet — PDF/A
 * verlangt aber genau das, sonst sieht die Rechnung in zehn Jahren womöglich
 * anders aus. Liberation Sans liegt deshalb im Verzeichnis public/fonts und
 * ist in den Maßen mit Helvetica verträglich; das Blattbild ändert sich
 * dadurch nicht.
 */
export const SCHRIFTEN = {
  normal: path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Regular.ttf'),
  fett: path.join(process.cwd(), 'public', 'fonts', 'LiberationSans-Bold.ttf'),
}

export const schriftenDa = (): boolean =>
  fs.existsSync(SCHRIFTEN.normal) && fs.existsSync(SCHRIFTEN.fett)

export function schriftenSetzen(doc: PDFKit.PDFDocument): void {
  if (!schriftenDa()) return
  doc.registerFont('Sans', SCHRIFTEN.normal)
  doc.registerFont('Sans-Fett', SCHRIFTEN.fett)
  doc.font('Sans')
}

/**
 * Pflichtangaben-Fußzeile auf jedem Blatt.
 *
 * Firmierung, SIRET und TVA gehören auf jede Seite, die das Haus verlässt —
 * nicht nur auf die erste eines mehrseitigen Angebots.
 */
export function fusszeile(doc: PDFKit.PDFDocument, company?: CompanyInfo): () => void {
  const angaben = pflichtangaben(company).join(' · ')
  const zeichnen = () => {
    if (!angaben) return
    const yAlt = doc.y
    const untenAlt = doc.page.margins.bottom
    doc.page.margins.bottom = 0
    doc
      .fontSize(7)
      .fillColor('#999')
      .text(angaben, LINKS, doc.page.height - 38, { width: RECHTS - LINKS, align: 'center' })
    doc.page.margins.bottom = untenAlt
    doc.fillColor('#000').fontSize(10)
    doc.y = yAlt
  }
  doc.on('pageAdded', zeichnen)
  return zeichnen
}

/**
 * Corten-Strich wie auf der Website: läuft nach rechts weich aus, je größer
 * die Überschrift, desto länger der Strich. Im PDF als echter Verlauf —
 * anders als in der Mail muss hier kein Outlook mitspielen.
 */
export function cortenStrichFuer(doc: PDFKit.PDFDocument) {
  return (gross = false) => {
    const breite = gross ? 112 : 40
    const hoehe = gross ? 2.5 : 1.5
    const y = doc.y + (gross ? 4 : 3)
    const verlauf = doc.linearGradient(LINKS, y, LINKS + breite, y)
    verlauf.stop(0, BRONZE).stop(0.3, BRONZE).stop(1, BRONZE, 0)
    doc.rect(LINKS, y, breite, hoehe).fill(verlauf)
    doc.fillColor('#000')
    doc.y = y + hoehe + (gross ? 10 : 7)
  }
}

/**
 * Briefkopf: Logo, Corten-Strich, Absenderzeile.
 *
 * Das Logo als Bild statt gesperrter Schrift — wer ein Angebot über mehrere
 * tausend Euro bekommt, soll dieselbe Marke sehen wie auf der Website.
 */
export function briefkopf(
  doc: PDFKit.PDFDocument,
  company?: CompanyInfo,
): (gross?: boolean) => void {
  const cortenStrich = cortenStrichFuer(doc)

  const logo = path.join(process.cwd(), 'public', 'logo.png')
  let kopfhoehe = 0
  try {
    if (fs.existsSync(logo)) {
      doc.image(logo, LINKS, 48, { width: 190 })
      // 1994 × 140 — daraus die Höhe bei 190 pt Breite
      kopfhoehe = Math.round((190 * 140) / 1994)
      doc.y = 48 + kopfhoehe + 10
    }
  } catch {
    // Ohne Logo geht es auch weiter, nur eben mit Schriftzug
  }
  if (!kopfhoehe) {
    doc.fontSize(16).text('VINCENT HELLMANN', { characterSpacing: 2 })
    doc.moveDown(0.2)
  }

  cortenStrich(true)

  doc.fontSize(9).fillColor('#666')
  const absender = [firmenzeile(company), company?.address].filter(Boolean).join(' · ')
  if (absender) doc.text(absender, LINKS, doc.y, { width: RECHTS - LINKS })
  doc.fillColor('#000')

  return cortenStrich
}
