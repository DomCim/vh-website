'use client'

import { Button, useDocumentInfo, useFormFields } from '@payloadcms/ui'
import { useState } from 'react'

type Start = { geheim: string; uri: string; qr: string }

/**
 * Einrichtung der Zwei-Faktor-Anmeldung im eigenen Benutzerkonto.
 * Wird als UI-Feld in der Benutzer-Sammlung gerendert.
 */
export function MfaSetup() {
  const { id } = useDocumentInfo()
  const aktiv = useFormFields(([felder]) => Boolean(felder?.mfaEnabled?.value))

  const [start, setStart] = useState<Start | null>(null)
  const [code, setCode] = useState('')
  const [ersatzcodes, setErsatzcodes] = useState<string[] | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const ruf = async (aktion: string, mit: Record<string, unknown> = {}) => {
    setLaeuft(true)
    setMeldung(null)
    try {
      const antwort = await fetch('/api/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion, ...mit }),
      })
      const daten = await antwort.json()
      if (!antwort.ok) {
        setMeldung(
          daten.error === 'code-falsch'
            ? 'Der Code stimmt nicht. Bitte den aktuellen Code aus der App eingeben.'
            : 'Das hat nicht geklappt. Bitte erneut versuchen.',
        )
        return null
      }
      return daten
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
      return null
    } finally {
      setLaeuft(false)
    }
  }

  if (!id) {
    return (
      <div style={{ marginBlock: '1.5rem' }}>
        <h4>Zwei-Faktor-Anmeldung</h4>
        <p>Erst den Benutzer speichern, danach lässt sich die Zwei-Faktor-Anmeldung einrichten.</p>
      </div>
    )
  }

  return (
    <div style={{ marginBlock: '1.5rem', maxWidth: '38rem' }}>
      <h4 style={{ marginBottom: '.35rem' }}>Zwei-Faktor-Anmeldung</h4>
      <p style={{ marginTop: 0, opacity: 0.75 }}>
        Zusätzlich zum Passwort ein 6-stelliger Code aus einer Authenticator-App (Google
        Authenticator, Microsoft Authenticator, 1Password, Aegis …). Nur für das eigene Konto
        einrichtbar.
      </p>

      {aktiv ? (
        <>
          <p>
            <strong>Aktiv.</strong> Beim nächsten Anmelden wird der Code abgefragt.
          </p>
          <label style={{ display: 'block', marginBottom: '.5rem' }}>
            Aktueller Code aus der App
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              style={{ display: 'block', marginTop: '.25rem', padding: '.5rem', width: '9rem' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
            <Button
              size="small"
              disabled={laeuft}
              onClick={async () => {
                const d = await ruf('ersatzcodes', { code })
                if (d?.ersatzcodes) {
                  setErsatzcodes(d.ersatzcodes)
                  setCode('')
                }
              }}
            >
              Neue Ersatzcodes erzeugen
            </Button>
            <Button
              size="small"
              buttonStyle="secondary"
              disabled={laeuft}
              onClick={async () => {
                const d = await ruf('deaktivieren', { code })
                if (d?.ok) window.location.reload()
              }}
            >
              Zwei-Faktor abschalten
            </Button>
          </div>
        </>
      ) : start ? (
        <>
          <ol style={{ paddingLeft: '1.1rem' }}>
            <li>QR-Code in der Authenticator-App scannen …</li>
            <li>
              … oder den Schlüssel von Hand eintragen: <code>{start.geheim}</code>
            </li>
            <li>Den angezeigten 6-stelligen Code hier eingeben.</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={start.qr} alt="QR-Code für die Authenticator-App" width={220} height={220} />
          <label style={{ display: 'block', margin: '.75rem 0' }}>
            Code aus der App
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              style={{ display: 'block', marginTop: '.25rem', padding: '.5rem', width: '9rem' }}
            />
          </label>
          <Button
            size="small"
            disabled={laeuft}
            onClick={async () => {
              const d = await ruf('aktivieren', { code })
              if (d?.ok) {
                setErsatzcodes(d.ersatzcodes)
                setStart(null)
                setCode('')
              }
            }}
          >
            Aktivieren
          </Button>
        </>
      ) : (
        <Button
          size="small"
          disabled={laeuft}
          onClick={async () => {
            const d = await ruf('start')
            if (d?.qr) setStart(d as Start)
          }}
        >
          Zwei-Faktor einrichten
        </Button>
      )}

      {ersatzcodes && (
        <div
          style={{
            marginTop: '1rem',
            padding: '.75rem 1rem',
            border: '1px solid currentColor',
            borderRadius: 4,
          }}
        >
          <strong>Ersatzcodes — jetzt sicher notieren, sie werden nur einmal angezeigt.</strong>
          <p style={{ marginBottom: '.5rem' }}>
            Jeder Code funktioniert genau einmal, falls das Handy nicht zur Hand ist.
          </p>
          <code style={{ display: 'block', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
            {ersatzcodes.join('\n')}
          </code>
        </div>
      )}

      {meldung && <p style={{ marginTop: '.75rem' }}>{meldung}</p>}
    </div>
  )
}
