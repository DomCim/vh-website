'use client'

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'

/**
 * Die Hauptaktion einer Seite — am Handy dort, wo der Daumen liegt.
 *
 * Gebucht, gespeichert und verschickt wird an der Werkbank und nicht am
 * Schreibtisch. Stand die Hauptaktion unter dem Formular, war sie schon bei
 * zwei Positionen aus dem Bild: tippen, scrollen, suchen, tippen.
 *
 * Deshalb klebt sie am Handy über der Tableiste und geht über die volle
 * Breite; am Rechner steht sie rechts unter dem Formular, wo sie hingehört.
 *
 * `sticky` statt `fixed` ist Absicht: Ein festgenagelter Balken springt,
 * sobald die Bildschirmtastatur aufgeht, weil iOS dann nur den sichtbaren
 * Ausschnitt verschiebt und nicht die Seite. Zusätzlich nimmt
 * `Tastaturwache` die Leiste beim Tippen ganz aus dem Kleben.
 *
 * ── Warum hier jetzt ein Blatt aufgeht ──────────────────────────────────────
 *
 * Die Regel „genau **eine** primäre Handlung" stand von Anfang an im Kopf
 * dieser Datei — und wurde reihenweise gebrochen: An der Rechnung standen vier
 * Knöpfe, am Angebot fünf. Am Handy bekam jeder die volle Breite, also
 * stapelten sie sich. Gemessen: **230 Pixel, 27 % des Bildschirms**, dauerhaft
 * über dem Formular. Man tippte in Felder, die man nicht sah.
 *
 * Ein Kommentar allein hält so etwas nicht auf. Deshalb setzt die Leiste die
 * Regel jetzt selbst durch: Die **eine** primäre Handlung bleibt unten stehen,
 * alles Übrige wandert am Handy hinter „⋯" in ein Blatt. Am Rechner ist Platz,
 * dort steht wie bisher alles nebeneinander.
 *
 * Erkannt wird das an der Beschriftung der Knöpfe — `leise`, `stumm` und
 * `gefahr` sind im Büro die Klassen für alles, was nicht die Hauptsache ist.
 * Damit gilt die Regel auch für den Knopf, den jemand nächste Woche dazusetzt.
 *
 * ── Und warum die Höhe gemessen wird ────────────────────────────────────────
 *
 * Der Inhalt darunter braucht Platz, sonst verschwindet die letzte Zeile hinter
 * der Leiste. Bisher stand dafür eine feste Zahl im Stylesheet (88 Pixel) — bei
 * einer 230 Pixel hohen Leiste eben falsch. Jetzt meldet die Leiste ihre echte
 * Höhe als CSS-Variable, und das Stylesheet rechnet damit. Eine Zahl, die sich
 * selbst pflegt, geht nicht kaputt, wenn ein Knopf dazukommt.
 */

/** Klassen, die einen Knopf als „nicht die Hauptsache" ausweisen */
const NEBENSACHE = ['leise', 'stumm', 'gefahr']

function istNebensache(kind: React.ReactNode): boolean {
  if (!React.isValidElement(kind)) return false
  const klassen = String((kind.props as { className?: string }).className ?? '')
  return NEBENSACHE.some((k) => klassen.split(/\s+/).includes(k))
}

export function Fussleiste({
  hinweis,
  geaendert,
  aufVerwerfen,
  children,
}: {
  /** Kurzer Stand links neben der Aktion, z.B. „3 Positionen · 480,00 €" */
  hinweis?: React.ReactNode
  /**
   * Steht etwas Ungespeichertes im Formular?
   *
   * Ist etwas offen, taucht die Leiste am Rechner unten am Bildschirmrand
   * auf und trägt „Nicht gespeichert" — am Handy, wo sie ohnehin klebt,
   * wechselt sie nur die Farbe. Vorschlag von Dominik, und der bessere: Ein
   * Balken, der immer gleich aussieht, sagt nichts; einer, der sich meldet,
   * sagt „hier ist etwas offen".
   *
   * **Ohne Angabe bleibt alles wie bisher.** Und weggenommen wird nie etwas:
   * Die Hauptaktion ist nicht überall „Speichern" — an der Rechnung steht
   * dort „Rechnung senden", und der muss erreichbar bleiben, auch wenn
   * niemand ein Feld angefasst hat.
   */
  geaendert?: boolean
  /**
   * Zurück zum gespeicherten Stand — steht neben „Nicht gespeichert" und
   * sonst nirgends.
   *
   * **Warum der Knopf genau hier auftaucht.** Ein „Verwerfen", das dauernd
   * dasteht, ist ein Knopf, der nichts tut und trotzdem Angst macht. Einer,
   * der zusammen mit der Meldung kommt, beantwortet die Frage, die man in
   * dem Moment wirklich hat: Was steht hier eigentlich offen, und komme ich
   * da wieder heraus?
   *
   * Er fragt vorher nach. Getipptes ist Arbeit, und ein Fehlgriff neben
   * „Speichern" wäre teuer.
   */
  aufVerwerfen?: () => void
  children: React.ReactNode
}) {
  const leiste = useRef<HTMLDivElement>(null)
  const [blattOffen, setBlattOffen] = useState(false)

  const alle = React.Children.toArray(children).filter(Boolean)
  const neben = alle.filter(istNebensache)
  const haupt = alle.filter((k) => !istNebensache(k))

  /*
   * **Jede** Nebensache wandert ins Blatt, nicht erst ab der zweiten.
   *
   * Die weichere Regel war einmal drin und ging schief: Am Auftrag steht im
   * Zustand „Geplant" genau ein Nebenknopf neben „Speichern" — zwei Knöpfe
   * also, die nebeneinander passen müssten. Sie passen nicht: „In Fertigung
   * nehmen" ist zu lang, es bricht um, und die Leiste ist wieder zweizeilig
   * (gemessen: 123 Pixel). Ob es umbricht, hängt an der Länge einer
   * Beschriftung — das ist keine Grundlage für eine Regel.
   *
   * Eine Zeile, immer. Der zusätzliche Tipp trifft Handlungen, die man einmal
   * je Vorgang macht; das dauernde Verdecken traf jedes Formular.
   */
  const insBlatt = neben
  const inLeiste = insBlatt.length ? haupt : alle

  // Die echte Höhe nach außen geben, damit der Inhalt darunter Platz bekommt
  useLayoutEffect(() => {
    const knoten = leiste.current
    if (!knoten || typeof ResizeObserver === 'undefined') return
    const melden = () => {
      document.documentElement.style.setProperty(
        '--buero-fussleiste-hoehe',
        `${Math.round(knoten.getBoundingClientRect().height)}px`,
      )
    }
    melden()
    const wache = new ResizeObserver(melden)
    wache.observe(knoten)
    return () => {
      wache.disconnect()
      document.documentElement.style.removeProperty('--buero-fussleiste-hoehe')
    }
  }, [insBlatt.length, inLeiste.length])

  /*
   * Nicht weggehen, ohne zu fragen.
   *
   * **Warum das hierher gehört.** „Verwerfen" gab es bis eben gar nicht —
   * wer eine Änderung loswerden wollte, verließ die Seite. Und genau dabei
   * sagte niemand etwas: Ein Tipp auf „Übersicht" in der Leiste unten, und
   * eine halbe Stunde Tipparbeit war weg, ohne Rückfrage, ohne Spur.
   *
   * Die Leiste weiß als Einzige, ob etwas offen ist. Also fragt sie auch —
   * jedes Formular, das `geaendert` meldet, bekommt die Warnung mit, ohne
   * eine Zeile dafür zu schreiben.
   *
   * **Zwei Wege hinaus, zwei Wächter.** `beforeunload` deckt ab, was der
   * Browser selbst tut: Neuladen, Schließen, eine fremde Adresse. Innerhalb
   * des Büros wird aber gar nicht neu geladen — dort fängt der Klick auf
   * einen Verweis ab, was sonst lautlos durchginge. Wer bestätigt, geht;
   * dann nimmt sich der erste Wächter für diesen einen Schritt zurück,
   * damit nicht zweimal dieselbe Frage kommt.
   *
   * **Was hier nicht geht:** der Zurück-Knopf des Browsers. Den lässt sich
   * ohne Eingriffe in den Verlauf nicht sauber aufhalten, und ein Eingriff
   * in den Verlauf bricht mehr, als er rettet.
   */
  const darfGehen = useRef(false)
  useEffect(() => {
    if (!geaendert) return
    darfGehen.current = false

    const vorWeg = (e: BeforeUnloadEvent) => {
      if (darfGehen.current) return
      e.preventDefault()
      // Ältere Browser zeigen nur etwas, wenn hier etwas zugewiesen wird
      e.returnValue = ''
    }

    const beiKlick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const ziel = (e.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!ziel || ziel.hasAttribute('download')) return
      if (ziel.target && ziel.target !== '_self') return
      let adresse: URL
      try {
        adresse = new URL(ziel.href, window.location.href)
      } catch {
        return
      }
      // Fremde Adressen und Sprungmarken auf derselben Seite gehen den
      // Browser an, nicht uns
      if (adresse.origin !== window.location.origin) return
      if (adresse.pathname === window.location.pathname) return

      if (window.confirm('Hier stehen ungespeicherte Änderungen. Trotzdem weggehen?')) {
        darfGehen.current = true
        return
      }
      e.preventDefault()
      e.stopPropagation()
    }

    window.addEventListener('beforeunload', vorWeg)
    document.addEventListener('click', beiKlick, true)
    return () => {
      window.removeEventListener('beforeunload', vorWeg)
      document.removeEventListener('click', beiKlick, true)
    }
  }, [geaendert])

  // Ein offenes Blatt schließt sich beim Zurückgehen, nicht die ganze Seite
  useEffect(() => {
    if (!blattOffen) return
    const zu = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setBlattOffen(false)
    }
    window.addEventListener('keydown', zu)
    return () => window.removeEventListener('keydown', zu)
  }, [blattOffen])

  return (
    <>
      <div
        className={`buero-fussleiste${geaendert ? ' wach' : ''}`}
        ref={leiste}
      >
        {geaendert || hinweis ? (
          <div className="buero-fussleiste-hinweis">
            {geaendert ? <strong className="buero-fussleiste-offen">Nicht gespeichert</strong> : null}
            {geaendert && aufVerwerfen ? (
              <button
                type="button"
                className="buero-knopf stumm schmal buero-verwerfen"
                onClick={() => {
                  if (window.confirm('Alle Änderungen verwerfen und zurück zum gespeicherten Stand?'))
                    aufVerwerfen()
                }}
              >
                Verwerfen
              </button>
            ) : null}
            {geaendert && hinweis ? ' · ' : null}
            {hinweis}
          </div>
        ) : null}
        {inLeiste}
        {insBlatt.length > 0 && (
          <button
            type="button"
            className="buero-knopf leise buero-mehr-knopf"
            aria-label="Weitere Aktionen"
            aria-expanded={blattOffen}
            onClick={() => setBlattOffen(true)}
          >
            ⋯
          </button>
        )}
        {/*
          * Am Rechner ist Platz — dort steht alles nebeneinander, und das
          * Blatt bleibt zu. Zwei Fassungen desselben Knopfes wären doppelte
          * Pflege; einer, den das Stylesheet je nach Breite versteckt, nicht.
          */}
        {insBlatt.length > 0 && <div className="buero-nebensachen">{insBlatt}</div>}
      </div>

      {blattOffen && (
        <>
          <button
            type="button"
            className="buero-blatt-grund"
            aria-label="Schließen"
            onClick={() => setBlattOffen(false)}
          />
          <div className="buero-blatt" role="dialog" aria-label="Weitere Aktionen">
            <div className="buero-blatt-griff" />
            <div
              className="buero-blatt-aktionen"
              // Nach der Wahl schließt sich das Blatt — man will danach das
              // Ergebnis sehen und nicht erst wegtippen müssen
              onClick={() => setBlattOffen(false)}
            >
              {insBlatt}
            </div>
          </div>
        </>
      )}
    </>
  )
}
