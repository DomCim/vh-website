'use client'

import React, { useState } from 'react'

/**
 * Der Besucherverlauf als Balken — und der Grund, warum er ein Bauteil wurde.
 *
 * **Was vorher kaputt war.** Jeder Balken trug seinen Wert in einem
 * `title`-Anhang. Am Rechner erscheint daraus nach einer Sekunde ein kleines
 * Kästchen; **am Handy erscheint gar nichts**, denn ein Finger schwebt nicht.
 * Das Büro wird am Handy bedient. Dreißig Balken, und auf dem Gerät, an dem
 * man sie ansieht, war kein einziger Wert lesbar.
 *
 * **Was jetzt passiert.** Jeder Balken ist ein Knopf. Antippen, überfahren
 * oder antabben zeigt Tag und Zahl in der Zeile darunter — an einer festen
 * Stelle, nicht in einem Kästchen, das den Nachbarbalken verdeckt. Ohne
 * Auswahl steht dort, was ohnehin dort stand: erster Tag, Höchstwert, letzter
 * Tag.
 *
 * **Und darunter die Tabelle.** Ein Balken ist für einen Vorleser nichts, und
 * eine Zusammenfassung in einem Satz beantwortet nicht die Frage „was war am
 * Dienstag?". Sie ist eingeklappt, weil sie im Alltag niemand aufmacht — aber
 * sie ist da, und sie ist die einzige Fassung, die sich kopieren lässt.
 *
 * **Warum kein Diagramm-Paket.** Ein paar `div` mit Höhe in Prozent tun
 * dasselbe, kosten nichts im Browser und brechen nicht, wenn das Büro schmal
 * wird. Das galt vorher und gilt weiter.
 */

export type Verlaufstag = { tag: string; besucher: number }

const zahlText = (wert: number) => new Intl.NumberFormat('de-DE').format(Math.round(wert))

export function Verlauf({ tage }: { tage: Verlaufstag[] }) {
  const [aktiv, setAktiv] = useState<number | null>(null)
  if (!tage.length) return null

  const hoechst = Math.max(...tage.map((t) => t.besucher), 1)
  const summe = tage.reduce((s, t) => s + t.besucher, 0)
  const beste = tage.reduce((a, b) => (b.besucher > a.besucher ? b : a), tage[0])
  const gezeigt = aktiv === null ? null : tage[aktiv]

  return (
    <div className="buero-karte" style={{ marginTop: '1rem' }}>
      <div className="buero-kachel-titel">Verlauf</div>

      <div
        className="buero-verlauf"
        onMouseLeave={() => setAktiv(null)}
        role="group"
        aria-label={`Verlauf über ${tage.length} Tage, insgesamt ${zahlText(summe)} Besucher. Stärkster Tag: ${beste.tag} mit ${zahlText(beste.besucher)}.`}
      >
        {tage.map((t, i) => (
          <button
            key={t.tag}
            type="button"
            className={`buero-verlauf-saeule${aktiv === i ? ' aktiv' : ''}`}
            onMouseEnter={() => setAktiv(i)}
            onFocus={() => setAktiv(i)}
            onBlur={() => setAktiv(null)}
            onClick={() => setAktiv(aktiv === i ? null : i)}
            aria-label={`${t.tag}: ${zahlText(t.besucher)} Besucher`}
          >
            {/*
              Die Säule ist der Trefferbereich, der Balken darin die Anzeige.
              Ein Balken von zwei Pixeln Höhe ließe sich sonst nicht antippen —
              und antippen ist am Handy der einzige Weg zum Wert.
            */}
            <span
              className="buero-verlauf-balken"
              style={{
                height: t.besucher ? `${Math.max((t.besucher / hoechst) * 100, 3)}%` : '0',
              }}
            />
          </button>
        ))}
      </div>

      {/*
        Eine Zeile, zwei Zustände — und beide gleich hoch. Ein Kästchen, das
        beim Überfahren aufgeht, schöbe die Tabelle darunter jedes Mal ein
        Stück weiter.
      */}
      <div className="buero-verlauf-achse" aria-live="polite">
        {gezeigt ? (
          <span className="buero-verlauf-gewaehlt">
            {gezeigt.tag} · {zahlText(gezeigt.besucher)} Besucher
          </span>
        ) : (
          <>
            <span>{tage[0]?.tag}</span>
            <span>Höchstwert {zahlText(hoechst)}</span>
            <span>{tage[tage.length - 1]?.tag}</span>
          </>
        )}
      </div>

      <details className="buero-aufklapper" style={{ marginTop: '.8rem' }}>
        <summary>Zahlen als Tabelle</summary>
        <table className="buero-tabelle">
          <thead>
            <tr>
              <th scope="col">Tag</th>
              <th scope="col">Besucher</th>
            </tr>
          </thead>
          <tbody>
            {tage.map((t) => (
              <tr key={t.tag}>
                <td>{t.tag}</td>
                <td className="buero-betrag">{zahlText(t.besucher)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
