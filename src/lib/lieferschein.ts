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
  /**
   * Fotos vom Zustand bei der Übergabe.
   *
   * Der Lieferschein sagt, **was** mitgefahren ist — nicht, in welchem
   * Zustand. Genau darum wird gestritten, wenn eine Kante verbogen ankommt:
   * War sie das vorher, oder ist es beim Transport passiert? Die Fotos
   * beantworten das auf demselben Blatt, das der Empfänger unterschreibt.
   *
   * Als Pfad und nicht als Buffer: Es sind Dateien auf der Platte, und
   * PDFKit liest sie selbst — so wandern nicht vier Fotos zugleich durch den
   * Arbeitsspeicher.
   */
  uebergabefotos?: { pfad: string; bemerkung?: string | null }[]
}

const tag = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('de-DE') : new Date().toLocaleDateString('de-DE')

/**
 * Die unterste Kante, die noch bedruckt wird.
 *
 * Nicht geschätzt, sondern nachgerechnet: Die Fußzeile steht bei
 * `Seitenhöhe − 38`, bei A4 also auf 804 Punkten (siehe `fusszeile` in
 * `pdfkopf.ts`). Ein Sicherheitsabstand von zehn Punkten darüber, und die
 * Zahl steht.
 *
 * Eine Zahl für alle, die sie brauchen — Fotoblock und Unterschriften. Beim
 * ersten Anlauf standen hier zwei getrennte Werte, und weil einer davon 780
 * war und damit fünfzehn Punkte zu vorsichtig, rutschten die beiden
 * Unterschriftslinien auf ein sonst leeres Folgeblatt.
 */
const UNTERKANTE = 794

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

  // ── Zustand bei der Übergabe ──────────────────────────────────────────────
  if (daten.uebergabefotos?.length) {
    /*
     * Zwei Fotos je Reihe, und damit gut sichtbar.
     *
     * Vier winzige Bilder auf einer Zeile beweisen nichts — auf einem
     * daumennagelgroßen Ausschnitt ist kein Kratzer zu erkennen, und um
     * Kratzer geht es hier. Lieber zwei ordentliche und dafür eine Reihe
     * mehr; das Blatt ist ohnehin für den Ordner und nicht für die Wand.
     */
    const SPALTEN = 2
    const LUECKE = 12
    const BREITE = (RECHTS - LINKS - LUECKE * (SPALTEN - 1)) / SPALTEN
    const HOEHE = BREITE * 0.75
    /** Wie hoch eine Reihe baut: Bild plus Zeile für die Bemerkung. */
    const REIHE = HOEHE + 22

    doc.moveDown(1.2)

    /**
     * Die Überschrift — sie steht über jeder Seite mit Fotos.
     *
     * Auf der Folgeseite wiederholt sie sich, weil das Blatt einzeln in die
     * Hand genommen wird: Vier Fotos ohne eine Zeile darüber sind im Ordner
     * ein Rätsel, und im Streitfall zählt, dass jemand ohne Vorwissen erkennt,
     * was er da sieht.
     */
    const ueberschrift = (fortsetzung: boolean) => {
      doc
        .fontSize(10)
        .fillColor('#000')
        .text(`Zustand bei der Übergabe${fortsetzung ? ' (Fortsetzung)' : ''}`, LINKS, doc.y)
      doc.moveDown(0.15)
      doc
        .fontSize(8)
        .fillColor('#666')
        .text(
          `Aufgenommen vor dem Verladen am ${tag(daten.datum)} — sie dokumentieren Ware und Verpackung.`,
          LINKS,
          doc.y,
          { width: RECHTS - LINKS },
        )
      doc.fillColor('#000')
      doc.moveDown(0.5)
    }

    /*
     * Eine einzelne Reihe am Blattende wird vermieden, mehr nicht.
     *
     * Der erste Anlauf verlangte Platz für zwei Reihen und schob den ganzen
     * Block dadurch viel zu früh auf eine neue Seite: Bei sechs Fotos blieb
     * die halbe erste Seite leer, und am Ende stand eine dritte Seite, auf der
     * nur noch die beiden Unterschriftslinien hingen. Gefordert wird deshalb
     * nur, was gegen den hässlichen Fall nötig ist — eine Reihe plus die
     * Überschrift. Was danach nicht mehr passt, wandert ohnehin sauber weiter,
     * und auf der Folgeseite steht die Überschrift erneut.
     */
    if (doc.y + 40 + REIHE > UNTERKANTE) doc.addPage()

    ueberschrift(false)

    for (let i = 0; i < daten.uebergabefotos.length; i += SPALTEN) {
      const reihe = daten.uebergabefotos.slice(i, i + SPALTEN)

      // Braucht die Reihe samt Bemerkung mehr Platz, als die Seite noch hat?
      if (doc.y + REIHE > UNTERKANTE) {
        doc.addPage()
        ueberschrift(true)
      }
      const oben = doc.y

      reihe.forEach((foto, spalte) => {
        const x = LINKS + spalte * (BREITE + LUECKE)
        try {
          doc.image(foto.pfad, x, oben, { fit: [BREITE, HOEHE], align: 'center' })
        } catch (err) {
          /*
           * Ein fehlendes Foto hält keinen Lieferschein auf — aber es soll im
           * Protokoll stehen. Dieselbe Regel wie beim Artikelbild: Das Stück
           * fährt los, ob das Bild ins PDF passte oder nicht.
           */
          console.warn('Übergabefoto nicht eingebettet:', err)
          doc
            .fontSize(8)
            .fillColor('#999')
            .text('(Foto nicht verfügbar)', x, oben + HOEHE / 2, { width: BREITE, align: 'center' })
          doc.fillColor('#000')
        }
        if (foto.bemerkung) {
          doc
            .fontSize(8)
            .fillColor('#444')
            .text(foto.bemerkung, x, oben + HOEHE + 3, { width: BREITE })
          doc.fillColor('#000')
        }
      })

      /*
       * Wo die nächste Reihe anfängt, entscheidet die längste Bemerkung.
       *
       * Gemessen und nicht geschätzt: „Ladung gesichert, Zurrgurte über der
       * Palette" bricht in einer Spalte von 120 Punkten auf zwei Zeilen um.
       * Mit einem festen Wert liefe die zweite Zeile ins nächste Bild.
       */
      doc.fontSize(8)
      const textHoehe = Math.max(
        0,
        ...reihe.map((f) =>
          f.bemerkung ? doc.heightOfString(f.bemerkung, { width: BREITE }) : 0,
        ),
      )
      doc.y = oben + HOEHE + (textHoehe ? textHoehe + 6 : 0) + 8
    }
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
  /*
   * Der Block bleibt beisammen: Eine Unterschrift, deren Linie auf der
   * nächsten Seite steht, wäre kein Protokoll, sondern ein Rätsel.
   *
   * Wie viel Platz er braucht, hängt daran, ob unterschrieben wurde: Das Bild
   * der Unterschrift sitzt 52 Punkte **über** der Linie, dazu die Zeilen
   * darunter. Ohne Abnahme sind es nur Linie und Beschriftung.
   *
   * **Der Abstand davor gibt nach, bevor die Seite es tut.** Vier Leerzeilen
   * sind auf einem halbleeren Blatt richtig — auf einem, das schon Fotos
   * trägt, schoben sie genau die zwei Linien auf ein sonst leeres Folgeblatt.
   * Also erst schauen, was noch da ist: Ist es knapp, rückt der Block näher
   * heran, statt umzubrechen. Umgebrochen wird nur, wenn er auch dicht
   * darüber nicht mehr passt.
   *
   * Der frühere Festwert von 660 galt für beide Fälle und war für den
   * häufigeren zu streng.
   */
  /*
   * Gemessen, nicht geschätzt: Die Linie sitzt auf `y`, die Beschriftung in
   * 8 Punkt bei `y + 4`. Ohne Abnahme sind das rund zwanzig Punkte. Mit
   * Abnahme kommt das Unterschriftsbild dazu, das 52 Punkte **über** der
   * Linie beginnt — dann braucht der Block das Doppelte und etwas mehr.
   */
  const braucht = daten.abnahme ? 90 : 22
  const luft = Math.max(0, Math.min(4, (UNTERKANTE - braucht - doc.y) / 12))
  doc.moveDown(luft)
  if (doc.y + braucht > UNTERKANTE) doc.addPage()
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
