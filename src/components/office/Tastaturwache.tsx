'use client'

import { useEffect } from 'react'

/**
 * Blendet die untere Leiste aus, solange die Bildschirmtastatur offen ist.
 *
 * Am Handy klebt die Tableiste am unteren Rand. Geht die Tastatur auf,
 * schrumpft der sichtbare Ausschnitt — die Leiste sitzt dann je nach Browser
 * über der Tastatur oder direkt über dem Feld, in das gerade getippt wird.
 * Beides steht im Weg.
 *
 * **Zwei Bedingungen, nicht eine.** Gemessen wird über `visualViewport`:
 * `window.innerHeight` beschreibt den Ausschnitt, den die Seite belegen darf,
 * `visualViewport.height` den, den man tatsächlich sieht. Klafft dazwischen
 * ein Viertel, ist etwas davor. Das allein genügt aber nicht — es muss auch
 * jemand in einem Feld stehen.
 *
 * Der Grund steht in Meldung #38: In der installierten App auf dem iPhone war
 * nach dem Zurückkehren aus dem Hintergrund manchmal keine Navigation mehr da.
 * Beim Aufwachen meldet iOS für einen Moment die alte, kleine Höhe des
 * Ausschnitts, während `innerHeight` schon die volle nennt. Die Lücke sah aus
 * wie eine Tastatur, die Leiste verschwand — und weil danach kein weiteres
 * Ereignis mehr kam, blieb sie weg, bis man die Seite wechselte. Eine Tastatur
 * ohne Feld, in das sie tippt, gibt es nicht; mit dieser zweiten Bedingung
 * kann eine falsch gemessene Höhe die Leiste nicht mehr verschlucken.
 *
 * **Und es wird beim Zurückkommen neu gemessen.** `visibilitychange` und
 * `pageshow` sind die beiden Ereignisse, die das Aufwachen melden; die
 * Nachmessungen danach fangen ab, dass iOS die richtige Höhe erst nach seiner
 * Animation herausgibt. Ohne sie bliebe ein falscher Stand stehen, weil von
 * selbst nichts mehr feuert.
 *
 * Die Schwelle ist bewusst grob. Auf iOS wächst und schrumpft der Ausschnitt
 * auch beim Ein- und Ausblenden der Adressleiste, aber um deutlich weniger
 * als hundert Pixel; ein feinerer Wert würde die Leiste beim Scrollen
 * flackern lassen.
 *
 * Ohne `visualViewport` — ältere Browser, Firefox unter bestimmten Fassungen —
 * passiert schlicht nichts: Dann bleibt die Leiste stehen, wie sie es vorher
 * immer getan hat.
 */

/** Steht der Zeiger in etwas, in das man tippen kann? */
function tipptGerade(): boolean {
  const el = document.activeElement
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLInputElement) {
    // Ein Datums- oder Auswahlfeld öffnet keine Schreibtastatur
    return !['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range'].includes(el.type)
  }
  return el.isContentEditable
}

export function Tastaturwache() {
  useEffect(() => {
    const sicht = window.visualViewport
    if (!sicht) return

    let zeitgeber: ReturnType<typeof setTimeout>[] = []

    const pruefen = () => {
      // Im Hintergrund gemessene Höhen sagen nichts — dann lieber gar nichts tun
      if (document.hidden) return
      const verdeckt = window.innerHeight - sicht.height
      const lueckeGross = verdeckt > Math.max(120, window.innerHeight * 0.25)
      const offen = lueckeGross && tipptGerade()
      document.documentElement.classList.toggle('tastatur-offen', offen)
      /*
       * Wie hoch die Tastatur steht — damit die Hauptaktion darüber Platz
       * findet statt dahinter zu verschwinden (siehe office.css).
       *
       * Gemeldet in #42: „Ich komme nicht an den Senden-Knopf, solange die
       * Tastatur offen ist." Die Leiste rutschte bei offener Tastatur aus dem
       * Kleben zurück in den Fluss — das war als Ausweichen gedacht und hieß
       * in Wahrheit: Der einzige Knopf, der zählt, liegt irgendwo weiter
       * unten und ist mit offener Tastatur kaum zu erreichen.
       */
      document.documentElement.style.setProperty(
        '--tastatur-hoehe',
        offen ? `${Math.round(verdeckt)}px` : '0px',
      )
      /*
       * Wie weit iOS den sichtbaren Ausschnitt in der Seite nach unten
       * geschoben hat.
       *
       * Beim Öffnen der Tastatur schrumpft die Seite nicht — iOS verschiebt
       * nur, was man davon sieht. Ein festgenagelter Knopf hängt aber an der
       * Seite und wandert deshalb aus dem Bild. Genau um diesen Betrag wird
       * er zurückgeschoben; ohne ihn säße er beim Tippen in einem langen
       * Formular irgendwo unterhalb des Sichtbaren.
       */
      document.documentElement.style.setProperty(
        '--sicht-oben',
        offen ? `${Math.round(sicht.offsetTop)}px` : '0px',
      )
    }

    /*
     * Beim Aufwachen mehrfach nachmessen.
     *
     * iOS gibt die richtige Höhe des Ausschnitts erst nach seiner eigenen
     * Animation heraus und feuert dafür kein weiteres Ereignis. Wer nur
     * einmal misst, schreibt den Zwischenstand fest.
     */
    const nachmessen = () => {
      zeitgeber.forEach(clearTimeout)
      zeitgeber = [0, 120, 350, 700].map((ms) => setTimeout(pruefen, ms))
    }

    pruefen()
    sicht.addEventListener('resize', pruefen)
    sicht.addEventListener('scroll', pruefen)
    // Der Zeiger kann ein Feld verlassen, ohne dass sich die Höhe ändert
    document.addEventListener('focusin', pruefen)
    document.addEventListener('focusout', nachmessen)
    document.addEventListener('visibilitychange', nachmessen)
    window.addEventListener('pageshow', nachmessen)

    return () => {
      zeitgeber.forEach(clearTimeout)
      sicht.removeEventListener('resize', pruefen)
      sicht.removeEventListener('scroll', pruefen)
      document.removeEventListener('focusin', pruefen)
      document.removeEventListener('focusout', nachmessen)
      document.removeEventListener('visibilitychange', nachmessen)
      window.removeEventListener('pageshow', nachmessen)
      // Beim Seitenwechsel nicht mit ausgeblendeter Leiste zurücklassen
      document.documentElement.classList.remove('tastatur-offen')
      document.documentElement.style.removeProperty('--tastatur-hoehe')
      document.documentElement.style.removeProperty('--sicht-oben')
    }
  }, [])

  return null
}
