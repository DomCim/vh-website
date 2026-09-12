import fs from 'node:fs'
import path from 'node:path'

import { Markdown } from '../../../../components/office/Markdown'
import { bueroBenutzer } from '../../../../lib/office'

export const dynamic = 'force-dynamic'

/**
 * Die Verfahrensdokumentation, im Büro lesbar und zum Mitnehmen.
 *
 * **Warum sie im Quelltext liegt und nicht in der Datenbank.** Sie beschreibt,
 * wie dieses System arbeitet — also gehört sie zu der Fassung, die gerade
 * läuft. Liegt sie neben dem Code, ändert sie sich mit ihm, und jede Änderung
 * steht mit Datum und Begründung im Verlauf. In der Datenbank wäre sie ein
 * Text, den jemand irgendwann bearbeitet hat, ohne dass später jemand
 * nachvollziehen könnte, was vorher darin stand — ausgerechnet bei dem
 * Papier, in dem es um Nachvollziehbarkeit geht.
 *
 * Zum Weitergeben gibt es zwei Wege: ausdrucken oder als PDF sichern (das
 * kann jeder Browser, und das Papier ist dafür gesetzt), oder die Datei
 * selbst herunterladen — die liest die Kanzlei in jedem Editor.
 */

const DATEI = 'VERFAHRENSDOKUMENTATION.md'

export default async function Seite() {
  await bueroBenutzer('zahlen.sehen')

  let text: string
  try {
    text = fs.readFileSync(path.join(process.cwd(), DATEI), 'utf8')
  } catch {
    /*
     * Lieber ehrlich leer als eine halbe Seite: Fehlt die Datei im Abbild,
     * ist das ein Fehler beim Bauen und keine Kleinigkeit, die man
     * wegblenden sollte.
     */
    return (
      <>
        <h1>Verfahrensdokumentation</h1>
        <div className="buero-leer">
          Die Datei <code>{DATEI}</code> liegt nicht in dieser Fassung. Das ist ein Fehler beim
          Bauen des Abbilds — bitte melden.
        </div>
      </>
    )
  }

  return (
    <>
      <div className="buero-papier-kopf">
        <p className="buero-unterzeile" style={{ margin: 0 }}>
          Das Papier, das ein Prüfer sehen will: Wie ein Beleg hereinkommt, wie eine Rechnung
          entsteht, wer was darf und was gesichert wird. Es beschreibt die Fassung, die gerade
          läuft.
        </p>
        <a className="buero-knopf leise schmal" href="/api/office/verfahren" download={DATEI}>
          Datei herunterladen
        </a>
      </div>

      <Markdown text={text} />
    </>
  )
}
