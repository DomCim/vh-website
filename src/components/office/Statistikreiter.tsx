import Link from 'next/link'
import React from 'react'

import { ZEITRAEUME, type Zeitraum } from '../../lib/statistik'

/**
 * Der Kopf der Statistik: erst welche Ansicht, dann welcher Zeitraum.
 *
 * Beide Ansichten beantworten dieselbe Frage aus zwei Entfernungen — die
 * Zusammenfassung sagt, wie viel los war, die einzelnen Besuche sagen, was
 * einer getan hat. Deshalb stehen sie nebeneinander und nicht hintereinander:
 * Der Weg dorthin war vorher ein Knopf ganz unten, den man erst findet, wenn
 * man bis ans Ende gescrollt hat — man musste also wissen, dass es ihn gibt,
 * um zu erfahren, dass es ihn gibt.
 *
 * Der Zeitraum wandert beim Wechsel mit. Wer sich dreißig Tage angesehen hat
 * und dann wissen will, wer da einzeln kam, meint dieselben dreißig Tage;
 * ihn dabei stillschweigend auf sieben zurückzusetzen wäre die Art
 * Kleinigkeit, die man sich zweimal erklärt und beim dritten Mal nicht mehr
 * bemerkt — und dann falsche Schlüsse zieht.
 */

const ANSICHTEN = [
  { schluessel: 'zahlen', label: 'Zusammenfassung', pfad: '/office/statistik' },
  { schluessel: 'besuche', label: 'Einzelne Besuche', pfad: '/office/statistik/besuche' },
] as const

export type Statistikansicht = (typeof ANSICHTEN)[number]['schluessel']

export function Statistikreiter({
  ansicht,
  zeitraum,
}: {
  ansicht: Statistikansicht
  zeitraum: Zeitraum
}) {
  return (
    <div className="buero-reiter-paar">
      <div className="buero-reiter">
        {ANSICHTEN.map((a) => (
          <Link
            key={a.schluessel}
            href={`${a.pfad}?zeitraum=${zeitraum}`}
            aria-current={a.schluessel === ansicht ? 'page' : undefined}
          >
            {a.label}
          </Link>
        ))}
      </div>
      <div className="buero-reiter">
        {(Object.keys(ZEITRAEUME) as Zeitraum[]).map((z) => (
          <Link
            key={z}
            href={`${ANSICHTEN.find((a) => a.schluessel === ansicht)!.pfad}?zeitraum=${z}`}
            aria-current={z === zeitraum ? 'page' : undefined}
          >
            {ZEITRAEUME[z].label}
          </Link>
        ))}
      </div>
    </div>
  )
}
