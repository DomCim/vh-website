'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { auslastung, ersteFreieWoche, type AuslastungsAuftrag } from '../../../../lib/auslastung'
import { useBestand, useRahmen } from '../../../../lib/buero/bestand'

/**
 * Wie voll die nächsten Wochen sind.
 *
 * Die Frage, die diese Seite beantwortet, wird am Telefon gestellt: „Wann
 * könnten Sie das machen?" Bisher wurde sie aus dem Bauch beantwortet — der
 * Kalender zeigte zwar, was wann fällig ist, aber nicht, wie viele Stunden
 * dahinterstehen. Bei Einzelfertigung entscheidet genau das.
 *
 * Gerechnet wird aus dem Bestand im Gerät, die Kapazität kommt aus den
 * Einstellungen. Die Seite steht damit auch in der Werkstatt ohne Netz.
 */

const stunden = (n: number) => `${n.toLocaleString('de-DE', { maximumFractionDigits: 1 })} h`

const kurz = (d: Date) => d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })

export function AuslastungAnsicht() {
  const auftraege = useBestand<AuslastungsAuftrag>('auftraege')
  const { wochenstunden } = useRahmen()
  const [gebraucht, setGebraucht] = useState(20)

  const wochen = useMemo(
    () => auslastung(auftraege, { stundenProWoche: wochenstunden, wochen: 16 }),
    [auftraege, wochenstunden],
  )

  const frei = ersteFreieWoche(wochen, gebraucht)

  // Aufträge, die nichts beitragen, weil niemand ihre Zeit geschätzt hat.
  // Ohne diesen Hinweis sieht eine Woche leer aus, in der Arbeit liegt.
  const ohneSchaetzung = auftraege.filter(
    (a) =>
      (a.status === 'geplant' || a.status === 'inFertigung') && a.dueDate && !a.plannedMinutes,
  )

  return (
    <>
      <h1>Auslastung</h1>
      <p className="buero-unterzeile">
        Zugesagte Fertigungsstunden je Woche, gemessen an {stunden(wochenstunden)} Werkstattzeit.
        Zu ändern unter Website-Verwaltung → Einstellungen → Handarbeit &amp; Fertigung.
      </p>

      <div className="buero-karte">
        <label className="buero-feld">
          <span>Wie viele Stunden braucht das neue Stück?</span>
          <input
            type="number"
            min={1}
            step={1}
            value={gebraucht}
            onChange={(e) => setGebraucht(Number(e.target.value) || 0)}
          />
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
      </div>

      <h2>Die nächsten Wochen</h2>
      <div className="buero-liste">
        {wochen.map((w) => {
          const voll = w.anteil >= 1
          const knapp = w.anteil >= 0.8
          return (
            <div key={w.schluessel} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">
                  KW {w.woche} · {kurz(w.von)}–{kurz(w.bis)}
                </div>
                <div className="buero-zeile-neben">
                  {w.auftraege.length === 0
                    ? 'nichts zugesagt'
                    : w.auftraege
                        .map((a) => `${a.titel || a.nummer} (${stunden(a.stunden)})`)
                        .join(' · ')}
                </div>
                {/* Der Balken sagt in einem Blick, was die Zahlen daneben
                    erklären — überbucht läuft er über die Breite hinaus und
                    wird deshalb bei 100 % abgeschnitten und rot. */}
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
                <span className={`buero-marker ${voll ? 'warn' : knapp ? 'offen' : 'gut'}`}>
                  {voll ? 'voll' : `${stunden(w.frei)} frei`}
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
              <Link key={a.id} href={`/office/auftraege/${a.id}`} className="buero-zeile">
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
