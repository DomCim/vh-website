import fs from 'fs/promises'
import path from 'path'

import JSZip from 'jszip'
import type { Payload } from 'payload'

import { rechnungDokument } from './dokumente'
import { monatsZeitraum } from './office'
import { alsCsv, steuerbericht, type Steuerbericht } from './steuerexport'

/**
 * Das Monatspaket für den Steuerberater.
 *
 * Vincent schickt seine Ein- und Ausgaben monatlich an die Kanzlei — bisher
 * von Hand zusammengesucht. Hier entsteht das Paket auf Knopfdruck: eine
 * ZIP-Datei mit der Buchungsliste (dieselbe CSV wie im Jahres-Export, nur auf
 * den Monat begrenzt), den Scans aller Ausgabenbelege und den PDFs aller
 * Ausgangsrechnungen des Monats. Verschickt wird es wahlweise gleich per Mail.
 *
 * Belege ohne Scan fehlen im Paket zwangsläufig — ihre Zahl steht im
 * Ergebnis, damit der Absender es weiß, bevor die Kanzlei nachfragt.
 */

const MEDIEN = process.env.MEDIA_DIR || path.join(process.cwd(), 'media')

/** Dateinamen fürs ZIP entschärfen — Schrägstriche wären dort Ordner */
const sauber = (name: string) => name.replace(/[^\wäöüÄÖÜß.\- ]+/g, '_')

export type Steuerpaket = {
  zip: Buffer
  dateiname: string
  bericht: Steuerbericht
  /** Zahl der Ausgaben im Monat, zu denen kein Scan hinterlegt ist */
  ohneScan: number
  /** Zahl der Dateien im Paket (ohne die CSV) */
  dateien: number
}

export async function steuerpaket(
  payload: Payload,
  jahr: number,
  monat: number,
): Promise<Steuerpaket> {
  const { von, bis } = monatsZeitraum(jahr, monat)
  const bericht = await steuerbericht(payload, jahr, monat)

  const zip = new JSZip()
  const mm = String(monat).padStart(2, '0')
  zip.file(`buchungen-${jahr}-${mm}.csv`, alsCsv(bericht))

  let dateien = 0

  // Die Scans der Ausgabenbelege, wie sie erfasst wurden
  const ausgaben = await payload.find({
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
  })
  let ohneScan = 0
  for (const beleg of ausgaben.docs) {
    const medium = typeof beleg.document === 'object' ? beleg.document : null
    if (!medium?.filename) {
      ohneScan += 1
      continue
    }
    try {
      const inhalt = await fs.readFile(path.join(MEDIEN, medium.filename))
      const wer = beleg.supplierName || beleg.title || 'beleg'
      zip.file(`belege/${sauber(`${beleg.invoiceDate?.slice(0, 10)} ${wer} ${medium.filename}`)}`, inhalt)
      dateien += 1
    } catch (err) {
      // Ein fehlender Scan auf der Platte ist ein Datenproblem, kein Grund,
      // das ganze Paket scheitern zu lassen — er zählt wie „kein Scan".
      payload.logger.error({ err }, `Steuerpaket: Belegdatei fehlt (${medium.filename})`)
      ohneScan += 1
    }
  }

  // Die Ausgangsrechnungen des Monats, frisch gerendert — inklusive Storni,
  // damit die Kanzlei beide Blätter eines Paars vor sich hat
  const rechnungen = await payload.find({
    collection: 'outgoing-invoices',
    where: {
      and: [
        { status: { in: ['gestellt', 'bezahlt', 'storniert'] } },
        { issueDate: { greater_than_equal: von } },
        { issueDate: { less_than: bis } },
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  for (const r of rechnungen.docs) {
    try {
      const doc = await rechnungDokument(payload, r.id)
      zip.file(`rechnungen/${sauber(doc.dateiname)}`, doc.datei)
      dateien += 1
    } catch (err) {
      payload.logger.error({ err }, `Steuerpaket: Rechnung ${r.invoiceNumber} nicht renderbar`)
    }
  }

  const inhalt = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return {
    zip: inhalt,
    dateiname: `vh-monatspaket-${jahr}-${mm}.zip`,
    bericht,
    ohneScan,
    dateien,
  }
}
