'use client'

import React from 'react'

import { useBeimOeffnenAbhaken, useNeuerungen } from '../../../../lib/buero/neuerungen'
import { kopfUndRest, zerlegen, type Neuerungspunkt } from '../../../../lib/neuerungen'

/**
 * Was sich getan hat — im Büro nachlesbar.
 *
 * **Warum das hier anders aussieht als vorher.** Die Seite las bis August 2026
 * die Datei `CHANGELOG.md` und setzte sie mit einem kleinen Markdown-Umsetzer
 * zusammen. Der kannte Überschriften, Listen und Fettung; alles andere stand
 * als Zeichen im Text — Sternchen um Kursives, Backticks um Pfade —, und
 * verschachtelte Punkte fielen auf eine Ebene zusammen. Vor allem aber war es
 * eine Wand: vierundvierzig Fassungen und dreihundert Absätze in einem Block,
 * ohne Datum am Rand und ohne Hinweis darauf, was davon neu ist.
 *
 * Jetzt kommen die Einträge aus der Datenbank (Bereich `neuerungen`, also auch
 * ohne Netz da), jeder mit Datum, Überschrift und seinen Punkten. Der erste
 * Satz eines Punktes ist seine Überschrift — so sind sie geschrieben, und so
 * lässt sich die Liste überfliegen.
 *
 * Geöffnet gilt gelesen: Der Banner oben verschwindet, was beim Öffnen neu
 * war, bleibt aber für diesen Besuch gekennzeichnet — ein Hinweis, der
 * weggeht, ohne dass man sieht wofür, wäre die schlechtere Hälfte davon.
 */

const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

/** „14. August 2026" — ausgeschrieben, das liest sich hier besser als 14.08. */
function langesDatum(wert?: string | null): string {
  if (!wert) return ''
  const d = new Date(wert)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`
}

/** Überschrift der Gruppe: „August 2026" */
function monatsGruppe(wert?: string | null): string {
  if (!wert) return 'Ohne Datum'
  const d = new Date(wert)
  if (Number.isNaN(d.getTime())) return 'Ohne Datum'
  return `${MONATE[d.getMonth()]} ${d.getFullYear()}`
}

/** Setzt `**fett**` und Pfade in Backticks — mehr Auszeichnung gibt es nicht. */
function Text({ inhalt }: { inhalt: string }) {
  return (
    <>
      {zerlegen(inhalt).map((teil, i) =>
        teil.art === 'fett' ? (
          <strong key={i}>{teil.inhalt}</strong>
        ) : teil.art === 'pfad' ? (
          <code key={i}>{teil.inhalt}</code>
        ) : (
          <React.Fragment key={i}>{teil.inhalt}</React.Fragment>
        ),
      )}
    </>
  )
}

function Punkt({ punkt }: { punkt: Neuerungspunkt }) {
  const { kopf, rest } = kopfUndRest(punkt.text)
  return (
    <li className="buero-neu-punkt">
      {kopf ? <p className="buero-neu-punkt-kopf">{kopf}</p> : null}
      {rest.trim() ? (
        <p className="buero-neu-punkt-text">
          <Text inhalt={rest} />
        </p>
      ) : null}
      {punkt.unter?.length ? (
        <ul className="buero-neu-unter">
          {punkt.unter.map((u, i) => (
            <li key={i}>
              <Text inhalt={u.text} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

export function NeuerungenAnsicht() {
  const alle = useNeuerungen()
  /*
   * Abhaken und zugleich merken, was dabei neu war. Das Abhaken passiert beim
   * Öffnen — wer hier ist, hat es gesehen.
   */
  const standBeimOeffnen = useBeimOeffnenAbhaken()

  let letzteGruppe = ''

  return (
    <>
      <h1>Neuerungen</h1>
      <p className="buero-unterzeile">
        Was sich zuletzt getan hat, neueste zuerst. Was hier steht, läuft auch — ein Eintrag
        erscheint an dem Tag, an dem die Fassung ausgerollt wurde.
      </p>

      {alle.length === 0 ? (
        <div className="buero-karte">Noch nichts eingetragen.</div>
      ) : (
        <div className="buero-neu-leiste">
          {alle.map((eintrag, platz) => {
            const gruppe = monatsGruppe(eintrag.datum)
            const neueGruppe = gruppe !== letzteGruppe
            letzteGruppe = gruppe
            const istNeu = eintrag.nummer > standBeimOeffnen
            /*
             * Aufgeklappt ist, was neu ist, und die drei jüngsten Fassungen.
             * Der Rest steht als Zeile da und lässt sich aufklappen: Alles auf
             * einmal ist ein Jahr Hausgeschichte am Stück, und danach sucht
             * hier niemand.
             */
            const offen = istNeu || platz < 3

            return (
              <React.Fragment key={eintrag.id}>
                {neueGruppe ? <h2 className="buero-neu-monat">{gruppe}</h2> : null}
                <details className={`buero-neu-eintrag${istNeu ? ' ist-neu' : ''}`} open={offen}>
                  <summary>
                    <span className="buero-neu-kopf">
                      <span className="buero-neu-datum">{langesDatum(eintrag.datum)}</span>
                      {istNeu ? <span className="buero-neu-marke">Neu</span> : null}
                    </span>
                    <span className="buero-neu-titel">{eintrag.titel}</span>
                  </summary>
                  <ul className="buero-neu-punkte">
                    {(eintrag.punkte ?? []).map((p, i) => (
                      <Punkt key={i} punkt={p} />
                    ))}
                  </ul>
                </details>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </>
  )
}
