'use client'

import React, { useEffect, useRef, useState } from 'react'

// Das Aussehen der Leiste. Statisch eingebunden, weil Stile keinen Ladefehler
// kennen — und weil Next sie so in dasselbe Stück legt wie diese Datei.
import 'quill/dist/quill.snow.css'

/**
 * Das Schreibfeld für Mails — Quill, mit Rückfallebene.
 *
 * **Warum überhaupt Gestaltung.** Bisher war das ein nacktes Textfeld: Man
 * tippte Text, und der Server setzte ihn auf den Briefbogen. Für eine kurze
 * Antwort reicht das; für ein Angebot mit drei Positionen, einer Hervorhebung
 * und einem Link reicht es nicht.
 *
 * **Warum Quill nachgeladen wird.** Es wiegt ein paar hundert Kilobyte, und
 * die braucht nur, wer schreibt. Im Büro wird aber vor allem gelesen — und das
 * oft am Telefon, unterwegs, an einer Verbindung, die nicht die beste ist.
 * Deshalb kommt es erst, wenn das Feld tatsächlich auf dem Schirm steht.
 *
 * **Warum es ohne Quill trotzdem geht.** Kommt es nicht (kein Netz, Ladefehler),
 * erscheint ein gewöhnliches Textfeld. Eine Mail, die man nicht schreiben kann,
 * weil ein Editor nicht lädt, wäre ein schlechter Tausch gegen eine, die man
 * nicht fett setzen kann.
 *
 * **Warum Inline-Stile statt Klassen.** Quill schreibt Farbe und Ausrichtung
 * von Haus aus als `class="ql-align-center"`. Das setzt ein Stylesheet voraus,
 * das der Mail nicht beiliegt und das kein Mailprogramm nachlädt — die
 * Gestaltung wäre beim Empfänger weg. Deshalb sind unten die Attributoren auf
 * Stile umgestellt; was dabei entstehen darf, steht in `mailhtml.ts`.
 */

type Props = {
  wert: string
  aendern: (html: string) => void
  /** Was im leeren Feld steht — Standard „Nachricht …" */
  platzhalter?: string
}

/*
 * Feste, kleine Farbpalette statt Quills 35er-Raster. Der erste Eintrag ist
 * „Standard": keine festgeschriebene Farbe — der Text folgt damit dem Thema
 * (hell/dunkel) im Büro und dem Briefbogen in der Mail. Ein hart gesetztes
 * Schwarz sähe im dunklen Thema aus wie verschwunden, und Weiß ginge in der
 * Mail unter; deshalb fehlen beide bewusst. Die Töne sind so gewählt, dass
 * sie auf dem weißen Briefbogen lesbar bleiben.
 */
const SCHRIFTFARBEN = [
  false, // Standard — folgt dem Thema bzw. dem Briefbogen
  '#666666',
  '#a86b3d',
  '#c0392b',
  '#b26b00',
  '#006100',
  '#0047b2',
  '#6b24b2',
]
const HERVORHEBUNGEN = [
  false, // Standard — keine Hervorhebung
  '#ffffcc',
  '#ffebcc',
  '#facccc',
  '#cce8cc',
  '#cce0f5',
  '#ebd6ff',
]

/** Was in der Leiste steht — mehr wäre für eine Mail Zierde */
const LEISTE = [
  [{ header: [1, 2, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: SCHRIFTFARBEN }, { background: HERVORHEBUNGEN }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['blockquote', 'link'],
  ['clean'],
]

export function Schreibfeld({ wert, aendern, platzhalter = 'Nachricht …' }: Props) {
  const behaelter = useRef<HTMLDivElement>(null)
  const [gescheitert, setGescheitert] = useState(false)
  const [bereit, setBereit] = useState(false)

  useEffect(() => {
    let abgebrochen = false

    void (async () => {
      try {
        const { default: Quill } = await import('quill')
        if (abgebrochen || !behaelter.current) return

        /*
         * Farbe, Hintergrund, Ausrichtung und Einzug als Stil statt als
         * Klasse — siehe oben. Ohne das käme beim Empfänger unformatierter
         * Text an, und man würde den Fehler beim Mailprogramm suchen.
         */
        for (const pfad of [
          'attributors/style/color',
          'attributors/style/background',
          'attributors/style/align',
          'attributors/style/direction',
        ]) {
          const stil = Quill.import(pfad) as unknown
          if (stil) Quill.register(stil as never, true)
        }

        const q = new Quill(behaelter.current, {
          theme: 'snow',
          placeholder: platzhalter,
          modules: { toolbar: LEISTE },
        })

        if (wert) {
          q.clipboard.dangerouslyPasteHTML(wert, 'silent')
          /*
           * Der Zeiger gehört an den Anfang, nicht hinter die Signatur.
           * Sonst tippt man seinen ersten Satz unter die Grußformel.
           */
          q.setSelection(0, 0)
        }

        q.on('text-change', () => {
          // `getSemanticHTML` liefert die Auszeichnung ohne Quills eigenes
          // Innenleben — genau das, was in eine Mail gehört
          aendern(q.getSemanticHTML())
        })

        setBereit(true)
      } catch {
        if (!abgebrochen) setGescheitert(true)
      }
    })()

    return () => {
      abgebrochen = true
    }
    // Absichtlich einmalig: Der Editor verwaltet seinen Inhalt danach selbst,
    // und ein Neuaufbau bei jedem Buchstaben nähme den Zeiger mit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (gescheitert) {
    return (
      <>
        <textarea
          rows={14}
          value={wert}
          onChange={(e) => aendern(e.target.value)}
          placeholder={platzhalter}
        />
        <span className="buero-unterzeile">
          Das Schreibfeld ließ sich nicht laden — es geht als einfacher Text weiter.
        </span>
      </>
    )
  }

  return (
    <div className="buero-schreibfeld">
      <div ref={behaelter} />
      {!bereit && <div className="buero-leer">Schreibfeld wird geladen …</div>}
    </div>
  )
}
