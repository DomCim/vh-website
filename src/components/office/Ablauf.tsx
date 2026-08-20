'use client'

import React from 'react'

import {
  type Arbeitsschritt,
  mindestDauerTage,
  naechsterSchritt,
  planStand,
} from '../../lib/arbeitsplan'

/**
 * Der Ablauf eines Auftrags — was schon war, was gerade läuft, was kommt.
 *
 * **Wofür das da ist.** Ein Stück geht durch mehrere Hände: zuschneiden,
 * schweißen, verzinken, beschichten, montieren. Wer es in die Hand nimmt, muss
 * wissen, was als Nächstes damit passiert — und wer es weggibt, wann es
 * zurückkommt. Das stand bisher nirgends.
 *
 * **Was oben steht, ist die einzige Frage, die zählt.** „Jetzt dran: Verzinken
 * bei Meier, 5 Tage" — der Rest ist Nachschlagewerk. Deshalb steht der laufende
 * Schritt groß und alles andere darunter.
 *
 * **Rein intern.** Nichts davon steht auf einem Papier für die Kundschaft. Dass
 * ein Dienstleister im Spiel ist und welcher, geht sie nichts an.
 */

const STAND_TEXT: Record<string, string> = {
  offen: 'offen',
  laeuft: 'läuft',
  erledigt: 'erledigt',
}

function name(wert: unknown): string | null {
  if (!wert) return null
  if (typeof wert === 'object') return (wert as { name?: string }).name ?? null
  return null
}

export function Ablauf({
  plan,
  aendern,
}: {
  plan: Arbeitsschritt[]
  /** Fehlt sie, ist die Anzeige nur zum Lesen — etwa an einem alten Auftrag */
  aendern?: (index: number, stand: 'offen' | 'laeuft' | 'erledigt') => void
}) {
  const jetzt = naechsterSchritt(plan)
  const stand = planStand(plan)
  const tage = mindestDauerTage(plan)

  if (!plan.length) {
    return (
      <div className="buero-leer">
        Für diesen Auftrag ist kein Ablauf hinterlegt. Er lässt sich am Artikel als Vorlage
        pflegen oder hier von Hand anlegen.
      </div>
    )
  }

  return (
    <section className="buero-ablauf">
      {/*
        * Der Kopf beantwortet zwei Fragen auf einmal: Was ist jetzt dran, und
        * wie lange dauert das Ganze mindestens. Die zweite ist die, die man
        * beim Zusagen eines Termins braucht — und die man ohne Ablauf falsch
        * beantwortet, weil die Tage beim Verzinker nicht mitgerechnet werden.
        */}
      <div className="buero-ablauf-kopf">
        {stand.fertig ? (
          <strong>Alle Schritte erledigt.</strong>
        ) : jetzt ? (
          <>
            <span className="buero-unterzeile">Jetzt dran</span>
            <strong>{jetzt.schritt.was}</strong>
            {jetzt.schritt.art === 'fremd' && (
              <span className="buero-unterzeile">
                {[
                  name(jetzt.schritt.dienstleister) ?? 'Dienstleister',
                  jetzt.schritt.vorlaufTage ? `${jetzt.schritt.vorlaufTage} Tage` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </>
        ) : null}
        <span className="buero-marker">
          {stand.erledigt} von {stand.gesamt}
          {tage > 0 ? ` · mind. ${tage} Tage` : ''}
        </span>
      </div>

      <ol className="buero-ablauf-liste">
        {plan.map((schritt, i) => {
          const s = schritt.stand ?? 'offen'
          return (
            <li key={i} className={`buero-ablauf-schritt ist-${s}`}>
              <div className="buero-ablauf-zeile">
                <span className="buero-ablauf-nummer">{i + 1}</span>
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{schritt.was}</div>
                  <div className="buero-zeile-neben">
                    {[
                      schritt.art === 'fremd'
                        ? (name(schritt.dienstleister) ?? 'Dienstleister')
                        : 'eigene Arbeit',
                      schritt.art === 'fremd'
                        ? schritt.vorlaufTage
                          ? `${schritt.vorlaufTage} Tage`
                          : null
                        : schritt.minuten
                          ? `${schritt.minuten} min`
                          : null,
                      schritt.notiz,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                {aendern ? (
                  <select
                    value={s}
                    aria-label={`Stand von ${schritt.was}`}
                    onChange={(e) =>
                      aendern(i, e.target.value as 'offen' | 'laeuft' | 'erledigt')
                    }
                  >
                    <option value="offen">offen</option>
                    <option value="laeuft">läuft</option>
                    <option value="erledigt">erledigt</option>
                  </select>
                ) : (
                  <span className="buero-marker">{STAND_TEXT[s]}</span>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
