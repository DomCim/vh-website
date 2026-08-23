'use client'

import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'

import { datum, euro } from '../../../../lib/format'
import { Rueckmeldung } from '../../../../components/office/Rueckmeldung'

/**
 * Zahlungseingänge — der tägliche Blick ins Banking, hier erledigt.
 *
 * Der Ablauf ist bewusst kurz gehalten: Datei aus dem Onlinebanking wählen,
 * einlesen, und dann steht je Zahlung ein Vorschlag da. Ein Klick hakt die
 * Rechnung ab; alles Weitere hängt daran und passiert von selbst.
 *
 * Diese Seite rechnet nicht aus dem Bestand im Gerät, sondern fragt den
 * Server. Das ist die Ausnahme im Büro und hat einen Grund: Die Zuordnung
 * entscheidet über Geld, und sie soll überall dieselbe sein — auch dann, wenn
 * im Gerät noch der Stand von gestern liegt. Ohne Netz gibt es hier deshalb
 * nichts zu tun, und die Seite sagt das auch.
 */

type Vorschlag = {
  rechnung: number | string
  nummer: string
  sicherheit: 'sicher' | 'wahrscheinlich' | 'moeglich'
  grund: string
}

type Bewegung = {
  id: number | string
  tag: string
  betrag: number
  gegenpartei: string
  zweck: string
  vorschlag: Vorschlag | null
}

type Rechnung = {
  id: number | string
  invoiceNumber?: string | null
  customerName?: string | null
  total?: number | null
}

const MARKER: Record<Vorschlag['sicherheit'], { text: string; klasse: string }> = {
  sicher: { text: 'passt', klasse: 'gut' },
  wahrscheinlich: { text: 'wahrscheinlich', klasse: 'offen' },
  moeglich: { text: 'prüfen', klasse: 'warn' },
}

export function ZahlungenAnsicht() {
  const [bewegungen, setBewegungen] = useState<Bewegung[]>([])
  const [rechnungen, setRechnungen] = useState<Rechnung[]>([])
  const [laedt, setLaedt] = useState(true)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  const [offen, setOffen] = useState<number | string | null>(null)

  const holen = useCallback(async () => {
    setLaedt(true)
    try {
      const res = await fetch('/api/office/kontoauszug')
      if (!res.ok) throw new Error()
      const daten = await res.json()
      setBewegungen(daten.bewegungen ?? [])
      setRechnungen(daten.offeneRechnungen ?? [])
      setFehler(null)
    } catch {
      setFehler('Die Zahlungen ließen sich nicht holen — dafür braucht es Netz.')
    } finally {
      setLaedt(false)
    }
  }, [])

  useEffect(() => {
    void holen()
  }, [holen])

  async function einlesen(datei: File) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const formular = new FormData()
      formular.append('datei', datei)
      const res = await fetch('/api/office/kontoauszug', { method: 'POST', body: formular })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(
          daten.error === 'nichts-gefunden'
            ? 'In der Datei stand keine einzige Buchung. Passt das Format? CSV aus dem Onlinebanking oder CAMT.053 als XML.'
            : 'Die Datei ließ sich nicht lesen.',
        )
        return
      }
      setMeldung(
        `${daten.gelesen} Buchungen gelesen · ${daten.neu} neu${
          daten.bekannt ? ` · ${daten.bekannt} kannte das Büro schon` : ''
        }.`,
      )
      await holen()
    } catch {
      setMeldung('Das Einlesen hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  async function handeln(id: number | string, aktion: 'zuordnen' | 'beiseite', rechnung?: number | string) {
    setLaeuft(true)
    try {
      const res = await fetch('/api/office/kontoauszug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion, id, rechnung }),
      })
      if (!res.ok) throw new Error()
      setBewegungen((v) => v.filter((b) => b.id !== id))
      setOffen(null)
    } catch {
      setMeldung('Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  const eingaenge = bewegungen.filter((b) => b.betrag > 0)
  const abbuchungen = bewegungen.filter((b) => b.betrag <= 0)

  return (
    <>
      <h1>Zahlungseingänge</h1>
      <p className="buero-unterzeile">
        Kontoauszug einlesen, Zahlung anhaken — die Rechnung steht danach auf „bezahlt“, und was
        daran hängt, läuft von selbst weiter.
      </p>

      <div className="buero-karte">
        <label className="buero-feld">
          <span>Kontoauszug aus dem Onlinebanking</span>
          <input
            type="file"
            accept=".csv,.txt,.xml,text/csv,text/plain,application/xml,text/xml"
            disabled={laeuft}
            onChange={(e) => {
              const d = e.target.files?.[0]
              if (d) void einlesen(d)
              e.target.value = ''
            }}
          />
          <span style={{ marginTop: '.4rem' }}>
            CSV („Umsätze exportieren“) oder CAMT.053 als XML. Dieselbe Datei zweimal einzulesen
            schadet nichts — bekannte Buchungen werden übersprungen.
          </span>
        </label>
        <Rueckmeldung text={meldung} />
      </div>

      {fehler && <p className="buero-hinweis warn">{fehler}</p>}

      <h2>Eingänge ({eingaenge.length})</h2>
      <div className="buero-liste">
        {laedt ? (
          <div className="buero-leer">wird geholt …</div>
        ) : eingaenge.length === 0 ? (
          <div className="buero-leer">Nichts offen — alles zugeordnet.</div>
        ) : (
          eingaenge.map((b) => {
            const marker = b.vorschlag ? MARKER[b.vorschlag.sicherheit] : null
            return (
              <div key={b.id} className="buero-karte" style={{ marginBottom: '.6rem' }}>
                <div className="buero-zeile" style={{ padding: 0 }}>
                  <div className="buero-zeile-haupt">
                    <div className="buero-zeile-titel">
                      {b.gegenpartei || 'ohne Absender'} · {euro(b.betrag)}
                    </div>
                    <div className="buero-zeile-neben">
                      {datum(b.tag)}
                      {b.zweck ? ` · ${b.zweck}` : ''}
                    </div>
                  </div>
                  {marker && <span className={`buero-marker ${marker.klasse}`}>{marker.text}</span>}
                </div>

                {b.vorschlag ? (
                  <>
                    <p className="buero-unterzeile" style={{ marginTop: '.6rem' }}>
                      Vorschlag: <strong>{b.vorschlag.nummer}</strong> — {b.vorschlag.grund}
                    </p>
                    <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="buero-knopf leise schmal"
                        disabled={laeuft}
                        onClick={() => void handeln(b.id, 'zuordnen', b.vorschlag!.rechnung)}
                      >
                        {b.vorschlag.nummer} als bezahlt buchen
                      </button>
                      <button
                        type="button"
                        className="buero-knopf leise schmal"
                        onClick={() => setOffen(offen === b.id ? null : b.id)}
                      >
                        andere Rechnung
                      </button>
                      <button
                        type="button"
                        className="buero-knopf leise schmal"
                        disabled={laeuft}
                        onClick={() => void handeln(b.id, 'beiseite')}
                      >
                        beiseitelegen
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="buero-unterzeile" style={{ marginTop: '.6rem' }}>
                      Keine passende Rechnung gefunden.
                    </p>
                    <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="buero-knopf leise schmal"
                        onClick={() => setOffen(offen === b.id ? null : b.id)}
                      >
                        Rechnung auswählen
                      </button>
                      <button
                        type="button"
                        className="buero-knopf leise schmal"
                        disabled={laeuft}
                        onClick={() => void handeln(b.id, 'beiseite')}
                      >
                        beiseitelegen
                      </button>
                    </div>
                  </>
                )}

                {offen === b.id && (
                  <label className="buero-feld" style={{ marginTop: '.8rem' }}>
                    <span>Welche Rechnung ist damit bezahlt?</span>
                    <select
                      defaultValue=""
                      disabled={laeuft}
                      onChange={(e) => {
                        if (e.target.value) void handeln(b.id, 'zuordnen', e.target.value)
                      }}
                    >
                      <option value="">— auswählen —</option>
                      {rechnungen.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.invoiceNumber} · {r.customerName ?? 'ohne Kunde'} ·{' '}
                          {euro(r.total ?? 0)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )
          })
        )}
      </div>

      {abbuchungen.length > 0 && (
        <>
          <h2>Abbuchungen ({abbuchungen.length})</h2>
          <p className="buero-unterzeile">
            Gehören zu den Belegen, nicht zu den Rechnungen — hier stehen sie nur, damit der Auszug
            vollständig ist.
          </p>
          <div className="buero-liste">
            {abbuchungen.map((b) => (
              <div key={b.id} className="buero-zeile">
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{b.gegenpartei || 'ohne Empfänger'}</div>
                  <div className="buero-zeile-neben">
                    {datum(b.tag)}
                    {b.zweck ? ` · ${b.zweck}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                  <span className="buero-betrag">{euro(b.betrag)}</span>
                  <button
                    type="button"
                    className="buero-knopf leise schmal"
                    disabled={laeuft}
                    onClick={() => void handeln(b.id, 'beiseite')}
                  >
                    erledigt
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="buero-unterzeile" style={{ marginTop: '1.5rem' }}>
        <Link href="/office/rechnungen" style={{ textDecoration: 'underline' }}>
          Zu den Rechnungen
        </Link>
      </p>
    </>
  )
}
