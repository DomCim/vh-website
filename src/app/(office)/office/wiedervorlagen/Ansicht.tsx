'use client'

import Link from 'next/link'
import React, { useMemo, useState } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { absenden } from '../../../../lib/buero/warteschlange'
import { datum } from '../../../../lib/format'
import { WischZeile } from '../../../../components/office/WischZeile'
import { Rueckmeldung } from '../../../../components/office/Rueckmeldung'

/**
 * Alle Wiedervorlagen an einem Ort.
 *
 * Am Vorgang steht, was zu diesem Vorgang gehört; hier steht alles zusammen —
 * das ist der Blick, mit dem man morgens anfängt. Sortiert nach Datum, das
 * Fällige zuerst, und der Rest nach unten.
 */

type Wiedervorlage = {
  id: number | string
  title?: string | null
  dueDate?: string | null
  done?: boolean | null
  note?: string | null
  contact?: unknown
  job?: unknown
}

type Partner = { id: number | string; name?: string | null }
type Auftrag = { id: number | string; jobNumber?: string | null; title?: string | null }

const kennung = (wert: unknown): string =>
  typeof wert === 'object' && wert
    ? String((wert as { id?: number }).id ?? '')
    : wert == null
      ? ''
      : String(wert)

const heute = () => new Date().toISOString().slice(0, 10)

/** In einer Woche — der übliche Abstand fürs Nachfassen von Hand. */
function inEinerWoche(): string {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 10)
}

export function WiedervorlagenAnsicht() {
  const alle = useBestand<Wiedervorlage>('wiedervorlagen')
  const partner = useBestand<Partner>('partner')
  const auftraege = useBestand<Auftrag>('auftraege')

  const [titel, setTitel] = useState('')
  const [wann, setWann] = useState(inEinerWoche)
  const [zeigeErledigte, setZeigeErledigte] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  const sortiert = useMemo(
    () => [...alle].sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
    [alle],
  )
  const offen = sortiert.filter((w) => !w.done)
  const erledigt = sortiert.filter((w) => w.done).reverse()

  const stichtag = heute()
  const faellig = offen.filter((w) => (w.dueDate ?? '').slice(0, 10) <= stichtag)
  const spaeter = offen.filter((w) => (w.dueDate ?? '').slice(0, 10) > stichtag)

  const bezugText = (w: Wiedervorlage): { text: string; href: string } | null => {
    const auftragId = kennung(w.job)
    if (auftragId) {
      const a = auftraege.find((x) => String(x.id) === auftragId)
      return { text: a?.title || a?.jobNumber || 'Auftrag', href: `/office/auftraege/${auftragId}` }
    }
    const partnerId = kennung(w.contact)
    if (partnerId) {
      const p = partner.find((x) => String(x.id) === partnerId)
      return { text: p?.name || 'Geschäftspartner', href: `/office/partner/${partnerId}` }
    }
    return null
  }

  async function schicken(koerper: Record<string, unknown>, vorschau?: Record<string, unknown>) {
    setLaeuft(true)
    try {
      const { sofort } = await absenden({
        pfad: '/api/office/wiedervorlage',
        bereich: 'wiedervorlagen',
        koerper,
        vorschau,
      })
      if (!sofort) setMeldung('Gemerkt — geht raus, sobald wieder Netz da ist.')
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  async function anlegen() {
    if (!titel.trim()) {
      setMeldung('Ohne Text gibt es nichts zu erinnern.')
      return
    }
    setMeldung(null)
    await schicken(
      { title: titel.trim(), dueDate: wann },
      { title: titel.trim(), dueDate: wann, done: false },
    )
    setTitel('')
    setWann(inEinerWoche())
  }

  const zeile = (w: Wiedervorlage, erledigen: boolean) => {
    const bezug = bezugText(w)
    return (
      // Wischen wie im Postfach: links löschen, rechts abhaken bzw. öffnen
      <WischZeile
        key={w.id}
        nachLinks={{
          text: 'Löschen',
          art: 'rot',
          tun: () => void schicken({ aktion: 'loeschen', id: w.id }),
        }}
        nachRechts={{
          text: erledigen ? 'Erledigt' : 'Wieder offen',
          art: 'bronze',
          tun: () =>
            void schicken(
              { aktion: erledigen ? 'erledigt' : 'offen', id: w.id },
              { done: erledigen },
            ),
        }}
      >
      {/*
        * Der Statusbalken links sagt, was drängt (siehe office.css,
        * „Der Statusbalken links"): rot heißt über der Zeit, bronze heißt
        * wartet, grün heißt erledigt. Hier ist „über der Zeit" die
        * Wiedervorlage, deren Tag erreicht oder vorbei ist — dieselbe
        * Grenze, nach der die Liste ohnehin in „fällig" und „später" teilt.
        */}
      <div
        className={`buero-zeile ${
          w.done ? 'ist-gut' : (w.dueDate ?? '').slice(0, 10) <= heute() ? 'ist-warn' : 'ist-offen'
        }`}
      >
        <div className="buero-zeile-haupt">
          <div className="buero-zeile-titel">{w.title}</div>
          <div className="buero-zeile-neben">
            {datum(w.dueDate)}
            {bezug ? ' · ' : ''}
            {bezug && (
              <Link href={bezug.href} style={{ textDecoration: 'underline' }}>
                {bezug.text}
              </Link>
            )}
            {w.note ? ` · ${w.note}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
          <button
            type="button"
            className="buero-knopf leise schmal"
            disabled={laeuft}
            onClick={() =>
              void schicken(
                { aktion: erledigen ? 'erledigt' : 'offen', id: w.id },
                { done: erledigen },
              )
            }
          >
            {erledigen ? 'erledigt' : 'wieder offen'}
          </button>
        </div>
      </div>
      </WischZeile>
    )
  }

  return (
    <>
      <h1>Wiedervorlagen</h1>
      <p className="buero-unterzeile">
        Was man sich selbst vorlegt. Am fälligen Tag meldet sich das Büro aufs Handy.
      </p>

      <div className="buero-karte">
        <div className="buero-reihe">
          <label className="buero-feld">
            <span>Woran erinnern?</span>
            <input
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
              placeholder="z.B. Herrn Müller wegen zweitem Kübel anrufen"
            />
          </label>
          <label className="buero-feld">
            <span>Wann</span>
            <input type="date" value={wann} onChange={(e) => setWann(e.target.value)} />
          </label>
        </div>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={anlegen}>
          Merken
        </button>
        <Rueckmeldung text={meldung} />
      </div>

      <h2>Fällig ({faellig.length})</h2>
      <div className="buero-liste">
        {faellig.length === 0 ? (
          <div className="buero-leer">Nichts liegt an.</div>
        ) : (
          faellig.map((w) => zeile(w, true))
        )}
      </div>

      {spaeter.length > 0 && (
        <>
          <h2>Später</h2>
          <div className="buero-liste">{spaeter.map((w) => zeile(w, true))}</div>
        </>
      )}

      {erledigt.length > 0 && (
        <>
          <h2>
            Erledigt ({erledigt.length}){' '}
            <button
              type="button"
              className="buero-knopf leise schmal"
              onClick={() => setZeigeErledigte((v) => !v)}
            >
              {zeigeErledigte ? 'ausblenden' : 'anzeigen'}
            </button>
          </h2>
          {zeigeErledigte && (
            <div className="buero-liste">{erledigt.slice(0, 50).map((w) => zeile(w, false))}</div>
          )}
        </>
      )}
    </>
  )
}
