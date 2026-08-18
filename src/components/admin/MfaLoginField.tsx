'use client'

import { useState } from 'react'

/**
 * Zusätzliches Feld auf der Anmeldeseite.
 *
 * Payloads Anmeldeformular schickt nur E-Mail und Passwort. Der eingegebene
 * Code wird deshalb in ein kurzlebiges Cookie geschrieben, das beim Absenden
 * automatisch mitgeht — der beforeLogin-Hook liest ihn dort aus.
 */
export function MfaLoginField() {
  const [code, setCode] = useState('')

  const merken = (wert: string) => {
    setCode(wert)
    const ziffern = wert.replace(/\D/g, '').slice(0, 6)
    document.cookie = `vh-mfa-code=${encodeURIComponent(ziffern)}; path=/; max-age=180; SameSite=Strict`
  }

  return (
    <div className="field-type text" style={{ marginBottom: '1rem' }}>
      <label className="field-label" htmlFor="vh-mfa-code">
        Zwei-Faktor-Code
        <span style={{ opacity: 0.6 }}> — nur nötig, wenn eingerichtet</span>
      </label>
      <input
        id="vh-mfa-code"
        name="vh-mfa-code"
        className="field-type__wrap"
        value={code}
        onChange={(e) => merken(e.target.value)}
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="123456"
        style={{ width: '100%', padding: '.6rem .75rem' }}
      />
    </div>
  )
}
