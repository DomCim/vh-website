'use client'

import React from 'react'

/**
 * Die Hauptaktion einer Seite — am Handy dort, wo der Daumen liegt.
 *
 * Gebucht, gespeichert und verschickt wird an der Werkbank und nicht am
 * Schreibtisch. Stand die Hauptaktion unter dem Formular, war sie schon bei
 * zwei Positionen aus dem Bild: tippen, scrollen, suchen, tippen.
 *
 * Deshalb klebt sie am Handy über der Tableiste und geht über die volle
 * Breite; am Rechner steht sie rechts unter dem Formular, wo sie hingehört.
 * Das macht das Stylesheet — hier steht nur, was drinsteht.
 *
 * `sticky` statt `fixed` ist Absicht: Ein festgenagelter Balken springt,
 * sobald die Bildschirmtastatur aufgeht, weil iOS dann nur den sichtbaren
 * Ausschnitt verschiebt und nicht die Seite. Zusätzlich nimmt
 * `Tastaturwache` die Leiste beim Tippen ganz aus dem Kleben.
 *
 * Genau **eine** primäre Handlung pro Seite. Steht daneben noch etwas, ist
 * es `leise` oder `stumm` — sonst ist wieder nichts die Hauptsache.
 */
export function Fussleiste({
  hinweis,
  children,
}: {
  /** Kurzer Stand links neben der Aktion, z.B. „3 Positionen · 480,00 €" */
  hinweis?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="buero-fussleiste">
      {hinweis ? <div className="buero-fussleiste-hinweis">{hinweis}</div> : null}
      {children}
    </div>
  )
}
