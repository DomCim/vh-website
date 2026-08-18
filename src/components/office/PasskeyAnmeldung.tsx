'use client'

import { startAuthentication } from '@simplewebauthn/browser'
import React, { useEffect, useState } from 'react'

/**
 * Anmelden mit Face ID, Fingerabdruck oder Geräte-PIN.
 *
 * Ein Knopf, ein Blick aufs Gerät, drin. Kein Passwort, kein Code aus der
 * Authenticator-App — und keine Möglichkeit, das Ganze auf einer gefälschten
 * Seite einzugeben, denn der Browser gibt den Schlüssel nur an die Adresse
 * heraus, für die er angelegt wurde.
 *
 * Erscheint nur, wenn das Gerät überhaupt Passkeys kann; sonst bliebe ein
 * Knopf stehen, der nichts tut.
 */
export function PasskeyAnmeldung({
  ziel = '/office',
  aufErfolg,
  aussehen = 'buero',
}: {
  ziel?: string
  aufErfolg?: () => void
  aussehen?: 'buero' | 'admin'
}) {
  const [moeglich, setMoeglich] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  useEffect(() => {
    setMoeglich(typeof window !== 'undefined' && Boolean(window.PublicKeyCredential))
  }, [])

  if (!moeglich) return null

  async function anmelden() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const start = await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'anmelden-start' }),
      }).then((r) => r.json())
      if (!start?.optionen) throw new Error(start?.error ?? 'start')

      const antwort = await startAuthentication({ optionsJSON: start.optionen })

      const fertig = await fetch('/api/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion: 'anmelden-fertig', antwort }),
      }).then((r) => r.json())

      if (!fertig?.ok) {
        setMeldung(
          fertig?.error === 'unbekannt'
            ? 'Dieses Gerät ist noch nicht hinterlegt. Einmal mit Passwort anmelden und den Passkey einrichten.'
            : 'Die Anmeldung wurde nicht bestätigt.',
        )
        return
      }

      if (aufErfolg) aufErfolg()
      else window.location.href = ziel
    } catch (err) {
      const text = err instanceof Error ? err.message : ''
      setMeldung(
        text.includes('NotAllowed') || text.includes('AbortError')
          ? null
          : 'Das hat nicht geklappt — bitte mit Passwort anmelden.',
      )
    } finally {
      setLaeuft(false)
    }
  }

  const knopfKlasse = aussehen === 'admin' ? 'btn btn--style-secondary' : 'buero-knopf schmal'

  return (
    <div style={{ marginTop: '.8rem' }}>
      <button
        type="button"
        className={knopfKlasse}
        disabled={laeuft}
        onClick={() => void anmelden()}
        style={aussehen === 'admin' ? { width: '100%', margin: 0 } : { width: '100%', justifyContent: 'center' }}
      >
        {laeuft ? 'wartet auf das Gerät …' : 'Mit Face ID / Fingerabdruck anmelden'}
      </button>
      {meldung && (
        <p
          style={{
            fontSize: '.8rem',
            marginTop: '.5rem',
            color: aussehen === 'admin' ? undefined : 'var(--buero-tinte-leise)',
          }}
        >
          {meldung}
        </p>
      )}
    </div>
  )
}
