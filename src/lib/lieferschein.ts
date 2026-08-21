import PDFDocument from 'pdfkit'

import type { CompanyInfo } from './mail'
import { briefkopf, fusszeile, LINKS, RECHTS, schriftenSetzen } from './pdfkopf'

/**
 * Lieferschein (Bon de livraison).
 *
 * Was mitfährt, wenn ein Stück das Haus verlässt: was geliefert wurde, wohin,
 * und zwei Zeilen zum Unterschreiben. Bewusst ohne Preise — der Lieferschein
 * geht oft an eine Baustelle oder einen Hausmeister, und die Rechnung geht
 * niemanden dort etwas an.
 *
 * Bei Montagen ist die Unterschrift zugleich das Abnahmeprotokoll: Ab dann
 * läuft die Gewährleistungsfrist, und bei einer Beschädigung ist geklärt,
 * dass das Stück heil ankam.
 */

export type LieferscheinDaten = {
  nummer: string
  datum?: string | null
  auftrag?: string | null
  bestellreferenz?: string | null
  empfaenger: { name?: string | null; anschrift?: string[] }
  positionen: {
    bezeichnung: string
    menge: number
    einheit?: string | null
    /** Pfad zu einem kleinen Artikelbild — wer packt, sieht dann, was gemeint ist */
    bild?: string | null
  }[]
  /**
   * Was der Auftraggeber selbst beigestellt hat.
   *
   * Steht getrennt von den Positionen und nicht darunter: Es ist keine
   * Lieferung, sondern sein eigenes Material, das zurückkommt. Wer die Ware
   * annimmt, muss beides auseinanderhalten können — sonst quittiert er den
   * Empfang von etwas, das ihm ohnehin gehört.
   */
  beistellung?: { bezeichnung: string; menge: number; einheit?: string | null }[]
  hinweis?: string | null
  /**
   * Die geleistete Unterschrift — dann wird aus dem Blatt das Abnahmeprotokoll.
   *
   * Der Kunde unterschreibt auf dem Telefon, das Bild kommt hier als PNG an
   * und steht über der rechten Linie, wo sonst von Hand unterschrieben würde.
   * Ab diesem Blatt läuft die Gewährleistung — deshalb stehen Name, Ort und
   * Zeitpunkt ausgeschrieben darunter.
   */
  abnahme?: { bild: Buffer; name?: string | null; ort?: string | null; datum: Date }
}

const tag = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')

export async function lieferscheinPdf(
  daten: LieferscheinDaten,
  company?: CompanyInfo,
): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  schriftenSetzen(doc)

  const teile: Buffer[] = []
  doc.on('data', (t: Buffer) => teile.push(t))
  const fertig = new Promise<Buffer>((auf) => doc.on('end', () => auf(Buffer.concat(teile))))

  const fussZeichnen = fusszeile(doc, company)
  const cortenStrich = briefkopf(doc, company)

  doc.moveDown(2)
  doc.fontSize(10)
  if (daten.empfaenger.name) doc.text(daten.empfaenger.name, LINKS, doc.y)
  for (const zeile of daten.empfaenger.anschrift ?? []) if (zeile) doc.text(zeile)

  doc.moveDown(2)
  doc.fontSize(14).text(daten.abnahme ? 'Abnahmeprotokoll' : 'Lieferschein', LINKS, doc.y)
  cortenStrich()
  doc.fontSize(10)
  doc.text(`Lieferscheinnummer: ${daten.nummer}`)
  doc.text(`Datum: ${tag(daten.datum)}`)
  if (daten.auftrag) doc.text(`Auftrag: ${daten.auftrag}`)
  if (daten.bestellreferenz) doc.text(`Ihre Bestellung: ${daten.bestellreferenz}`)

  // ── Positionen ────────────────────────────────────────────────────────────
  doc.moveDown(1.4)
  const mengeSpalte = 430

  doc.fontSize(8).fillColor('#666')
  const kopfY = doc.y
  doc.text('Bezeichnung', LINKS, kopfY, { width: mengeSpalte - LINKS - 8 })
  doc.text('Menge', mengeSpalte, kopfY, { width: RECHTS - mengeSpalte, align: 'right' })
  doc.fillColor('#000')
  doc.moveDown(0.4)
  doc.moveTo(LINKS, doc.y).lineTo(RECHTS, doc.y).strokeColor('#ddd').stroke()
  doc.moveDown(0.5)

  const BILD = 30

  for (const p of daten.positionen) {
    const y = doc.y
    let textLinks = LINKS
    if (p.bild) {
      try {
        doc.image(p.bild, LINKS, y, { fit: [BILD, BILD] })
        textLinks = LINKS + BILD + 8
      } catch (err) {
        // Ein fehlendes Bild hält keinen Lieferschein auf — aber es soll
        // im Protokoll stehen.
        console.warn('Artikelbild nicht eingebettet:', err)
      }
    }
    doc.fontSize(10).text(p.bezeichnung, textLinks, y, { width: mengeSpalte - textLinks - 8 })
    const ende = p.bild ? Math.max(doc.y, y + BILD) : doc.y
    doc.text(`${p.menge}${p.einheit ? ` ${p.einheit}` : ''}`, mengeSpalte, y, {
      width: RECHTS - mengeSpalte,
      align: 'right',
    })
    doc.y = Math.max(ende, y + 12)
    doc.moveDown(0.3)
  }

  doc.moveDown(0.4)
  doc.moveTo(LINKS, doc.y).lineTo(RECHTS, doc.y).strokeColor('#ddd').stroke()

  if (daten.beistellung?.length) {
    doc.moveDown(0.9)
    doc.fontSize(10).fillColor('#000').text('Von Ihnen beigestelltes Material', LINKS, doc.y)
    doc.moveDown(0.3)
    doc.fontSize(9).fillColor('#444')
    for (const b of daten.beistellung) {
      const y = doc.y
      doc.text(b.bezeichnung, LINKS, y, { width: mengeSpalte - LINKS - 8 })
      doc.text(`${b.menge}${b.einheit ? ` ${b.einheit}` : ''}`, mengeSpalte, y, {
        width: RECHTS - mengeSpalte,
        align: 'right',
      })
      doc.moveDown(0.2)
    }
    doc.fillColor('#000')
  }

  if (daten.hinweis) {
    doc.moveDown(0.8)
    doc.fontSize(9).fillColor('#444').text(daten.hinweis, LINKS, doc.y, { width: RECHTS - LINKS })
    doc.fillColor('#000')
  }

  doc.moveDown(1)
  doc.fontSize(9).fillColor('#444')
  doc.text(
    daten.abnahme
      ? 'Die Lieferung bzw. Leistung wurde geprüft und wie beschrieben übernommen.'
      : 'Bitte prüfen Sie die Lieferung auf sichtbare Schäden und bestätigen Sie den Empfang mit Ihrer Unterschrift.',
    LINKS,
    doc.y,
    { width: RECHTS - LINKS },
  )
  doc.fillColor('#000')

  // ── Unterschriften ────────────────────────────────────────────────────────
  doc.moveDown(4)
  // Der Block bleibt beisammen: Eine Unterschrift, deren Linie auf der
  // nächsten Seite steht, wäre kein Protokoll, sondern ein Rätsel.
  if (doc.y > 660) doc.addPage()
  const y = doc.y
  const breite = 210

  if (daten.abnahme) {
    try {
      // Die Unterschrift sitzt über der rechten Linie — wie auf Papier
      doc.image(daten.abnahme.bild, RECHTS - breite, y - 52, { fit: [breite, 50] })
    } catch (err) {
      console.warn('Unterschrift nicht eingebettet:', err)
    }
  }

  doc.moveTo(LINKS, y).lineTo(LINKS + breite, y).strokeColor('#999').stroke()
  doc.moveTo(RECHTS - breite, y).lineTo(RECHTS, y).strokeColor('#999').stroke()
  doc.fontSize(8).fillColor('#666')
  doc.text('Übergeben (Werkstatt)', LINKS, y + 4, { width: breite })
  if (daten.abnahme) {
    const wann = daten.abnahme.datum.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    const wer = [daten.abnahme.name, daten.abnahme.ort].filter(Boolean).join(', ')
    doc.text(`Abgenommen${wer ? `: ${wer}` : ''} — ${wann} Uhr`, RECHTS - breite, y + 4, {
      width: breite,
      align: 'right',
    })
  } else {
    doc.text('Empfangen (Datum, Unterschrift)', RECHTS - breite, y + 4, {
      width: breite,
      align: 'right',
    })
  }
  doc.fillColor('#000')

  fussZeichnen()
  doc.end()
  return fertig
}
