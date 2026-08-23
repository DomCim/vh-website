import React from 'react'

/**
 * „Gespeichert." — und wie es auch ankommt, wenn niemand hinsieht.
 *
 * Fast jedes Formular im Büro hat eine Zeile, die sagt, was gerade passiert
 * ist: gespeichert, gemerkt, hat nicht geklappt. Sie stand überall als
 * `{meldung && <p className="buero-hinweis">…</p>}` — sichtbar, aber stumm.
 *
 * **Warum das stumm war.** Ein Vorleser sagt an, was sich in einem
 * **vorhandenen** Bereich ändert. Ein Bereich, der zusammen mit seinem Text
 * erst entsteht, wird dabei oft überhört — angekündigt wird die Änderung, und
 * ein Element, das es vorher nicht gab, hat sich nicht geändert. Deshalb steht
 * die Hülle hier immer, auch leer.
 *
 * **Und warum die leere Hülle trotzdem keinen Platz braucht.** Ein leeres
 * `div` ist in einer Zeile aus Flex- oder Rasterelementen trotzdem ein
 * Element und würde einen Zwischenraum aufreißen — in fünfunddreißig
 * Formularen an fünfunddreißig Stellen, die niemand nachmisst. `:empty`
 * schiebt es deshalb aus dem Fluss, ohne es aus dem Baum zu nehmen, den der
 * Vorleser liest (siehe `.buero-ansage` in `styles/office.css`).
 *
 * `polite` und nicht `assertive`: Diese Zeilen sind Bestätigungen, keine
 * Alarme. Wer gerade tippt, soll nicht mitten im Wort unterbrochen werden.
 */
export function Rueckmeldung({ text }: { text?: string | null }) {
  return (
    <div className="buero-ansage" role="status" aria-live="polite">
      {text ? <p className="buero-hinweis">{text}</p> : null}
    </div>
  )
}
