'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Rueckmeldung } from './Rueckmeldung'

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
  benutzername: string
  name: string
  role: string
  rolleId: number | null
  mfaEnabled: boolean
  passkeys: { credentialId: string; label: string }[]
}

type Rolle = { id: number; name: string; schluessel: string; eingebaut: boolean }

const FEHLERTEXT: Record<string, string> = {
  'noch-belegt': 'An dieser Rolle hängen noch Konten — erst umhängen, dann löschen.',
  eingebaut: 'Eingebaute Rollen lassen sich nicht löschen.',
  'nicht-sich-selbst': 'Das eigene Konto lässt sich hier nicht löschen.',
  'letzter-inhaber': 'Das ist der letzte Inhaber — sonst käme niemand mehr herein.',
  'email-vergeben': 'Diese E-Mail-Adresse gibt es schon.',
  'passwort-zu-kurz': 'Das Passwort braucht mindestens acht Zeichen.',
  unvollstaendig:
    'E-Mail oder Benutzername, dazu ein Passwort mit acht Zeichen — das wird gebraucht.',
}

export function BenutzerVerwaltung() {
  const [konten, setKonten] = useState<Konto[] | null>(null)
  const [rollen, setRollen] = useState<Rolle[]>([])
  const [ich, setIch] = useState<string | number | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [neu, setNeu] = useState<{
    email: string
    benutzername: string
    name: string
    rolleId: number | ''
    passwort: string
  }>({ email: '', benutzername: '', name: '', rolleId: '', passwort: '' })

  const holen = useCallback(async () => {
    try {
      const [antwort, rollenAntwort] = await Promise.all([
        fetch('/api/office/benutzer', { credentials: 'include' }),
        fetch('/api/office/rolle', { credentials: 'include' }),
      ])
      if (!antwort.ok) throw new Error('nicht erreichbar')
      const daten = await antwort.json()
      setKonten(daten.benutzer)
      setIch(daten.ich)
      if (rollenAntwort.ok) {
        const r = await rollenAntwort.json()
        setRollen(r.rollen ?? [])
        // Vorbelegung fürs Anlegen: die erste Rolle, die nicht alles darf
        setNeu((v) =>
          v.rolleId === ''
            ? {
                ...v,
                rolleId:
                  (r.rollen ?? []).find((x: Rolle) => x.schluessel !== 'inhaber')?.id ??
                  (r.rollen ?? [])[0]?.id ??
                  '',
              }
            : v,
        )
      }
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
      <Rueckmeldung text={meldung} />

      <div className="buero-liste">
        {konten.map((k) => (
          <div key={k.id} className="buero-karte" style={{ marginBottom: '.8rem' }}>
            <div className="buero-zeile-titel">
              {k.email || k.benutzername}
              {String(k.id) === String(ich) ? ' — das bin ich' : ''}
            </div>
            <div className="buero-unterzeile">
              {k.name || 'ohne Namen'} ·{' '}
              {rollen.find((r) => r.id === k.rolleId)?.name ?? k.role}
              {k.benutzername && k.email ? ` · Anmeldename ${k.benutzername}` : ''}
              {!k.email ? ' · ohne E-Mail' : ''}
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
                  value={k.rolleId ?? ''}
                  disabled={laeuft}
                  onChange={(e) =>
                    rufen(
                      { aktion: 'aendern', id: k.id, rolleId: Number(e.target.value) },
                      'Rolle geändert.',
                    )
                  }
                >
                  {k.rolleId === null && <option value="">— ohne Rolle —</option>}
                  {rollen.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
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
            <span>E-Mail (leer lassen geht)</span>
            <input
              type="email"
              value={neu.email}
              onChange={(e) => setNeu((v) => ({ ...v, email: e.target.value }))}
            />
          </label>
          <label className="buero-feld">
            <span>Benutzername (statt E-Mail)</span>
            <input
              autoCapitalize="none"
              placeholder="z.B. werkstatt"
              value={neu.benutzername}
              onChange={(e) => setNeu((v) => ({ ...v, benutzername: e.target.value }))}
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
              value={neu.rolleId}
              onChange={(e) => setNeu((v) => ({ ...v, rolleId: Number(e.target.value) }))}
            >
              {rollen.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
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
          disabled={laeuft || (!neu.email && !neu.benutzername) || neu.passwort.length < 8}
          onClick={async () => {
            const gut = await rufen({ aktion: 'anlegen', ...neu }, 'Konto angelegt.')
            if (gut)
              setNeu((v) => ({ email: '', benutzername: '', name: '', rolleId: v.rolleId, passwort: '' }))
          }}
        >
          Anlegen
        </button>
      </div>
    </>
  )
}
