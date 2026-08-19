'use client'

import React, { useCallback, useEffect, useState } from 'react'

type Fach = { id: string; label: string; address: string }
type Ordner = { pfad: string; name: string; ungelesen: number; art: string }
type Kopfzeile = {
  uid: number
  betreff: string
  von: string
  vonAdresse: string
  an: string
  datum: string | null
  gelesen: boolean
  markiert: boolean
  anhaenge: boolean
}
type Nachricht = Kopfzeile & {
  text: string
  html: string | null
  messageId?: string
  antwortAn?: string
  dateien: { name: string; groesse: number; typ: string }[]
}

type Entwurf = { an: string; betreff: string; text: string; antwortAufMessageId?: string }

const zeit = (v: string | null) => {
  if (!v) return ''
  const d = new Date(v)
  const heute = new Date()
  const gleicherTag = d.toDateString() === heute.toDateString()
  return gleicherTag
    ? d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

const groesse = (b: number) =>
  b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

/**
 * Postfach im Büro.
 *
 * Bewusst zwei Ansichten statt drei Spalten: Liste oder Nachricht. Am Handy
 * ist das die einzige Aufteilung, die ohne Zoomen benutzbar bleibt, und am
 * Rechner stört sie nicht.
 *
 * Fremdes HTML wird in einem abgeschotteten Rahmen angezeigt — ohne Skripte
 * und ohne Zugriff auf die Seite. Eine Mail darf nicht mehr dürfen als
 * hübsch aussehen.
 */
export function Postfach({ vorgabe }: { vorgabe?: Entwurf | null }) {
  const [faecher, setFaecher] = useState<Fach[]>([])
  const [fach, setFach] = useState<string | null>(null)
  const [ordner, setOrdner] = useState('INBOX')
  const [ordnerAlle, setOrdnerAlle] = useState<Ordner[]>([])
  const [liste, setListe] = useState<Kopfzeile[]>([])
  const [offen, setOffen] = useState<Nachricht | null>(null)
  const [entwurf, setEntwurf] = useState<Entwurf | null>(vorgabe ?? null)
  const [laeuft, setLaeuft] = useState(true)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [nichtEingerichtet, setNichtEingerichtet] = useState(false)

  const laden = useCallback(
    async (fachId?: string | null, ordnerPfad?: string) => {
      setLaeuft(true)
      setMeldung(null)
      try {
        const p = new URLSearchParams()
        if (fachId) p.set('fach', fachId)
        if (ordnerPfad) p.set('ordner', ordnerPfad)
        const res = await fetch(`/api/office/post?${p}`, { credentials: 'include' })
        const j = await res.json()
        if (!res.ok) {
          setMeldung(
            j?.error === 'postfach-nicht-erreichbar'
              ? 'Das Postfach ist gerade nicht erreichbar. Zugangsdaten prüfen?'
              : 'Das hat nicht geklappt.',
          )
          return
        }
        if (j.fehlt === 'kein-postfach') {
          setNichtEingerichtet(true)
          return
        }
        setNichtEingerichtet(false)
        setFaecher(j.faecher ?? [])
        setFach(j.fach)
        setListe(j.nachrichten ?? [])
        if (j.ordnerListe) setOrdnerAlle(j.ordnerListe)
        if (j.ordner) setOrdner(j.ordner)
      } catch {
        setMeldung('Verbindung fehlgeschlagen.')
      } finally {
        setLaeuft(false)
      }
    },
    [],
  )

  useEffect(() => {
    void laden()
  }, [laden])

  async function oeffnen(uid: number) {
    setLaeuft(true)
    try {
      const p = new URLSearchParams({ uid: String(uid), ordner })
      if (fach) p.set('fach', fach)
      const res = await fetch(`/api/office/post?${p}`, { credentials: 'include' })
      const j = await res.json()
      if (!res.ok) {
        setMeldung('Die Nachricht ließ sich nicht öffnen.')
        return
      }
      setOffen(j.nachricht)
      setListe((v) => v.map((n) => (n.uid === uid ? { ...n, gelesen: true } : n)))
    } finally {
      setLaeuft(false)
    }
  }

  async function aktion(uid: number, was: string) {
    const res = await fetch('/api/office/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ aktion: was, uid, ordner, fach }),
    })
    if (!res.ok) {
      setMeldung('Das hat nicht geklappt.')
      return
    }
    if (was === 'loeschen') {
      setListe((v) => v.filter((n) => n.uid !== uid))
      setOffen(null)
    } else if (was === 'ungelesen') {
      setListe((v) => v.map((n) => (n.uid === uid ? { ...n, gelesen: false } : n)))
      setOffen(null)
    } else if (was === 'markiert' || was === 'unmarkiert') {
      setListe((v) =>
        v.map((n) => (n.uid === uid ? { ...n, markiert: was === 'markiert' } : n)),
      )
    }
  }

  async function senden() {
    if (!entwurf?.an.trim()) {
      setMeldung('Eine Empfängeradresse wird gebraucht.')
      return
    }
    setLaeuft(true)
    try {
      const res = await fetch('/api/office/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'senden', fach, ...entwurf }),
      })
      if (!res.ok) {
        setMeldung('Die Mail ging nicht raus.')
        return
      }
      setEntwurf(null)
      setMeldung('Gesendet.')
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  function antworten(n: Nachricht) {
    const zitat = n.text
      .split('\n')
      .slice(0, 40)
      .map((z) => `> ${z}`)
      .join('\n')
    setEntwurf({
      an: n.antwortAn || n.vonAdresse,
      betreff: n.betreff.startsWith('Re:') ? n.betreff : `Re: ${n.betreff}`,
      text: `\n\n---\nAm ${zeit(n.datum)} schrieb ${n.von}:\n${zitat}`,
      antwortAufMessageId: n.messageId,
    })
    setOffen(null)
  }

  if (nichtEingerichtet) {
    return (
      <div className="buero-karte">
        <p>
          Es ist noch kein Postfach eingerichtet. In der Website-Verwaltung unter{' '}
          <strong>Verwaltung → Integrationen → Postfächer</strong> Server, Benutzername und Passwort
          eintragen — danach steht der Posteingang hier.
        </p>
      </div>
    )
  }

  // ── Schreiben ─────────────────────────────────────────────────────────────
  if (entwurf) {
    return (
      <div className="buero-karte">
        {meldung && <p className="buero-hinweis">{meldung}</p>}
        <label className="buero-feld">
          <span>An</span>
          <input
            value={entwurf.an}
            onChange={(e) => setEntwurf({ ...entwurf, an: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Betreff</span>
          <input
            value={entwurf.betreff}
            onChange={(e) => setEntwurf({ ...entwurf, betreff: e.target.value })}
          />
        </label>
        <label className="buero-feld">
          <span>Nachricht</span>
          <textarea
            rows={14}
            value={entwurf.text}
            onChange={(e) => setEntwurf({ ...entwurf, text: e.target.value })}
          />
        </label>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          <button type="button" className="buero-knopf" disabled={laeuft} onClick={() => void senden()}>
            Senden
          </button>
          <button type="button" className="buero-knopf stumm" onClick={() => setEntwurf(null)}>
            Verwerfen
          </button>
          {faecher.length > 1 && (
            <select
              className="buero-fach-wahl"
              value={fach ?? ''}
              onChange={(e) => setFach(e.target.value)}
            >
              {faecher.map((f) => (
                <option key={f.id} value={f.id}>
                  Absender: {f.address}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    )
  }

  // ── Nachricht lesen ───────────────────────────────────────────────────────
  if (offen) {
    return (
      <div className="buero-karte">
        <button type="button" className="buero-knopf leise" onClick={() => setOffen(null)}>
          Zurück
        </button>
        <h2 style={{ marginTop: '1rem' }}>{offen.betreff}</h2>
        <p className="buero-unterzeile">
          {offen.von} · {zeit(offen.datum)}
          {offen.an ? ` · an ${offen.an}` : ''}
        </p>

        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <button type="button" className="buero-knopf" onClick={() => antworten(offen)}>
            Antworten
          </button>
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() => void aktion(offen.uid, 'ungelesen')}
          >
            Ungelesen
          </button>
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() => void aktion(offen.uid, offen.markiert ? 'unmarkiert' : 'markiert')}
          >
            {offen.markiert ? 'Markierung weg' : 'Markieren'}
          </button>
          <button
            type="button"
            className="buero-knopf leise"
            onClick={() => {
              if (window.confirm('Diese Nachricht in den Papierkorb legen?'))
                void aktion(offen.uid, 'loeschen')
            }}
          >
            Löschen
          </button>
        </div>

        {offen.dateien.length > 0 && (
          <div className="buero-liste" style={{ marginBottom: '1rem' }}>
            {offen.dateien.map((d) => (
              <a
                key={d.name}
                className="buero-zeile"
                href={`/api/office/post/anhang?uid=${offen.uid}&ordner=${encodeURIComponent(
                  ordner,
                )}&fach=${fach ?? ''}&name=${encodeURIComponent(d.name)}`}
              >
                <div className="buero-zeile-haupt">
                  <div className="buero-zeile-titel">{d.name}</div>
                  <div className="buero-zeile-neben">{groesse(d.groesse)}</div>
                </div>
                <span className="buero-marker">laden</span>
              </a>
            ))}
          </div>
        )}

        {offen.html ? (
          <iframe
            title="Nachricht"
            className="buero-mailrahmen"
            sandbox=""
            srcDoc={offen.html}
          />
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{offen.text}</div>
        )}
      </div>
    )
  }

  // ── Liste ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '.6rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        {faecher.length > 1 && (
          <select
            className="buero-fach-wahl"
            value={fach ?? ''}
            onChange={(e) => void laden(e.target.value, 'INBOX')}
          >
            {faecher.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label} — {f.address}
              </option>
            ))}
          </select>
        )}
        {ordnerAlle.length > 1 && (
          <select
            className="buero-fach-wahl"
            value={ordner}
            onChange={(e) => void laden(fach, e.target.value)}
          >
            {ordnerAlle.map((o) => (
              <option key={o.pfad} value={o.pfad}>
                {o.name}
                {o.ungelesen ? ` (${o.ungelesen})` : ''}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className="buero-knopf"
          onClick={() => setEntwurf({ an: '', betreff: '', text: '' })}
        >
          Schreiben
        </button>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft}
          onClick={() => void laden(fach, ordner)}
        >
          {laeuft ? 'Lädt …' : 'Neu laden'}
        </button>
      </div>

      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <div className="buero-liste">
        {liste.length === 0 ? (
          <div className="buero-leer">{laeuft ? 'Lädt …' : 'Keine Nachrichten.'}</div>
        ) : (
          liste.map((n) => (
            <button
              key={n.uid}
              type="button"
              className="buero-zeile buero-zeile-knopf"
              onClick={() => void oeffnen(n.uid)}
            >
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel" style={{ fontWeight: n.gelesen ? 400 : 600 }}>
                  {n.von}
                </div>
                <div className="buero-zeile-neben">
                  {n.betreff}
                  {n.anhaenge ? ' · Anhang' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                {n.markiert && <span className="buero-marker offen">markiert</span>}
                {!n.gelesen && <span className="buero-marker gut">neu</span>}
                <span className="buero-zeile-neben">{zeit(n.datum)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </>
  )
}
