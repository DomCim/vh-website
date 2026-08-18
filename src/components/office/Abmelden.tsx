'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/** Meldet aus Büro und Website-Verwaltung gleichzeitig ab. */
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
          router.push('/office/login')
          router.refresh()
        }
      }}
    >
      {laeuft ? '…' : 'Abmelden'}
    </button>
  )
}
