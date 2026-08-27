'use client'

import React from 'react'

import {
  type Arbeitsschritt,
  mindestDauerTage,
  naechsterSchritt,
  planStand,
} from '../../lib/arbeitsplan'
import { PartnerBezug } from './PartnerBezug'
import { Zahleingabe } from './Zahleingabe'

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

/**
 * Erlaubt das Anlegen und Umbauen der Schritte — nicht nur das Abhaken.
 *
 * Ein Bauteil für Anzeige und Editor, keine zwei: Die Schritt-Zeile existiert
 * genau einmal, und zwei Fassungen liefen auseinander, sobald jemand ein Feld
 * ergänzt — dasselbe Argument, mit dem `arbeitsschritte()` selbst nur einmal
 * existiert.
 */
export type AblaufBearbeiten = {
  /** Ersetzt die ganze Liste — die Reihenfolge ist die Aussage */
  ersetzen: (plan: Arbeitsschritt[]) => void
  /** false an Artikel und Variante: Eine Vorlage kennt keinen Stand */
  mitStand: boolean
}

const NEUER_SCHRITT: Arbeitsschritt = { was: '', art: 'eigen', stand: 'offen' }

function dienstleisterId(wert: unknown): number | '' {
  if (typeof wert === 'number') return wert
  if (typeof wert === 'object' && wert !== null) {
    const id = (wert as { id?: number }).id
    return typeof id === 'number' ? id : ''
  }
  return ''
}

export function Ablauf({
  plan,
  aendern,
  bearbeiten,
}: {
  plan: Arbeitsschritt[]
  /** Fehlt sie, ist die Anzeige nur zum Lesen — etwa an einem alten Auftrag */
  aendern?: (index: number, stand: 'offen' | 'laeuft' | 'erledigt') => void
  /** Wenn gesetzt, lassen sich Schritte anlegen, ändern und umsortieren */
  bearbeiten?: AblaufBearbeiten
}) {
  const jetzt = naechsterSchritt(plan)
  const stand = planStand(plan)
  const tage = mindestDauerTage(plan)

  const schrittSetzen = (index: number, teil: Partial<Arbeitsschritt>) =>
    bearbeiten?.ersetzen(plan.map((s, i) => (i === index ? { ...s, ...teil } : s)))

  /*
   * Umsortieren über Pfeile, nicht Ziehen: Die Büro-App läuft am
   * Werkstatt-Tablet, und ein Griff mit Handschuhen trifft einen Knopf —
   * keine Ziehgeste. Eine Drag-Bibliothek wäre dafür ein Bündel-Brocken.
   */
  const schieben = (index: number, richtung: -1 | 1) => {
    const ziel = index + richtung
    if (ziel < 0 || ziel >= plan.length) return
    const neu = [...plan]
    ;[neu[index], neu[ziel]] = [neu[ziel], neu[index]]
    bearbeiten?.ersetzen(neu)
  }

  if (!plan.length) {
    return (
      <div className="buero-leer">
        {bearbeiten ? (
          <>
            Noch kein Ablauf hinterlegt.{' '}
            <button
              type="button"
              className="buero-knopf leise"
              onClick={() => bearbeiten.ersetzen([{ ...NEUER_SCHRITT }])}
            >
              Ersten Schritt anlegen
            </button>
          </>
        ) : (
          // Ehrlich bleiben: Ohne Editor gibt es hier nichts anzulegen
          'Kein Ablauf hinterlegt.'
        )}
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
                {bearbeiten ? (
                  <div className="buero-zeile-haupt">
                    <div className="buero-reihe">
                      <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
                        <span>Schritt</span>
                        <input
                          value={schritt.was ?? ''}
                          placeholder="z.B. Zuschnitt, Schweißen, Verzinken"
                          onChange={(e) => schrittSetzen(i, { was: e.target.value })}
                        />
                      </label>
                      <label className="buero-feld">
                        <span>Art</span>
                        <select
                          value={schritt.art === 'fremd' ? 'fremd' : 'eigen'}
                          onChange={(e) =>
                            schrittSetzen(i, { art: e.target.value === 'fremd' ? 'fremd' : 'eigen' })
                          }
                        >
                          <option value="eigen">Eigene Arbeit</option>
                          <option value="fremd">Dienstleister</option>
                        </select>
                      </label>
                      {schritt.art === 'fremd' ? (
                        <>
                          <PartnerBezug
                            wert={dienstleisterId(schritt.dienstleister)}
                            beschriftung="Betrieb"
                            aendern={(id) => schrittSetzen(i, { dienstleister: id || null })}
                          />
                          <label className="buero-feld">
                            <span>Kosten netto (EUR)</span>
                            <Zahleingabe
                              wert={schritt.kosten}
                              aendern={(v) => schrittSetzen(i, { kosten: v })}
                            />
                          </label>
                          <label className="buero-feld">
                            <span>Vorlauf (Tage)</span>
                            <Zahleingabe
                              wert={schritt.vorlaufTage}
                              aendern={(v) => schrittSetzen(i, { vorlaufTage: v })}
                            />
                          </label>
                        </>
                      ) : (
                        <label className="buero-feld">
                          <span>Minuten</span>
                          <Zahleingabe
                            wert={schritt.minuten}
                            aendern={(v) => schrittSetzen(i, { minuten: v })}
                          />
                        </label>
                      )}
                      <label className="buero-feld">
                        <span>Bemerkung</span>
                        <input
                          value={schritt.notiz ?? ''}
                          onChange={(e) => schrittSetzen(i, { notiz: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
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
                )}
                {aendern && (!bearbeiten || bearbeiten.mitStand) ? (
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
                ) : !bearbeiten ? (
                  <span className="buero-marker">{STAND_TEXT[s]}</span>
                ) : null}
                {bearbeiten && (
                  <div style={{ display: 'flex', gap: '.3rem', alignItems: 'flex-start' }}>
                    <button
                      type="button"
                      className="buero-knopf leise"
                      aria-label={`${schritt.was || 'Schritt'} nach oben`}
                      disabled={i === 0}
                      onClick={() => schieben(i, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="buero-knopf leise"
                      aria-label={`${schritt.was || 'Schritt'} nach unten`}
                      disabled={i === plan.length - 1}
                      onClick={() => schieben(i, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="buero-knopf leise"
                      aria-label={`${schritt.was || 'Schritt'} entfernen`}
                      onClick={() => bearbeiten.ersetzen(plan.filter((_, idx) => idx !== i))}
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {bearbeiten && (
        <button
          type="button"
          className="buero-knopf leise"
          onClick={() => bearbeiten.ersetzen([...plan, { ...NEUER_SCHRITT }])}
        >
          Schritt hinzufügen
        </button>
      )}
    </section>
  )
}
