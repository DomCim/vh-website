'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { type Arbeitsschritt, naechsterSchritt } from '../../../../../lib/arbeitsplan'
import { useAbgleich, useBestand } from '../../../../../lib/buero/bestand'
import { absenden } from '../../../../../lib/buero/warteschlange'
import { datum } from '../../../../../lib/format'
import { Ablauf } from '../../../../../components/office/Ablauf'
import { Rueckmeldung } from '../../../../../components/office/Rueckmeldung'

/**
 * Eine Marke, gescannt vom Büro — die Seite mit den großen Knöpfen.
 *
 * Kein Automatismus: Der Scan **zeigt** nur; jede Buchung ist ein Tipp auf
 * einen Knopf. Ein versehentlicher Scan im Vorbeigehen ändert damit nichts —
 * anders als ein Scan, der von selbst weiterschaltet, und den ein
 * Doppel-Scan verstellt hätte.
 *
 * Die Knöpfe senden über die Warteschlange: In der Werkstatt ist das Netz
 * nicht verlässlich, und „Teil ist raus" soll auch dann gebucht sein, wenn
 * es erst später den Server erreicht.
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
  dueDate?: string | null
  arbeitsplan?: Arbeitsschritt[] | null
}

type Partner = { id: number | string; name?: string | null }

const kennung = (wert: unknown): string =>
  typeof wert === 'object' && wert
    ? String((wert as { id?: number }).id ?? '')
    : wert == null
      ? ''
      : String(wert)

export function MarkeAnsicht() {
  const { code } = useParams<{ code: string }>()
  const marken = useBestand<Marke>('laufmarken')
  const auftraege = useBestand<Auftrag>('auftraege')
  const partner = useBestand<Partner>('partner')
  const { bereit } = useAbgleich()

  const marke = marken.find((m) => m.code === code)
  const auftrag = marke?.auftrag
    ? auftraege.find((a) => String(a.id) === kennung(marke.auftrag))
    : null

  const [wahl, setWahl] = useState<number | ''>('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  // Zum Koppeln stehen die Aufträge bereit, die noch durch die Werkstatt gehen
  const koppelbar = useMemo(
    () =>
      [...auftraege]
        .filter((a) => a.status === 'geplant' || a.status === 'inFertigung')
        .sort((a, b) => (b.jobNumber ?? '').localeCompare(a.jobNumber ?? '', 'de')),
    [auftraege],
  )

  const plan = auftrag?.arbeitsplan ?? []
  const jetzt = naechsterSchritt(plan)
  const fremdDran = jetzt?.schritt.art === 'fremd' ? jetzt : null
  const betriebsname = fremdDran
    ? (partner.find((p) => String(p.id) === kennung(fremdDran.schritt.dienstleister))?.name ??
      'Dienstleister')
    : null

  async function senden(
    pfad: string,
    bereich: 'laufmarken' | 'auftraege',
    koerper: Record<string, unknown>,
    text: string,
  ) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const { sofort } = await absenden({ pfad, bereich, koerper })
      setMeldung(sofort ? text : 'Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!marke) {
    return (
      <>
        <h1>Laufmarke {code}</h1>
        <div className="buero-leer">
          {bereit ? 'Diese Marke gibt es nicht (mehr).' : 'wird geholt …'}
        </div>
      </>
    )
  }

  return (
    <>
      <h1>Laufmarke {marke.code}</h1>
      <p className="buero-unterzeile">
        {auftrag ? (
          <>
            hängt an{' '}
            <Link href={`/office/auftraege/${auftrag.id}`} style={{ textDecoration: 'underline' }}>
              {auftrag.jobNumber} · {auftrag.title}
            </Link>
            {marke.gekoppeltAm ? ` · seit ${datum(marke.gekoppeltAm)}` : ''}
            {auftrag.dueDate ? ` · Termin ${datum(auftrag.dueDate)}` : ''}
          </>
        ) : marke.auftrag ? (
          'Auftrag wird geholt …'
        ) : (
          marke.notiz || 'frei — hängt an der Tafel'
        )}
      </p>
      <Rueckmeldung text={meldung} />

      {!marke.auftrag ? (
        <div className="buero-karte">
          <h2 style={{ marginTop: 0 }}>An einen Auftrag heften</h2>
          <div className="buero-reihe" style={{ alignItems: 'end' }}>
            <label className="buero-feld" style={{ gridColumn: 'span 2' }}>
              <span>Auftrag</span>
              <select value={wahl} onChange={(e) => setWahl(Number(e.target.value) || '')}>
                <option value="">— wählen —</option>
                {koppelbar.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.jobNumber} · {a.title}
                  </option>
                ))}
              </select>
            </label>
            <div style={{ paddingBottom: '.2rem' }}>
              <button
                type="button"
                className="buero-knopf"
                disabled={laeuft || !wahl}
                onClick={() =>
                  void senden(
                    '/api/office/laufmarken',
                    'laufmarken',
                    { aktion: 'koppeln', code: marke.code, auftragId: wahl },
                    'Gekoppelt.',
                  )
                }
              >
                Koppeln
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/*
            * Die großen Knöpfe — für den Griff im Vorbeigehen, mit dem Teil
            * unterm Arm. Sichtbar ist immer nur der eine, der gerade dran ist.
            */}
          {fremdDran && !fremdDran.schritt.rausAm && (
            <button
              type="button"
              className="buero-knopf"
              style={{ padding: '1rem 1.4rem', fontSize: '1.05rem', marginBottom: '.8rem' }}
              disabled={laeuft || !auftrag}
              onClick={() =>
                void senden(
                  '/api/office/auftrag',
                  'auftraege',
                  { aktion: 'schrittRaus', id: auftrag!.id, schritt: fremdDran.index },
                  'Gebucht — Teil ist raus.',
                )
              }
            >
              Teil ist raus zum {betriebsname} ({fremdDran.schritt.was})
            </button>
          )}
          {fremdDran && fremdDran.schritt.rausAm && !fremdDran.schritt.zurueckAm && (
            <button
              type="button"
              className="buero-knopf"
              style={{ padding: '1rem 1.4rem', fontSize: '1.05rem', marginBottom: '.8rem' }}
              disabled={laeuft || !auftrag}
              onClick={() =>
                void senden(
                  '/api/office/auftrag',
                  'auftraege',
                  { aktion: 'schrittZurueck', id: auftrag!.id, schritt: fremdDran.index },
                  'Gebucht — Teil ist zurück.',
                )
              }
            >
              Teil ist zurück vom {betriebsname}
            </button>
          )}
          {fremdDran?.schritt.fertigGemeldetAm && !fremdDran.schritt.zurueckAm && (
            <p className="buero-unterzeile">
              {betriebsname} hat am {datum(fremdDran.schritt.fertigGemeldetAm)} fertig gemeldet.
            </p>
          )}

          <h2>Ablauf</h2>
          <Ablauf plan={plan} />

          <div style={{ marginTop: '1.2rem' }}>
            <button
              type="button"
              className="buero-knopf leise"
              disabled={laeuft}
              onClick={() =>
                void senden(
                  '/api/office/laufmarken',
                  'laufmarken',
                  { aktion: 'entkoppeln', code: marke.code },
                  'Entkoppelt — die Marke ist wieder frei.',
                )
              }
            >
              Marke entkoppeln
            </button>
          </div>
        </>
      )}
    </>
  )
}
