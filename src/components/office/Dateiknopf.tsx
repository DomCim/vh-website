'use client'

import React from 'react'

/**
 * Ein Knopf, der den Dateidialog öffnet — und zwar zuverlässig.
 *
 * **Warum es den braucht.** An fünf Stellen stand dasselbe Muster: ein
 * `<input type="file" hidden>` und daneben ein Knopf, der ihn per
 * `.click()` auslöst. Am Rechner geht das immer. Auf dem iPhone geht es
 * meistens — gemeldet als „mal funktioniert es, mal nicht" (#40, #42).
 *
 * `hidden` heißt `display: none`, und ein Feld, das nicht gezeichnet wird,
 * ist für WebKit kein Ziel einer Berührung. Der Aufruf aus dem Skript zählt
 * dort nur, solange er unmittelbar in der Geste steckt; kommt etwas
 * dazwischen — ein Zustandswechsel, ein Neuzeichnen —, verwirft iOS ihn
 * stillschweigend. Genau das erklärt das Sprunghafte: Es hängt daran, was
 * React im selben Moment gerade tut.
 *
 * **Deshalb hier kein Skript.** Das Feld liegt in einer Beschriftung und wird
 * unsichtbar gemacht, ohne aus dem Aufbau zu fallen: Wer den Knopf berührt,
 * berührt das Feld selbst. Das ist eine echte Geste, und die verwirft kein
 * Browser.
 *
 * **Gesperrt wird als Knopf, nicht als Beschriftung.** Eine Beschriftung
 * kennt kein `disabled` — sie führte weiter zum Dialog, auch wenn schon
 * genug Dateien gewählt sind. Dann steht hier ein gewöhnlicher, gesperrter
 * Knopf.
 */
export function Dateiknopf({
  text,
  nimm,
  accept,
  mehrere,
  aufnehmen,
  gesperrt,
  klasse = 'buero-knopf leise',
}: {
  text: string
  /** Bekommt die Auswahl; das Feld wird danach geleert (dieselbe Datei erneut wählbar) */
  nimm: (dateien: FileList) => void
  accept?: string
  mehrere?: boolean
  /** `capture`: die Kamera statt der Mediathek — nur setzen, wo das gemeint ist */
  aufnehmen?: 'environment' | 'user'
  gesperrt?: boolean
  klasse?: string
}) {
  if (gesperrt) {
    return (
      <button type="button" className={klasse} disabled>
        {text}
      </button>
    )
  }

  return (
    <label className={klasse} style={{ cursor: 'pointer' }}>
      {text}
      <input
        type="file"
        accept={accept}
        multiple={mehrere}
        capture={aufnehmen}
        onChange={(e) => {
          if (e.target.files?.length) nimm(e.target.files)
          e.target.value = ''
        }}
        /*
         * Unsichtbar, aber vorhanden: `display: none` nähme WebKit die
         * Möglichkeit, die Berührung überhaupt zuzuordnen. Ein Feld ohne
         * Ausdehnung an derselben Stelle tut das zuverlässig.
         */
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          overflow: 'hidden',
          clipPath: 'inset(50%)',
          pointerEvents: 'none',
        }}
      />
    </label>
  )
}
