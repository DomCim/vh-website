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

/*
 * Die kleine Schrift, als Vielfaches der Grundschrift und nicht in Punkt.
 *
 * `0.85em` folgt dem Briefbogen: Der setzt 14 px, daraus werden knapp 12 —
 * und wenn der Empfänger seine Schrift größer stellt, wächst der Kleingedruckte
 * mit. Eine feste Punktzahl bliebe stur klein, gerade dort, wo jemand sie
 * vergrößert hat, weil er sie sonst nicht liest.
 *
 * Nur eine Stufe nach unten und keine nach oben: Größer als normal gibt es in
 * einer Geschäftsmail die Überschrift, und die steht schon in der Leiste.
 */
const KLEIN = '0.85em'

/*
 * Die Spielarten des Corten-Strichs.
 *
 * Vier, nicht zwanzig: Ein Strich ist ein Trennzeichen und kein Werkzeugkasten.
 * Drei kurze in aufsteigender Stärke — für die Trennung vor der Signatur, für
 * einen Abschnitt, für einen Einschnitt — und einer quer über die ganze
 * Breite, wo es weniger um Betonung als um eine saubere Kante geht.
 *
 * Wie sie **aussehen**, steht nicht hier, sondern zweimal woanders: im
 * Schreibfeld in `office.css`, in der Mail in `mailhtml.ts`. Zwei Fassungen,
 * weil eine Mail kein Stylesheet mitbringt — wer eine ändert, ändert die
 * andere mit. Im gespeicherten Text steht nur der Name der Spielart, damit
 * eine alte Signatur später nicht ihre eigenen Maße mit sich herumträgt.
 */
const STRICHE = ['fein', 'mittel', 'kraeftig', 'quer'] as const

/** Was in der Leiste steht — mehr wäre für eine Mail Zierde */
const LEISTE = [
  [{ header: [1, 2, false] }, { size: [KLEIN, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: SCHRIFTFARBEN }, { background: HERVORHEBUNGEN }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['blockquote', 'link', { trennstrich: STRICHE }],
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

        /*
         * Die Schriftgröße ebenso — mit **eigener** Liste.
         *
         * Quill bringt für den Stil-Weg ab Werk `10px`, `18px` und `32px` mit.
         * Feste Punktzahlen in einer Mail sind aber genau der Fehler von oben:
         * Sie ignorieren, was der Empfänger eingestellt hat. Zugelassen ist
         * deshalb nur unser eigener Wert; alles andere wird von Quill gar nicht
         * erst geschrieben und käme an der Prüfung in `mailhtml.ts` ohnehin
         * nicht vorbei.
         */
        const groesse = Quill.import('attributors/style/size') as { whitelist?: string[] } | null
        if (groesse) {
          groesse.whitelist = [KLEIN]
          Quill.register(groesse as never, true)
        }

        /*
         * Der Corten-Strich als eigener Baustein.
         *
         * Quill kennt von Haus aus keine Trennlinie — es gibt keinen Knopf und
         * kein Format dafür. Ein `<hr>` ist aber genau das, was gebraucht wird:
         * ein schmaler Strich vor der Signatur, wie ihn die Website unter jeder
         * Überschrift trägt.
         *
         * Wie er aussieht, steht **nicht** hier: Im Schreibfeld macht das
         * `office.css`, in der Mail `mailhtml.ts`. Ein Strich, dessen Maße im
         * gespeicherten Text stünden, ließe sich später nicht mehr ändern —
         * jede alte Signatur trüge ihre eigene Fassung mit sich herum.
         */
        const Einbettung = Quill.import('blots/block/embed') as unknown as {
          new (...args: unknown[]): Record<string, unknown>
          create(wert?: unknown): HTMLElement
        }
        class Trennstrich extends Einbettung {
          static blotName = 'trennstrich'
          static tagName = 'hr'

          /* Die Spielart steht als Kennzeichen am Strich — nur so findet sie
             beim späteren Öffnen einer gespeicherten Signatur zurück */
          static create(wert: unknown): HTMLElement {
            /*
             * `super.create` und nicht die Basisklasse selbst: Parchment liest
             * den Tag aus `this`, und das ist nur beim Aufruf über `super`
             * diese Klasse hier. Direkt gerufen fehlt ihm der Tag — mit einer
             * Meldung, die auf alles Mögliche zeigt, nur nicht auf die Zeile.
             */
            const knoten = super.create(wert)
            const art = String(wert ?? '')
            knoten.setAttribute(
              'data-strich',
              (STRICHE as readonly string[]).includes(art) ? art : 'mittel',
            )
            return knoten
          }

          static value(knoten: HTMLElement): string {
            return knoten.getAttribute('data-strich') ?? 'mittel'
          }
        }
        Quill.register(Trennstrich as never, true)

        const q = new Quill(behaelter.current, {
          theme: 'snow',
          placeholder: platzhalter,
          modules: { toolbar: LEISTE },
        })

        /*
         * Eingefügt wird **hinter** der Zeile, in der die Schreibmarke steht,
         * und danach steht sie darunter — sonst tippt man weiter und landet
         * über dem Strich, den man gerade gesetzt hat.
         */
        const leiste = q.getModule('toolbar') as {
          addHandler(name: string, hand: (wert: string) => void): void
        }
        leiste.addHandler('trennstrich', (wert) => {
          // Der Wähler meldet sich auch beim Zurückstellen auf „leer" — dann
          // ist nichts zu tun, sonst stünde bei jedem Zuklappen ein Strich da
          if (!wert) return
          const stelle = q.getSelection(true)?.index ?? q.getLength()
          q.insertEmbed(stelle, 'trennstrich', wert, 'user')
          q.setSelection(stelle + 1, 0, 'silent')
          aendern(q.getSemanticHTML())
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
