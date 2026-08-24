'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Dateien einfügen und fallen lassen — für jede Dateiauswahl.
 *
 * Er liegt unter `buero/`, weil er dort entstanden ist, gilt aber genauso für
 * die kundenseitigen Formulare (Maßanfertigung, Übergabemappe,
 * Vorgangsunterlagen). Dort trägt der Bereich statt `buero-ablage` eine
 * gestrichelte Tailwind-Umrandung — der Haken selbst kennt kein Aussehen, er
 * meldet nur, ob gerade etwas darüber schwebt.
 *
 * **Warum das ein Haken ist und kein Formularfeld.** Die Stellen, an
 * denen man eine Datei wählt, sind verschieden gebaut: Der Beleg lädt
 * sofort hoch, die Werkstattdatei sammelt mehrere, der Kontoauszug nimmt
 * genau eine. Ein gemeinsames Feld hätte alle drei Formen abbilden müssen und
 * wäre an der ersten Ausnahme zerbrochen. Der Haken ergänzt nur zwei Wege in
 * dieselbe Rückmeldung und lässt jede Stelle bei ihrer Logik.
 *
 * **Am Telefon passiert schlicht nichts** — dort gibt es kein Ziehen und in
 * der Zwischenablage selten eine Datei. Das ist kein Mangel: Der native
 * Foto-/Dateidialog ist dort der bessere Weg, und der bleibt unverändert.
 *
 * Zwei Dinge, die beim Bauen aufgefallen sind und die man nicht wieder
 * herausnehmen sollte:
 *
 *  - **Einfügen wird dem Schreibfeld nicht weggenommen.** Steht der Zeiger in
 *    einem Eingabefeld oder im Quill-Editor, geht das Einfügen dorthin — dort
 *    will man Text einsetzen, und Quill kümmert sich um Bilder selbst.
 *    Sonst landete ein kopierter Absatz als Datei am Beleg.
 *  - **Bei mehreren Ablagen auf einer Seite entscheidet die Maus.** Wer
 *    einfügt, meint die Stelle, über der er steht. Gibt es nur eine, bekommt
 *    sie es ohne Zielen.
 */

/** Alle Ablagen dieser Seite — für die Frage, welche ein Einfügen bekommt. */
const ablagen = new Set<HTMLElement>()
let letzteMaus: { x: number; y: number } | null = null

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointermove',
    (e) => {
      letzteMaus = { x: e.clientX, y: e.clientY }
    },
    { passive: true },
  )
}

/** Steht der Zeiger dort, wo Text hingehört? Dann ist Einfügen nicht unsere Sache. */
function schreibtGerade(ziel: EventTarget | null): boolean {
  const el = ziel instanceof HTMLElement ? ziel : null
  if (!el) return false
  return Boolean(el.closest('input, textarea, select, [contenteditable="true"]'))
}

/** Liegt dieser Punkt in dem Bereich? */
function trifft(el: HTMLElement, p: { x: number; y: number } | null): boolean {
  if (!p) return false
  const r = el.getBoundingClientRect()
  return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom
}

export type Dateiablage = {
  /** true, solange etwas über dem Bereich schwebt — für die Hervorhebung */
  drueber: boolean
}

/**
 * Hängt Einfügen (Strg/Cmd+V) und Ziehen-und-Fallenlassen an einen Bereich.
 *
 * @param bereich  Der Bereich, der Dateien annimmt — meist das Feld samt Beschriftung.
 * @param nimm     Wird mit den Dateien gerufen. Wer nur eine will, nimmt die erste.
 * @param aktiv    Auf false schaltet alles ab (z. B. solange ein Upload läuft).
 */
export function useDateiablage(
  bereich: RefObject<HTMLElement | null>,
  nimm: (dateien: File[]) => void,
  aktiv = true,
): Dateiablage {
  const [drueber, setDrueber] = useState(false)

  /*
   * Die Rückmeldung liegt in einer Ref und nicht in den Abhängigkeiten.
   *
   * Sonst hinge sich der Haken bei jedem Tastendruck im Formular neu an —
   * jedes Rendern erzeugt eine neue Funktion. Das ist nicht nur Verschwendung:
   * Wer gerade eine Datei über den Bereich zieht, verliert dabei das laufende
   * `dragenter`, und die Hervorhebung bleibt hängen. Mit der Ref bleiben die
   * Zuhörer stehen und rufen trotzdem immer die aktuelle Funktion.
   */
  const nimmRef = useRef(nimm)
  nimmRef.current = nimm

  useEffect(() => {
    const el = bereich.current
    if (!el || !aktiv) return
    ablagen.add(el)

    let tiefe = 0

    const rein = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      tiefe += 1
      setDrueber(true)
    }
    /*
     * `dragover` muss abgefangen werden, sonst öffnet der Browser die Datei
     * selbst — er ersetzt dann die Seite durch das fallengelassene PDF, und
     * alles Getippte ist weg.
     */
    const drueberZiehen = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const raus = () => {
      tiefe = Math.max(0, tiefe - 1)
      if (tiefe === 0) setDrueber(false)
    }
    const fallen = (e: DragEvent) => {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      tiefe = 0
      setDrueber(false)
      nimmRef.current([...e.dataTransfer.files])
    }
    const einfuegen = (e: ClipboardEvent) => {
      const dateien = [...(e.clipboardData?.files ?? [])]
      if (!dateien.length) return
      if (schreibtGerade(e.target)) return
      // Bei mehreren Ablagen entscheidet die Maus; bei einer genügt es, dass es sie gibt
      if (ablagen.size > 1 && !trifft(el, letzteMaus)) return
      e.preventDefault()
      nimmRef.current(dateien)
    }

    el.addEventListener('dragenter', rein)
    el.addEventListener('dragover', drueberZiehen)
    el.addEventListener('dragleave', raus)
    el.addEventListener('drop', fallen)
    document.addEventListener('paste', einfuegen)

    return () => {
      ablagen.delete(el)
      el.removeEventListener('dragenter', rein)
      el.removeEventListener('dragover', drueberZiehen)
      el.removeEventListener('dragleave', raus)
      el.removeEventListener('drop', fallen)
      document.removeEventListener('paste', einfuegen)
    }
  }, [bereich, aktiv])

  return { drueber }
}

/**
 * Aus einer Liste von Dateien wieder eine `FileList` machen.
 *
 * Nötig, weil die meisten Aufnahmefunktionen hier für `<input type="file">`
 * geschrieben sind und deshalb eine `FileList` erwarten. Die lässt sich nicht
 * von Hand bauen — nur über den Umweg über `DataTransfer`. Der steht hier
 * einmal, statt an jeder Stelle noch einmal.
 */
export function alsListe(dateien: File[]): FileList {
  const traeger = new DataTransfer()
  for (const datei of dateien) traeger.items.add(datei)
  return traeger.files
}
