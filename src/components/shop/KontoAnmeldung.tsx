'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type Labels = {
  intro: string
  email: string
  requestCode: string
  codeSent: string
  code: string
  signIn: string
  wrongCode: string
  expiredCode: string
  lockedCode: string
  tooMany: string
  error: string
}

/**
 * Anmeldung zur Bestellübersicht per sechsstelligem Code.
 * Bewusst kein Link in der E-Mail: Outlook ruft Links vorab auf und würde
 * einen Einmal-Link verbrauchen, bevor die Kundschaft ihn anklickt.
 */
export function KontoAnmeldung({ labels, locale }: { labels: Labels; locale: string }) {
  const router = useRouter()
  const [schritt, setSchritt] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [meldung, setMeldung] = useState<string | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const inputClass =
    'border-line focus:border-ink w-full border bg-paper px-4 py-3 text-sm outline-none transition-colors'
  const buttonClass =
    'bg-ink tracking-nav hover:bg-bronze cursor-pointer px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors disabled:opacity-50'

  const fehlerText = (schluessel: string) =>
    ({
      falsch: labels.wrongCode,
      abgelaufen: labels.expiredCode,
      gesperrt: labels.lockedCode,
      'zu-viele-anfragen': labels.tooMany,
    })[schluessel] ?? labels.error

  async function senden(aktion: 'code-anfordern' | 'anmelden') {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/konto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Die Sprache mit: Der Anmeldecode soll in der Sprache ankommen, in
        // der die Kundschaft gerade auf der Seite steht
        body: JSON.stringify({ aktion, email, code, locale }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(fehlerText(daten.error))
        return
      }
      if (aktion === 'code-anfordern') {
        setSchritt('code')
        setMeldung(labels.codeSent)
      } else {
        router.refresh()
      }
    } catch {
      setMeldung(labels.error)
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void senden(schritt === 'email' ? 'code-anfordern' : 'anmelden')
      }}
      className="max-w-md space-y-4"
    >
      <p className="text-ink-soft text-sm leading-relaxed">{labels.intro}</p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={labels.email}
        autoComplete="email"
        disabled={schritt === 'code'}
        className={inputClass}
      />
      {schritt === 'code' && (
        <input
          type="text"
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={labels.code}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className={inputClass}
        />
      )}
      <button type="submit" disabled={laeuft} className={buttonClass}>
        {schritt === 'email' ? labels.requestCode : labels.signIn}
      </button>
      {meldung && <p className="text-ink-soft text-sm">{meldung}</p>}
    </form>
  )
}
