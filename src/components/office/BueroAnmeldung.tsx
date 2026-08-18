'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

import { PasskeyAnmeldung } from './PasskeyAnmeldung'

/**
 * Anmeldung fürs Büro.
 *
 * Erzeugt dieselbe Payload-Sitzung wie die Anmeldung im Admin — wer sich hier
 * anmeldet, kommt ohne zweites Anmelden auch in die Website-Verwaltung.
 * Der Zwei-Faktor-Code geht direkt im Formular mit, statt über ein Cookie.
 */
export function BueroAnmeldung({ ziel = '/office' }: { ziel?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [passwort, setPasswort] = useState('')
  const [code, setCode] = useState('')
  const [codeNoetig, setCodeNoetig] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  async function anmelden(e: React.FormEvent) {
    e.preventDefault()
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password: passwort, code: code || undefined }),
      })

      if (res.ok) {
        router.push(ziel)
        router.refresh()
        return
      }

      const daten = await res.json().catch(() => ({}))
      const text: string = daten?.errors?.[0]?.message ?? ''

      if (text.includes('Zwei-Faktor-Code fehlt')) {
        setCodeNoetig(true)
        setMeldung('Bitte den 6-stelligen Code aus der Authenticator-App eingeben.')
      } else if (text.includes('Zwei-Faktor-Code ist falsch')) {
        setCodeNoetig(true)
        setMeldung('Der Code stimmt nicht oder ist abgelaufen.')
      } else if (res.status === 401) {
        setMeldung('E-Mail oder Passwort stimmt nicht.')
      } else if (text.includes('locked') || res.status === 429) {
        setMeldung('Zu viele Versuche — das Konto ist vorübergehend gesperrt.')
      } else {
        setMeldung(text || 'Anmeldung fehlgeschlagen.')
      }
    } catch {
      setMeldung('Verbindung fehlgeschlagen.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <form onSubmit={anmelden} className="buero-karte" style={{ maxWidth: '24rem' }}>
      <label className="buero-feld">
        <span>E-Mail</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="buero-feld">
        <span>Passwort</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
        />
      </label>

      {codeNoetig && (
        <label className="buero-feld">
          <span>Zwei-Faktor-Code</span>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
          />
        </label>
      )}

      {meldung && <p className="buero-hinweis">{meldung}</p>}

      <button type="submit" className="buero-knopf" disabled={laeuft}>
        {laeuft ? 'meldet an …' : 'Anmelden'}
      </button>

      {/* Der schnelle Weg steht unter dem gewohnten — wer ihn eingerichtet
          hat, findet ihn; wer nicht, wird nicht damit behelligt. */}
      <PasskeyAnmeldung
        ziel={ziel}
        aufErfolg={() => {
          router.push(ziel)
          router.refresh()
        }}
      />

      <p style={{ fontSize: '.8rem', color: 'var(--buero-tinte-leise)', marginBottom: 0 }}>
        Dieselbe Anmeldung gilt auch für die Website-Verwaltung.
      </p>
    </form>
  )
}
