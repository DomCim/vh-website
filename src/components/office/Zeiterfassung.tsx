'use client'

import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'

export type Zeitbuchung = { day?: string | null; minutes?: number | null; note?: string | null }

const stunden = (minuten: number) => {
  const h = Math.floor(minuten / 60)
  const m = minuten % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

const euro = (v: number) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v)

/**
 * Stoppuhr am Auftrag.
 *
 * Der Knopf ist absichtlich groß: Er wird mit Arbeitshandschuhen gedrückt,
 * im Stehen, an einem Telefon, das auf der Werkbank liegt. Die laufende Zeit
 * zählt sichtbar mit, damit niemand rätselt, ob die Uhr wirklich läuft.
 */
export function Zeiterfassung({
  auftragId,
  laeuftSeit,
  buchungen,
  stundensatz,
  auftragswert,
  materialkosten,
}: {
  auftragId: number | string
  laeuftSeit?: string | null
  buchungen: Zeitbuchung[]
  stundensatz: number
  auftragswert?: number | null
  materialkosten?: number
}) {
  const router = useRouter()
  const [laeuft, setLaeuft] = useState<string | null>(laeuftSeit ?? null)
  const [jetzt, setJetzt] = useState(() => Date.now())
  const [nachtrag, setNachtrag] = useState('')
  const [notiz, setNotiz] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!laeuft) return
    const takt = window.setInterval(() => setJetzt(Date.now()), 1000)
    return () => window.clearInterval(takt)
  }, [laeuft])

  const laufend = laeuft ? Math.max(0, Math.floor((jetzt - new Date(laeuft).getTime()) / 60000)) : 0
  const gebucht = buchungen.reduce((s, b) => s + (b.minutes ?? 0), 0)
  const gesamt = gebucht + laufend
  const lohnkosten = (gesamt / 60) * stundensatz
  const einsatz = lohnkosten + (materialkosten ?? 0)

  async function rufen(aktion: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await fetch('/api/office/zeit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: auftragId, aktion, notiz: notiz || undefined, ...extra }),
      })
      const j = await res.json()
      if (res.ok) {
        if (aktion === 'start') setLaeuft(j.laeuftSeit)
        if (aktion === 'stop') setLaeuft(null)
        setNotiz('')
        setNachtrag('')
        router.refresh()
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <h2 style={{ marginTop: '1.5rem' }}>Arbeitszeit</h2>

      <div className="buero-kacheln" style={{ marginBottom: '.8rem' }}>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Gebucht</div>
          <div className="buero-kachel-wert">{stunden(gesamt)}</div>
          <div className="buero-kachel-fuss">
            {laufend > 0 ? `davon ${stunden(laufend)} laufend` : `${buchungen.length} Buchungen`}
          </div>
        </div>
        <div className="buero-kachel">
          <div className="buero-kachel-titel">Lohnkosten</div>
          <div className="buero-kachel-wert">{euro(lohnkosten)}</div>
          <div className="buero-kachel-fuss">{euro(stundensatz)} je Stunde</div>
        </div>
        {typeof auftragswert === 'number' && auftragswert > 0 && (
          <div className="buero-kachel">
            <div className="buero-kachel-titel">Bleibt</div>
            <div className="buero-kachel-wert">{euro(auftragswert - einsatz)}</div>
            <div className="buero-kachel-fuss">
              {euro(auftragswert)} Auftragswert − {euro(einsatz)} Einsatz
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          type="button"
          className="buero-knopf"
          disabled={busy}
          onClick={() => rufen(laeuft ? 'stop' : 'start')}
          style={{ minWidth: 190, justifyContent: 'center', padding: '1rem 1.4rem' }}
        >
          {laeuft ? `Stoppen (${stunden(laufend)})` : 'Uhr starten'}
        </button>
        <input
          className="buero-feld"
          style={{ flex: '1 1 12rem', minWidth: 0 }}
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="Woran? (optional)"
        />
      </div>

      <div className="buero-reihe" style={{ marginTop: '.8rem' }}>
        <label className="buero-feld">
          <span>Zeit nachtragen (Minuten)</span>
          <input
            inputMode="numeric"
            value={nachtrag}
            onChange={(e) => setNachtrag(e.target.value)}
            placeholder="z.B. 90"
          />
        </label>
        <button
          type="button"
          className="buero-knopf schmal"
          disabled={busy || !nachtrag}
          onClick={() => rufen('nachtragen', { minuten: Number(nachtrag) })}
          style={{ alignSelf: 'end', marginBottom: '.3rem' }}
        >
          Eintragen
        </button>
      </div>

      {buchungen.length > 0 && (
        <div className="buero-liste" style={{ marginTop: '.8rem' }}>
          {buchungen.map((b, i) => (
            <div key={i} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{stunden(b.minutes ?? 0)}</div>
                <div className="buero-zeile-neben">
                  {b.day ? new Date(b.day).toLocaleDateString('de-DE') : ''}
                  {b.note ? ` · ${b.note}` : ''}
                </div>
              </div>
              <button
                type="button"
                className="buero-knopf schmal gefahr"
                disabled={busy}
                onClick={() => rufen('loeschen', { index: i })}
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
