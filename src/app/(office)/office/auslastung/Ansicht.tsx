'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import {
  auslastung,
  ersteFreieWoche,
  type AuslastungsAuftrag,
  type Wochenkapazitaet,
} from '../../../../lib/auslastung'
import { useBestand, useRahmen } from '../../../../lib/buero/bestand'
import { absenden } from '../../../../lib/buero/warteschlange'
import { balkenKlasse } from '../../../../lib/listen'
import { zahlAusText } from '../../../../lib/zahleingabe'
import { Zahleingabe } from '../../../../components/office/Zahleingabe'
import { Rueckmeldung } from '../../../../components/office/Rueckmeldung'

/**
 * Wie voll die nächsten Wochen sind.
 *
 * Die Frage, die diese Seite beantwortet, wird am Telefon gestellt: „Wann
 * könnten Sie das machen?" Bisher wurde sie aus dem Bauch beantwortet — der
 * Kalender zeigte zwar, was wann fällig ist, aber nicht, wie viele Stunden
 * dahinterstehen. Bei Einzelfertigung entscheidet genau das.
 *
 * Die verfügbare Zeit steht je Woche und ist von hier aus änderbar. Das ist
 * kein Beiwerk, sondern der Kern: Die Werkstatt läuft neben einem Hauptberuf,
 * und eine feste Wochenzahl wäre genau dann falsch, wenn es darauf ankommt.
 * Wer weiß, dass nächste Woche nichts geht, trägt eine Null ein — und die
 * Auslastung sagt danach die Wahrheit.
 *
 * Gerechnet wird aus dem Bestand im Gerät. Die Seite steht damit auch in der
 * Werkstatt ohne Netz, und geänderte Stunden gehen über die Warteschlange raus.
 */

const stunden = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`

const kurz = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

type Werkstattwoche = Wochenkapazitaet & { id: number | string }

export function AuslastungAnsicht() {
  const auftraege = useBestand<AuslastungsAuftrag>('auftraege')
  const kapazitaeten = useBestand<Werkstattwoche>('werkstattwochen')
  const { wochenstunden } = useRahmen()
  const [gebraucht, setGebraucht] = useState(20)
  const [meldung, setMeldung] = useState<string | null>(null)

  const wochen = useMemo(
    () => auslastung(auftraege, { stundenProWoche: wochenstunden, wochen: 16, kapazitaeten }),
    [auftraege, wochenstunden, kapazitaeten],
  )

  const frei = ersteFreieWoche(wochen, gebraucht)

  // Aufträge, die nichts beitragen, weil niemand ihre Zeit geschätzt hat.
  // Ohne diesen Hinweis sieht eine Woche leer aus, in der Arbeit liegt.
  const ohneSchaetzung = auftraege.filter(
    (a) =>
      (a.status === 'geplant' || a.status === 'inFertigung') && a.dueDate && !a.plannedMinutes,
  )

  /**
   * Die Stunden einer Woche setzen — oder den Eintrag wieder entfernen.
   *
   * Leeres Feld heißt „es gilt wieder die Faustregel", eine Null heißt „diese
   * Woche geht nichts". Das ist nicht dasselbe, und deshalb sind es zwei Fälle.
   */
  async function setzen(woche: string, wert: string) {
    const gelesen = zahlAusText(wert, null)
    const stundenWert = gelesen == null ? null : Math.max(gelesen, 0)
    setMeldung(null)
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/werkstattwoche',
        bereich: 'werkstattwochen',
        koerper: { woche, stunden: stundenWert },
        vorschau: { woche, stunden: stundenWert },
      })
      if (!sofort) setMeldung('Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    }
  }

  return (
    <>
      <h1>Auslastung</h1>
      <p className="buero-unterzeile">
        Zugesagte Fertigungsstunden je Woche. Die verfügbare Zeit steht rechts an jeder Woche und
        lässt sich dort ändern — Urlaub, viel im Hauptberuf, eine ruhige Woche. Ohne eigene Angabe
        gelten {stunden(wochenstunden)} aus den Einstellungen.
      </p>

      <div className="buero-karte">
        <label className="buero-feld">
          <span>Wie viele Stunden braucht das neue Stück?</span>
          <Zahleingabe wert={gebraucht} beiLeer={0} aendern={(v) => setGebraucht(v ?? 0)} />
        </label>
        <p style={{ margin: 0 }}>
          {frei ? (
            <>
              Platz ist ab <strong>KW {frei.woche}</strong> ({kurz(frei.von)}–{kurz(frei.bis)}) —
              dort sind noch {stunden(frei.frei)} frei.
            </>
          ) : (
            <>
              In den nächsten 16 Wochen ist keine Woche mit {stunden(gebraucht)} am Stück frei. Die
              ehrliche Antwort am Telefon ist dann kein Termin, sondern „im Moment nicht“.
            </>
          )}
        </p>
        <Rueckmeldung text={meldung} />
      </div>

      <h2>Die nächsten Wochen</h2>
      <div className="buero-liste">
        {wochen.map((w) => {
          const voll = w.stunden >= w.kapazitaet
          const knapp = w.kapazitaet > 0 && w.anteil >= 0.8
          return (
            /*
             * Rot heißt „über der Zeit" — die Woche ist überbucht. Bronze ab
             * vier Fünfteln: Da passt nichts Großes mehr hinein. Eine Woche
             * mit Luft bleibt farblos; grün auf jeder freien Woche hieße, die
             * Farbe zu verbrauchen, bevor sie etwas sagt.
             */
            <div
              key={w.schluessel}
              className={`buero-zeile ${balkenKlasse(voll ? 'warn' : knapp ? 'offen' : '')}`}
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">
                  KW {w.woche} · {kurz(w.von)}–{kurz(w.bis)}
                  {w.notiz ? ` · ${w.notiz}` : ''}
                </div>
                <div className="buero-zeile-neben">
                  {w.auftraege.length === 0
                    ? 'nichts zugesagt'
                    : w.auftraege
                        .map((a) => `${a.titel || a.nummer} (${stunden(a.stunden)})`)
                        .join(' · ')}
                </div>
                {/*
                  Der Balken sagt in einem Blick, was die Zahlen daneben
                  erklären. Überbucht läuft er über die Breite hinaus und wird
                  bei 100 % abgeschnitten — deshalb steht daneben, um wie viel:
                  Eine Woche mit fünf Stunden zu viel sah sonst genauso aus wie
                  eine, die punktgenau voll ist, und das ist der Unterschied
                  zwischen „geht gerade noch" und „da muss etwas weichen".
                */}
                <div
                  aria-hidden="true"
                  style={{
                    height: 6,
                    borderRadius: 9999,
                    background: 'var(--buero-linie)',
                    marginTop: '.5rem',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(w.anteil, 1) * 100}%`,
                      height: '100%',
                      background: voll
                        ? 'var(--buero-rot)'
                        : knapp
                          ? 'var(--buero-bronze)'
                          : 'var(--buero-tinte)',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                <span className="buero-betrag">{stunden(w.stunden)}</span>
                <label
                  className="buero-feld"
                  style={{ width: '7.5rem', margin: 0 }}
                  title="Verfügbare Stunden in dieser Woche. Leer = Voreinstellung, 0 = geht nichts."
                >
                  <span style={{ fontSize: '.7rem' }}>
                    verfügbar{w.eigeneKapazitaet ? '' : ' (Regel)'}
                  </span>
                  <input
                    inputMode="decimal"
                    defaultValue={w.eigeneKapazitaet ? w.kapazitaet : ''}
                    placeholder={String(wochenstunden)}
                    onBlur={(e) => void setzen(w.schluessel, e.target.value)}
                  />
                </label>
                <span className={`buero-marker ${voll ? 'warn' : knapp ? 'offen' : 'gut'}`}>
                  {/*
                    `frei` ist bei null gekappt — daran hängt die Suche nach
                    der ersten freien Woche, und eine negative freie Zeit wäre
                    dort Unsinn. Wie viel zu viel liegt, steht deshalb hier aus
                    den Stunden selbst.
                  */}
                  {w.kapazitaet === 0
                    ? 'keine Zeit'
                    : w.stunden > w.kapazitaet
                      ? `${stunden(Math.round((w.stunden - w.kapazitaet) * 10) / 10)} zu viel`
                      : voll
                        ? 'voll'
                        : `${stunden(w.frei)} frei`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {ohneSchaetzung.length > 0 && (
        <>
          <h2>Ohne geschätzte Zeit</h2>
          <p className="buero-unterzeile">
            Diese Aufträge zählen oben nicht mit — eine Woche kann damit leerer aussehen, als sie
            ist.
          </p>
          <div className="buero-liste">
            {ohneSchaetzung.map((a) => (
              // Ohne geschätzte Zeit fehlt der Auslastung oben eine Zahl —
              // die Woche sieht dadurch leerer aus, als sie ist.
              <Link key={a.id} href={`/office/auftraege/${a.id}`} className="buero-zeile ist-offen">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{a.title || a.jobNumber}</div>
                  <div className="buero-zeile-neben">
                    fertig bis {a.dueDate ? new Date(a.dueDate).toLocaleDateString('de-DE') : '—'}
                  </div>
                </div>
                <span className="buero-marker offen">Zeit eintragen</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  )
}
