import PDFDocument from 'pdfkit'

import { schriftenSetzen } from './pdfkopf'

/**
 * Das Druckblatt der Laufmarken — vier Stück DIN A6 je A4.
 *
 * A6 und nicht kleiner, auf Dominiks Wort: „So kleine Fizel-Dinger gehen
 * verloren." Die Marke hängt an einem Stahlteil in einer Werkstatt — sie muss
 * auffallen, aus zwei Metern lesbar sein und einen Griff mit Handschuhen
 * überleben. Vier je Blatt heißt: Die Schnittlinien sind genau die
 * Blattmitten, zweimal schneiden und fertig.
 *
 * Je Marke der QR-Code groß, darunter der Klartext-Code fett — er steht
 * dabei, damit sich eine Marke auch abtippen lässt, wenn die Kamera streikt,
 * und damit man am Regal sieht, welche man in der Hand hat, ohne zu scannen.
 *
 * Fehlerkorrektur „M" wie beim GiroCode, aus demselben Grund: Der Code lebt
 * in der Werkstatt — Staub, Kratzer, Streiflicht — und wird von einem Handy
 * im Vorbeigehen gelesen.
 */
export async function markenBlatt(codes: string[], basisUrl: string): Promise<Buffer> {
  const { toBuffer } = await import('qrcode')

  // Rand 0: Die Zellen sind exakte A6-Viertel, die Schnittlinien die
  // Blattmitten — ein Seitenrand verschöbe beides.
  const doc = new PDFDocument({ size: 'A4', margin: 0 })
  schriftenSetzen(doc)

  const teile: Buffer[] = []
  doc.on('data', (t: Buffer) => teile.push(t))
  const fertig = new Promise<Buffer>((auf) => doc.on('end', () => auf(Buffer.concat(teile))))

  // A4 in Punkten; ein Viertel davon ist DIN A6
  const SEITE_B = 595.28
  const SEITE_H = 841.89
  const ZELLE_B = SEITE_B / 2
  const ZELLE_H = SEITE_H / 2
  const QR_KANTE = 200

  for (let i = 0; i < codes.length; i += 1) {
    const stelle = i % 4
    if (i > 0 && stelle === 0) doc.addPage()

    // Schnittlinien einmal je Blatt: das Kreuz durch die Mitte
    if (stelle === 0) {
      doc
        .save()
        .lineWidth(0.4)
        .strokeColor('#cccccc')
        .moveTo(ZELLE_B, 0)
        .lineTo(ZELLE_B, SEITE_H)
        .moveTo(0, ZELLE_H)
        .lineTo(SEITE_B, ZELLE_H)
        .stroke()
        .restore()
    }

    const x = (stelle % 2) * ZELLE_B
    const y = Math.floor(stelle / 2) * ZELLE_H

    // Der Block aus QR, Code und Absender sitzt mittig in der A6-Zelle
    const oben = y + (ZELLE_H - QR_KANTE - 78) / 2
    const url = `${basisUrl.replace(/\/$/, '')}/m/${encodeURIComponent(codes[i])}`
    const bild = await toBuffer(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 640,
      type: 'png',
    })
    doc.image(bild, x + (ZELLE_B - QR_KANTE) / 2, oben, { width: QR_KANTE, height: QR_KANTE })

    doc
      .font('Sans-Fett')
      .fontSize(30)
      .fillColor('#000')
      .text(codes[i], x, oben + QR_KANTE + 14, { width: ZELLE_B, align: 'center' })
    doc
      .font('Sans')
      .fontSize(11)
      .fillColor('#555')
      .text('Next-Concept SAS', x, oben + QR_KANTE + 52, { width: ZELLE_B, align: 'center' })
  }

  doc.end()
  return fertig
}
