import PDFDocument from 'pdfkit'

import { LINKS, RECHTS, schriftenSetzen } from './pdfkopf'

/**
 * Das Druckblatt der Laufmarken — A4 zum Ausschneiden.
 *
 * Vier Spalten, fünf Reihen: zwanzig Marken je Blatt, genau eine Tafel voll.
 * Je Zelle der QR-Code, darunter der Klartext-Code — der Code steht dabei,
 * damit sich eine Marke auch abtippen lässt, wenn die Kamera streikt, und
 * damit Vincent am Regal sieht, welche er in der Hand hat, ohne zu scannen.
 *
 * Dünne Schnittlinien statt Rahmen: Sie sollen beim Ausschneiden helfen und
 * auf der fertigen Marke möglichst verschwinden.
 *
 * Fehlerkorrektur „M" wie beim GiroCode, aus demselben Grund: Der Code lebt
 * in der Werkstatt — Staub, Kratzer, Streiflicht — und wird von einem Handy
 * im Vorbeigehen gelesen.
 */
export async function markenBlatt(codes: string[], basisUrl: string): Promise<Buffer> {
  const { toBuffer } = await import('qrcode')

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  schriftenSetzen(doc)

  const teile: Buffer[] = []
  doc.on('data', (t: Buffer) => teile.push(t))
  const fertig = new Promise<Buffer>((auf) => doc.on('end', () => auf(Buffer.concat(teile))))

  const SPALTEN = 4
  const REIHEN = 5
  const OBEN = 50
  const breite = (RECHTS - LINKS) / SPALTEN
  const hoehe = (792 - OBEN) / REIHEN
  const qrKante = 88

  for (let i = 0; i < codes.length; i += 1) {
    const stelle = i % (SPALTEN * REIHEN)
    if (i > 0 && stelle === 0) doc.addPage()

    const spalte = stelle % SPALTEN
    const reihe = Math.floor(stelle / SPALTEN)
    const x = LINKS + spalte * breite
    const y = OBEN + reihe * hoehe

    // Schnittlinien — hell, damit sie an der fertigen Marke nicht stören
    doc
      .save()
      .lineWidth(0.4)
      .strokeColor('#cccccc')
      .rect(x, y, breite, hoehe)
      .stroke()
      .restore()

    const url = `${basisUrl.replace(/\/$/, '')}/m/${encodeURIComponent(codes[i])}`
    const bild = await toBuffer(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      type: 'png',
    })
    doc.image(bild, x + (breite - qrKante) / 2, y + 10, { width: qrKante, height: qrKante })

    doc
      .font('Sans-Fett')
      .fontSize(13)
      .fillColor('#000')
      .text(codes[i], x, y + 10 + qrKante + 6, { width: breite, align: 'center' })
    doc
      .font('Sans')
      .fontSize(7)
      .fillColor('#555')
      .text('Werkstatt Hellmann', x, y + 10 + qrKante + 24, { width: breite, align: 'center' })
  }

  doc.end()
  return fertig
}
