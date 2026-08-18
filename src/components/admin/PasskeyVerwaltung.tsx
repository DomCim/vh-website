'use client'

import { startRegistration } from '@simplewebauthn/browser'
import { Button, useDocumentInfo } from '@payloadcms/ui'
import React, { useEffect, useState } from 'react'

type Eintrag = { credentialId: string; label?: string | null; lastUsedAt?: string | null }

/**
 * Passkeys einrichten — Face ID, Fingerabdruck oder Geräte-PIN statt
 * Passwort und Authenticator-Code.
 *
 * Wie die Zwei-Faktor-Anmeldung wird das je Benutzer eingerichtet, und zwar
 * an dem Gerät, mit dem man sich später anmelden will: Der Schlüssel entsteht
 * im Gerät und verlässt es nie. Ein iPhone reicht seinen Passkey über den
 * Schlüsselbund an iPad und Mac weiter; für ein Android-Handy legt man einen
 * eigenen an.
 */
export function PasskeyVerwaltung() {
  const { id } = useDocumentInfo()
  const [eintraege, setEintraege] = useState<Eintrag[]>([])
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [eigenesKonto, setEigenesKonto] = useState<boolean | null>(null)

  // Passkeys lassen sich nur für das eigene Konto anlegen — der Finger muss
  // ja am Gerät liegen.
  useEffect(() => {
    let abgebrochen = false
    void fetch('/api/users/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (abgebrochen) return
        setEigenesKonto(!id || String(d?.user?.id) === String(id))
        setEintraege(d?.user?.passkeys ?? [])
      })
      .catch(() => setEigenesKonto(false))
    return () => {
      abgebrochen = true
    }
  }, [id])

  async function anlegen() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const start = await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'anlegen-start' }),
      }).then((r) => r.json())
      if (!start?.optionen) throw new Error(start?.error ?? 'start')

      const antwort = await startRegistration({ optionsJSON: start.optionen })

      const fertig = await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'anlegen-fertig', antwort }),
      }).then((r) => r.json())
      if (!fertig?.ok) throw new Error(fertig?.error ?? 'fertig')

      setMeldung(`„${fertig.passkey.label}" ist eingerichtet. Die Anmeldung geht ab sofort damit.`)
      setEintraege((v) => [...v, { credentialId: 'neu', label: fertig.passkey.label }])
    } catch (err) {
      const text = err instanceof Error ? err.message : ''
      setMeldung(
        text.includes('NotAllowed') || text.includes('AbortError')
          ? 'Abgebrochen — es wurde nichts eingerichtet.'
          : 'Das hat nicht geklappt. Passkeys brauchen eine verschlüsselte Verbindung (https).',
      )
    } finally {
      setLaeuft(false)
    }
  }

  async function entfernen(credentialId: string) {
    if (!confirm('Diesen Passkey wirklich entfernen?')) return
    setLaeuft(true)
    try {
      await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'entfernen', credentialId }),
      })
      setEintraege((v) => v.filter((e) => e.credentialId !== credentialId))
      setMeldung('Entfernt.')
    } finally {
      setLaeuft(false)
    }
  }

  if (eigenesKonto === false) {
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        <strong>Passkeys</strong>
        <p style={{ opacity: 0.75 }}>
          Passkeys lassen sich nur am eigenen Konto und am eigenen Gerät einrichten.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <strong>Passkeys (Face ID, Fingerabdruck, Geräte-PIN)</strong>
      <p style={{ margin: '.15rem 0 .6rem', opacity: 0.75 }}>
        Statt Passwort und Code: Der Schlüssel liegt im Gerät und wird erst nach Gesicht, Finger
        oder PIN herausgegeben. Er lässt sich nicht abtippen und nicht auf einer falschen Seite
        eingeben. Das Passwort bleibt als Rückweg bestehen.
      </p>

      {eintraege.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 .8rem' }}>
          {eintraege.map((e) => (
            <li
              key={e.credentialId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.6rem',
                padding: '.35rem 0',
              }}
            >
              <span>{e.label || 'Gerät'}</span>
              {e.lastUsedAt && (
                <span style={{ opacity: 0.6, fontSize: '.85em' }}>
                  zuletzt {new Date(e.lastUsedAt).toLocaleDateString('de-DE')}
                </span>
              )}
              {e.credentialId !== 'neu' && (
                <button
                  type="button"
                  className="btn btn--style-secondary btn--size-small"
                  style={{ margin: 0 }}
                  disabled={laeuft}
                  onClick={() => void entfernen(e.credentialId)}
                >
                  Entfernen
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button buttonStyle="secondary" disabled={laeuft} onClick={() => void anlegen()} size="small">
        {laeuft ? 'einen Moment …' : 'Dieses Gerät hinzufügen'}
      </Button>

      {meldung && <p style={{ marginTop: '.6rem' }}>{meldung}</p>}
    </div>
  )
}
