'use client'

import type Quill from 'quill'
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

type Baustein = { titel: string; inhalt: string }

/*
 * Die Textbausteine, einmal je Sitzung geholt. Erst wenn jemand „::" tippt,
 * geht die Anfrage raus — wer nie Bausteine benutzt, lädt auch keine.
 */
let bausteinVorrat: Baustein[] | null = null

async function bausteineHolen(): Promise<Baustein[]> {
  if (bausteinVorrat) return bausteinVorrat
  try {
    const res = await fetch('/api/office/textbausteine', { credentials: 'include' })
    if (!res.ok) return []
    const j = (await res.json()) as { bausteine?: Baustein[] }
    bausteinVorrat = Array.isArray(j.bausteine) ? j.bausteine : []
    return bausteinVorrat
  } catch {
    return []
  }
}

/** Wo im Text die Auswahl aufging und was seither getippt wurde */
type BausteinAuswahl = {
  start: number
  laenge: number
  filter: string
  oben: number
  links: number
  liste: Baustein[]
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
  '#a5622d', // Corten — der Ton der Striche auf der Website (--color-bronze)
  '#666666',
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
  const quillRef = useRef<Quill | null>(null)
  const [gescheitert, setGescheitert] = useState(false)
  const [bereit, setBereit] = useState(false)
  const [auswahl, setAuswahl] = useState<BausteinAuswahl | null>(null)

  /** Den gewählten Baustein an der Stelle des „::" einsetzen */
  function bausteinEinfuegen(b: Baustein) {
    const q = quillRef.current
    const a = auswahl
    setAuswahl(null)
    if (!q || !a) return
    const vorher = q.getLength()
    q.deleteText(a.start, a.laenge, 'user')
    q.clipboard.dangerouslyPasteHTML(a.start, b.inhalt, 'user')
    // Die Schreibmarke gehört hinter das Eingefügte, nicht davor
    const zuwachs = q.getLength() - (vorher - a.laenge)
    q.setSelection(a.start + Math.max(0, zuwachs), 0, 'silent')
    aendern(q.getSemanticHTML())
  }

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

        /*
         * Der ::-Griff zu den Textbausteinen: Steht die Schreibmarke hinter
         * „::" (am Zeilen- oder Wortanfang), geht die Auswahl auf; was danach
         * getippt wird, filtert sie. Geprüft wird bei jeder Änderung und
         * jedem Sprung der Schreibmarke — so schließt sich die Auswahl von
         * selbst, sobald man woanders weitertippt oder hinausklickt.
         */
        const bausteinPruefen = () => {
          const sel = q.getSelection()
          if (!sel) {
            setAuswahl(null)
            return
          }
          const von = Math.max(0, sel.index - 40)
          const davor = q.getText(von, sel.index - von)
          const treffer = /(?:^|[\s ])::([^\s:]{0,24})$/.exec(davor)
          if (!treffer) {
            setAuswahl(null)
            return
          }
          const filter = treffer[1]
          const start = sel.index - (filter.length + 2)
          void bausteineHolen().then((liste) => {
            const grenzen = q.getBounds(start)
            const feld = behaelter.current
            const breite = feld?.offsetWidth ?? 320
            setAuswahl({
              start,
              laenge: filter.length + 2,
              filter,
              oben: (feld?.offsetTop ?? 0) + (grenzen ? grenzen.bottom + 4 : 0),
              links: Math.min(grenzen?.left ?? 0, Math.max(0, breite - 260)),
              liste,
            })
          })
        }

        q.on('text-change', () => {
          // `getSemanticHTML` liefert die Auszeichnung ohne Quills eigenes
          // Innenleben — genau das, was in eine Mail gehört
          aendern(q.getSemanticHTML())
          bausteinPruefen()
        })
        q.on('selection-change', bausteinPruefen)

        quillRef.current = q
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

  const passende = auswahl
    ? auswahl.liste.filter((b) =>
        b.titel.toLowerCase().includes(auswahl.filter.toLowerCase()),
      )
    : []

  return (
    <div className="buero-schreibfeld">
      <div ref={behaelter} />
      {!bereit && <div className="buero-leer">Schreibfeld wird geladen …</div>}
      {auswahl && (
        <div
          className="buero-baustein-menue"
          style={{ top: auswahl.oben, left: auswahl.links }}
        >
          {auswahl.liste.length === 0 ? (
            <div className="buero-baustein-leer">
              Noch keine Textbausteine — anzulegen unter Einstellungen → Integrationen.
            </div>
          ) : passende.length === 0 ? (
            <div className="buero-baustein-leer">{`Kein Baustein passt zu „${auswahl.filter}“.`}</div>
          ) : (
            passende.map((b) => (
              <button
                key={b.titel}
                type="button"
                /*
                 * pointerdown statt click: Ein Klick nähme dem Editor erst den
                 * Fokus, die Auswahl schlösse sich — und der Klick ginge ins
                 * Leere. preventDefault lässt den Fokus, wo er ist.
                 */
                onPointerDown={(e) => {
                  e.preventDefault()
                  bausteinEinfuegen(b)
                }}
              >
                {b.titel}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
