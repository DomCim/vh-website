'use client'

import React, { useState } from 'react'

export type NewsletterDict = {
  title: string
  intro: string
  emailLabel: string
  submit: string
  sent: string
  error: string
  privacy: string
  confirmedTitle: string
  confirmedText: string
  goodbyeTitle: string
  goodbyeText: string
  unknownTitle: string
  unknownText: string
}

/**
 * Anmeldung zum Newsletter.
 *
 * Eine Zeile, ein Knopf — mehr braucht es nicht. Die Bestätigungsmail ist
 * der eigentliche Schritt; deshalb sagt die Meldung danach klar, dass noch
 * etwas zu tun ist, sonst wartet die Kundschaft auf Post, die nie kommt.
 */
export function NewsletterAnmeldung({
  locale,
  dict,
  kompakt = false,
}: {
  locale: string
  dict: NewsletterDict
  kompakt?: boolean
}) {
  const [email, setEmail] = useState('')
  const [honig, setHonig] = useState('')
  const [stand, setStand] = useState<'ruhe' | 'laeuft' | 'fertig' | 'fehler'>('ruhe')

  async function absenden(e: React.FormEvent) {
    e.preventDefault()
    setStand('laeuft')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale, website: honig }),
      })
      setStand(res.ok ? 'fertig' : 'fehler')
      if (res.ok) setEmail('')
    } catch {
      setStand('fehler')
    }
  }

  if (stand === 'fertig') {
    return <p className={kompakt ? 'text-sm text-white/80' : 'text-ink-soft'}>{dict.sent}</p>
  }

  return (
    <form onSubmit={absenden} className={kompakt ? 'mt-3' : 'mt-6'}>
      <div className="flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={dict.emailLabel}
          aria-label={dict.emailLabel}
          className={
            kompakt
              ? 'min-w-0 flex-1 border border-white/25 bg-transparent px-3 py-2 text-sm text-white placeholder-white/50 focus:border-white/60 focus:outline-none'
              : 'border-line min-w-0 flex-1 border px-4 py-3 text-sm focus:border-ink focus:outline-none'
          }
        />
        {/* Honigtopf — für Menschen unsichtbar, Bots füllen ihn aus */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honig}
          onChange={(e) => setHonig(e.target.value)}
          className="hidden"
          aria-hidden="true"
        />
        <button
          type="submit"
          disabled={stand === 'laeuft'}
          className={
            kompakt
              ? 'tracking-nav bg-white px-4 py-2 text-xs font-semibold text-black uppercase transition-colors hover:bg-bronze hover:text-on-ink disabled:opacity-50'
              : 'bg-ink tracking-nav hover:bg-bronze px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors disabled:opacity-50'
          }
        >
          {dict.submit}
        </button>
      </div>
      <p className={kompakt ? 'mt-2 text-xs text-white/50' : 'text-ink-soft mt-3 text-xs'}>
        {stand === 'fehler' ? dict.error : dict.privacy}
      </p>
    </form>
  )
}
