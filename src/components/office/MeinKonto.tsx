'use client'

import { startRegistration } from '@simplewebauthn/browser'
import React, { useCallback, useEffect, useState } from 'react'

/**
 * Das eigene Konto: Zwei-Faktor und angemeldete Geräte.
 *
 * Beides lässt sich nur für sich selbst einrichten, und das ist keine
 * Bequemlichkeitsentscheidung: Ein zweiter Faktor, den jemand anderes
 * einrichten kann, ist keiner. Der Schlüssel eines Passkeys entsteht im Gerät
 * und verlässt es nie — deshalb muss man an dem Gerät sitzen, mit dem man sich
 * später anmelden will.
 */

type Passkey = { credentialId: string; label: string; lastUsedAt?: string | null }
type Start = { geheim: string; uri: string; qr: string }

export function MeinKonto() {
  const [mfaAktiv, setMfaAktiv] = useState<boolean | null>(null)
  const [geraete, setGeraete] = useState<Passkey[]>([])
  const [start, setStart] = useState<Start | null>(null)
  const [code, setCode] = useState('')
  const [ersatzcodes, setErsatzcodes] = useState<string[] | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const holen = useCallback(async () => {
    try {
      const antwort = await fetch('/api/office/benutzer', { credentials: 'include' })
      if (!antwort.ok) throw new Error('nicht erreichbar')
      const daten = await antwort.json()
      const ich = daten.benutzer.find(
        (k: { id: string | number }) => String(k.id) === String(daten.ich),
      )
      setMfaAktiv(Boolean(ich?.mfaEnabled))
      setGeraete(ich?.passkeys ?? [])
    } catch {
      setMeldung('Dafür wird eine Verbindung gebraucht.')
      setMfaAktiv(false)
    }
  }, [])

  useEffect(() => {
    void holen()
  }, [holen])

  async function mfa(aktion: string, mit: Record<string, unknown> = {}) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch('/api/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion, ...mit }),
      })
      const daten = await antwort.json().catch(() => ({}))
      if (!antwort.ok) {
        setMeldung(daten.error === 'code-falsch' ? 'Der Code stimmt nicht.' : 'Das hat nicht geklappt.')
        return null
      }
      return daten
    } catch {
      setMeldung('Dafür wird eine Verbindung gebraucht.')
      return null
    } finally {
      setLaeuft(false)
    }
  }

  async function geraetAnmelden() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const begonnen = await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'anlegen-start' }),
      }).then((r) => r.json())
      if (!begonnen?.optionen) throw new Error('start')

      const antwort = await startRegistration({ optionsJSON: begonnen.optionen })

      const fertig = await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'anlegen-fertig', antwort }),
      }).then((r) => r.json())

      if (!fertig?.ok) throw new Error('fertig')
      setMeldung('Dieses Gerät ist eingerichtet.')
      await holen()
    } catch {
      setMeldung('Das Gerät hat abgebrochen oder kann keine Passkeys.')
    } finally {
      setLaeuft(false)
    }
  }

  async function geraetAbmelden(credentialId: string) {
    setLaeuft(true)
    try {
      await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'entfernen', credentialId }),
      })
      await holen()
      setMeldung('Gerät abgemeldet.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <>
      <h2>Zwei-Faktor</h2>
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      {mfaAktiv === null ? (
        <div className="buero-leer">wird geholt …</div>
      ) : mfaAktiv ? (
        <div className="buero-karte">
          <p>Zwei-Faktor ist eingeschaltet.</p>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="buero-knopf schmal leise"
              disabled={laeuft}
              onClick={async () => {
                const daten = await mfa('ersatzcodes')
                if (daten?.ersatzcodes) setErsatzcodes(daten.ersatzcodes)
              }}
            >
              Neue Ersatzcodes
            </button>
            <button
              type="button"
              className="buero-knopf schmal gefahr"
              disabled={laeuft}
              onClick={async () => {
                if (!window.confirm('Zwei-Faktor wirklich abschalten?')) return
                if (await mfa('deaktivieren')) {
                  setMeldung('Zwei-Faktor ist aus.')
                  await holen()
                }
              }}
            >
              Abschalten
            </button>
          </div>
        </div>
      ) : start ? (
        <div className="buero-karte">
          <p className="buero-unterzeile">
            In der Authenticator-App einlesen, dann den angezeigten Code eintragen.
          </p>
          {/* Ein QR-Code als Datenadresse — Nexts Bildkomponente hätte hier nichts zu optimieren */}
          <img src={start.qr} alt="QR-Code für die Authenticator-App" width={220} height={220} />
          <p className="buero-unterzeile">Zum Abtippen: {start.geheim}</p>
          <label className="buero-feld">
            <span>Code aus der App</span>
            <input
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </label>
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft || code.length < 6}
            onClick={async () => {
              const daten = await mfa('aktivieren', { code })
              if (daten) {
                setErsatzcodes(daten.ersatzcodes ?? null)
                setStart(null)
                setCode('')
                await holen()
              }
            }}
          >
            Einschalten
          </button>
        </div>
      ) : (
        <div className="buero-karte">
          <p className="buero-unterzeile">
            Ein zweiter Faktor schützt das Konto auch dann, wenn das Passwort einmal woanders
            auftaucht.
          </p>
          <button
            type="button"
            className="buero-knopf"
            disabled={laeuft}
            onClick={async () => {
              const daten = await mfa('start')
              if (daten?.qr) setStart(daten as Start)
            }}
          >
            Einrichten
          </button>
        </div>
      )}

      {ersatzcodes && (
        <div className="buero-hinweis warn">
          <strong>Ersatzcodes — jetzt notieren, sie werden nicht wieder gezeigt:</strong>
          <br />
          {ersatzcodes.join(' · ')}
        </div>
      )}

      <h2>Angemeldete Geräte</h2>
      <p className="buero-unterzeile">
        Mit Face ID, Fingerabdruck oder Geräte-PIN anmelden — ohne Passwort und ohne Code. Der
        Schlüssel entsteht im Gerät und verlässt es nie.
      </p>

      <div className="buero-liste">
        {geraete.length === 0 ? (
          <div className="buero-leer">Noch kein Gerät hinterlegt.</div>
        ) : (
          geraete.map((g) => (
            <div key={g.credentialId} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{g.label}</div>
                {g.lastUsedAt && (
                  <div className="buero-zeile-neben">
                    zuletzt {new Date(g.lastUsedAt).toLocaleDateString('de-DE')}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="buero-knopf schmal gefahr"
                disabled={laeuft}
                onClick={() => geraetAbmelden(g.credentialId)}
              >
                Abmelden
              </button>
            </div>
          ))
        )}
      </div>

      <button
        type="button"
        className="buero-knopf"
        style={{ marginTop: '.8rem' }}
        disabled={laeuft}
        onClick={geraetAnmelden}
      >
        Dieses Gerät hinzufügen
      </button>
    </>
  )
}
