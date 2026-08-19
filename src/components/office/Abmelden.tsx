'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { bestandVergessen } from '../../lib/buero/bestand'

/**
 * Meldet aus Büro und Website-Verwaltung gleichzeitig ab.
 *
 * Und wirft den Bestand aus dem Gerät. Das ist kein Beiwerk: Seit das Büro
 * offline arbeitet, liegen Umsätze, Belege und Kundendaten im Browser. Ohne
 * diesen Handgriff blieben sie dort liegen, obwohl niemand mehr angemeldet ist.
 */
export function Abmelden() {
  const router = useRouter()
  const [laeuft, setLaeuft] = useState(false)

  return (
    <button
      type="button"
      className="buero-marker"
      style={{ background: 'none', cursor: 'pointer', font: 'inherit' }}
      disabled={laeuft}
      onClick={async () => {
        setLaeuft(true)
        try {
          await fetch('/api/users/logout', { method: 'POST', credentials: 'include' })
        } finally {
          await bestandVergessen().catch(() => undefined)
          router.push('/office/login')
          router.refresh()
        }
      }}
    >
      {laeuft ? '…' : 'Abmelden'}
    </button>
  )
}
