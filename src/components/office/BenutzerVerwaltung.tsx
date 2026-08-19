'use client'

import React, { useCallback, useEffect, useState } from 'react'

/**
 * Wer ins Haus darf.
 *
 * Konten anlegen, Rollen setzen, Passwörter zurücksetzen, verlorene Geräte
 * abmelden. Zwei Dinge gehen bewusst nicht von hier: Zwei-Faktor und Passkeys
 * *einschalten* — dafür braucht es das Gerät des Betroffenen, und niemand
 * sollte einem anderen einen zweiten Faktor einrichten können. Abschalten geht,
 * denn genau dafür ruft jemand an, dessen Handy im Kanal liegt.
 */

type Konto = {
  id: string | number
  email: string
  name: string
  role: string
  mfaEnabled: boolean
  passkeys: { credentialId: string; label: string }[]
}

const ROLLEN: Record<string, string> = {
  inhaber: 'Inhaber (alles)',
  redaktion: 'Redaktion (nur Website)',
}

const FEHLERTEXT: Record<string, string> = {
  'nicht-sich-selbst': 'Das eigene Konto lässt sich hier nicht löschen.',
  'letzter-inhaber': 'Das ist der letzte Inhaber — sonst käme niemand mehr herein.',
  'email-vergeben': 'Diese E-Mail-Adresse gibt es schon.',
  'passwort-zu-kurz': 'Das Passwort braucht mindestens acht Zeichen.',
  unvollstaendig: 'E-Mail und ein Passwort mit acht Zeichen werden gebraucht.',
}

export function BenutzerVerwaltung() {
  const [konten, setKonten] = useState<Konto[] | null>(null)
  const [ich, setIch] = useState<string | number | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [neu, setNeu] = useState({ email: '', name: '', role: 'redaktion', passwort: '' })

  const holen = useCallback(async () => {
    try {
      const antwort = await fetch('/api/office/benutzer', { credentials: 'include' })
      if (!antwort.ok) throw new Error('nicht erreichbar')
      const daten = await antwort.json()
      setKonten(daten.benutzer)
      setIch(daten.ich)
    } catch {
      setMeldung('Benutzerverwaltung braucht eine Verbindung.')
    }
  }, [])

  useEffect(() => {
    void holen()
  }, [holen])

  async function rufen(koerper: Record<string, unknown>, erfolg: string) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch('/api/office/benutzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(koerper),
      })
      const daten = await antwort.json().catch(() => ({}))
      if (!antwort.ok) {
        setMeldung(FEHLERTEXT[daten.error as string] ?? 'Das hat nicht geklappt.')
        return false
      }
      setMeldung(erfolg)
      await holen()
      return true
    } catch {
      setMeldung('Benutzerverwaltung braucht eine Verbindung.')
      return false
    } finally {
      setLaeuft(false)
    }
  }

  if (!konten) {
    return (
      <>
        <h2>Benutzer</h2>
        <div className="buero-leer">{meldung ?? 'wird geholt …'}</div>
      </>
    )
  }

  return (
    <>
      <h2>Benutzer</h2>
      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <div className="buero-liste">
        {konten.map((k) => (
          <div key={k.id} className="buero-karte" style={{ marginBottom: '.8rem' }}>
            <div className="buero-zeile-titel">
              {k.email}
              {String(k.id) === String(ich) ? ' — das bin ich' : ''}
            </div>
            <div className="buero-unterzeile">
              {k.name || 'ohne Namen'} · {ROLLEN[k.role] ?? k.role}
              {k.mfaEnabled ? ' · Zwei-Faktor an' : ''}
              {k.passkeys.length ? ` · ${k.passkeys.length} Gerät(e)` : ''}
            </div>

            <div className="buero-reihe" style={{ marginTop: '.6rem' }}>
              <label className="buero-feld">
                <span>Name</span>
                <input
                  defaultValue={k.name}
                  onBlur={(e) =>
                    e.target.value !== k.name &&
                    rufen(
                      { aktion: 'aendern', id: k.id, name: e.target.value },
                      'Name geändert.',
                    )
                  }
                />
              </label>
              <label className="buero-feld">
                <span>Rolle</span>
                <select
                  value={k.role}
                  disabled={laeuft}
                  onChange={(e) =>
                    rufen({ aktion: 'aendern', id: k.id, role: e.target.value }, 'Rolle geändert.')
                  }
                >
                  {Object.entries(ROLLEN).map(([wert, text]) => (
                    <option key={wert} value={wert}>
                      {text}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', marginTop: '.4rem' }}>
              <button
                type="button"
                className="buero-knopf schmal leise"
                disabled={laeuft}
                onClick={() => {
                  const neues = window.prompt(
                    `Neues Passwort für ${k.email} (mindestens acht Zeichen)`,
                  )
                  if (neues) void rufen({ aktion: 'passwort', id: k.id, passwort: neues }, 'Passwort gesetzt.')
                }}
              >
                Passwort setzen
              </button>

              {k.mfaEnabled && (
                <button
                  type="button"
                  className="buero-knopf schmal leise"
                  disabled={laeuft}
                  onClick={() =>
                    window.confirm(`Zwei-Faktor für ${k.email} abschalten?`) &&
                    rufen(
                      { aktion: 'aendern', id: k.id, mfaEnabled: false },
                      'Zwei-Faktor abgeschaltet.',
                    )
                  }
                >
                  Zwei-Faktor abschalten
                </button>
              )}

              {String(k.id) !== String(ich) && (
                <button
                  type="button"
                  className="buero-knopf schmal gefahr"
                  disabled={laeuft}
                  onClick={() =>
                    window.confirm(`Konto ${k.email} wirklich löschen?`) &&
                    rufen({ aktion: 'loeschen', id: k.id }, 'Konto gelöscht.')
                  }
                >
                  Löschen
                </button>
              )}
            </div>

            {k.passkeys.length > 0 && (
              <div style={{ marginTop: '.6rem' }}>
                <div className="buero-unterzeile">Angemeldete Geräte</div>
                {k.passkeys.map((p) => (
                  <div
                    key={p.credentialId}
                    style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginTop: '.3rem' }}
                  >
                    <span className="buero-marker">{p.label}</span>
                    <button
                      type="button"
                      className="buero-knopf schmal gefahr"
                      disabled={laeuft}
                      onClick={() =>
                        rufen(
                          { aktion: 'passkey-entfernen', id: k.id, credentialId: p.credentialId },
                          'Gerät abgemeldet.',
                        )
                      }
                    >
                      abmelden
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2>Konto anlegen</h2>
      <div className="buero-karte">
        <div className="buero-reihe">
          <label className="buero-feld">
            <span>E-Mail</span>
            <input
              type="email"
              value={neu.email}
              onChange={(e) => setNeu((v) => ({ ...v, email: e.target.value }))}
            />
          </label>
          <label className="buero-feld">
            <span>Name</span>
            <input
              value={neu.name}
              onChange={(e) => setNeu((v) => ({ ...v, name: e.target.value }))}
            />
          </label>
        </div>
        <div className="buero-reihe">
          <label className="buero-feld">
            <span>Rolle</span>
            <select
              value={neu.role}
              onChange={(e) => setNeu((v) => ({ ...v, role: e.target.value }))}
            >
              {Object.entries(ROLLEN).map(([wert, text]) => (
                <option key={wert} value={wert}>
                  {text}
                </option>
              ))}
            </select>
          </label>
          <label className="buero-feld">
            <span>Erstes Passwort (mindestens acht Zeichen)</span>
            <input
              type="password"
              value={neu.passwort}
              onChange={(e) => setNeu((v) => ({ ...v, passwort: e.target.value }))}
            />
          </label>
        </div>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft || !neu.email || neu.passwort.length < 8}
          onClick={async () => {
            const gut = await rufen({ aktion: 'anlegen', ...neu }, 'Konto angelegt.')
            if (gut) setNeu({ email: '', name: '', role: 'redaktion', passwort: '' })
          }}
        >
          Anlegen
        </button>
      </div>
    </>
  )
}
