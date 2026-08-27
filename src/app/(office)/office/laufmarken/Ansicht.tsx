'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import {
  type Arbeitsschritt,
  draussenUeberfaellig,
  naechsterSchritt,
  planStand,
} from '../../../../lib/arbeitsplan'
import { useBestand } from '../../../../lib/buero/bestand'
import { absenden } from '../../../../lib/buero/warteschlange'
import { datum } from '../../../../lib/format'
import { Rueckmeldung } from '../../../../components/office/Rueckmeldung'

/**
 * Die Tafel — alle Laufmarken, und wo ihre Teile gerade sind.
 *
 * Das ist der Überblick, für den es die Marken gibt: Welche Marke hängt an
 * welchem Auftrag, wie weit ist er, und was ist außer Haus — beim wem, seit
 * wann, und wann wird es zurückerwartet. Überfälliges steht rot, denn genau
 * dafür wurden die Vorlauftage erfunden: Die Uhr läuft auch, wenn die
 * Werkstatt nichts tut.
 */

type Marke = {
  id: number | string
  code?: string | null
  auftrag?: unknown
  gekoppeltAm?: string | null
  notiz?: string | null
}

type Auftrag = {
  id: number | string
  jobNumber?: string | null
  title?: string | null
  status?: string | null
  arbeitsplan?: Arbeitsschritt[] | null
}

type Partner = { id: number | string; name?: string | null }

const kennung = (wert: unknown): string =>
  typeof wert === 'object' && wert
    ? String((wert as { id?: number }).id ?? '')
    : wert == null
      ? ''
      : String(wert)

/** Wann das Teil zurückerwartet wird — raus plus zugesagte Vorlauftage. */
function erwartetAm(schritt: Arbeitsschritt): string | null {
  if (!schritt.rausAm) return null
  const tage = Number(schritt.vorlaufTage) || 0
  if (tage <= 0) return null
  const d = new Date(schritt.rausAm)
  d.setDate(d.getDate() + tage)
  return d.toISOString()
}

export function LaufmarkenAnsicht() {
  const marken = useBestand<Marke>('laufmarken')
  const auftraege = useBestand<Auftrag>('auftraege')
  const partner = useBestand<Partner>('partner')

  const [anzahl, setAnzahl] = useState(20)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const sortiert = useMemo(
    () => [...marken].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '', 'de')),
    [marken],
  )

  const betriebsname = (wert: unknown) =>
    partner.find((p) => String(p.id) === kennung(wert))?.name ?? 'Dienstleister'

  async function anlegen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/laufmarken',
        bereich: 'laufmarken',
        koerper: { aktion: 'anlegen', anzahl },
      })
      setMeldung(sofort ? 'Angelegt.' : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <>
      <h1>Laufmarken</h1>
      <p className="buero-unterzeile">
        Jede Marke ist ein QR-Code an der Tafel. Gekoppelt an einen Auftrag wandert sie mit dem
        Teil — und hier steht, wo alles gerade ist.
      </p>
      <Rueckmeldung text={meldung} />

      <div className="buero-reihe" style={{ alignItems: 'end', marginBottom: '1rem' }}>
        <label className="buero-feld" style={{ maxWidth: '8rem' }}>
          <span>Anzahl</span>
          <input
            inputMode="numeric"
            value={anzahl}
            onChange={(e) =>
              setAnzahl(Math.min(50, Math.max(1, Number(e.target.value.replace(/[^\d]/g, '')) || 1)))
            }
          />
        </label>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', paddingBottom: '.2rem' }}>
          <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void anlegen()}>
            Marken anlegen
          </button>
          {marken.length > 0 && (
            <a
              className="buero-knopf leise"
              href="/api/office/laufmarken/blatt"
              target="_blank"
              rel="noreferrer"
            >
              Druckblatt (PDF)
            </a>
          )}
        </div>
      </div>

      {sortiert.length === 0 ? (
        <div className="buero-leer">
          Noch keine Marken. Oben anlegen, Blatt drucken, ausschneiden — fertig ist die Tafel.
        </div>
      ) : (
        <div className="buero-liste">
          {sortiert.map((m) => {
            const auftrag = m.auftrag
              ? auftraege.find((a) => String(a.id) === kennung(m.auftrag))
              : null
            const plan = auftrag?.arbeitsplan ?? []
            const stand = planStand(plan)
            const jetzt = naechsterSchritt(plan)
            const draussen =
              jetzt?.schritt.art === 'fremd' && jetzt.schritt.rausAm && !jetzt.schritt.zurueckAm
                ? jetzt.schritt
                : null
            const ueberfaellig = draussen ? draussenUeberfaellig(draussen) : false
            const erwartet = draussen ? erwartetAm(draussen) : null

            return (
              <Link
                key={m.id}
                href={`/office/marke/${encodeURIComponent(m.code ?? '')}`}
                className="buero-zeile"
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">
                    {m.code}
                    {auftrag
                      ? ` · ${auftrag.jobNumber ?? ''} ${auftrag.title ?? ''}`.trimEnd()
                      : ''}
                  </div>
                  <div className="buero-zeile-neben">
                    {!m.auftrag
                      ? m.notiz || 'frei — hängt an der Tafel'
                      : !auftrag
                        ? 'Auftrag wird geholt …'
                        : [
                            stand.gesamt > 0 ? `${stand.erledigt} von ${stand.gesamt}` : null,
                            draussen
                              ? `beim ${betriebsname(draussen.dienstleister)} seit ${datum(draussen.rausAm)}` +
                                (erwartet ? `, erwartet ${datum(erwartet)}` : '')
                              : jetzt
                                ? `jetzt dran: ${jetzt.schritt.was}`
                                : stand.fertig
                                  ? 'alle Schritte erledigt'
                                  : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                  </div>
                </div>
                <span className={`buero-marker${ueberfaellig ? ' warn' : ''}`}>
                  {ueberfaellig ? 'überfällig' : m.auftrag ? 'unterwegs' : 'frei'}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
