'use client'

import React, { useState } from 'react'

export type KundenstimmeDict = {
  quoteLabel: string
  authorLabel: string
  contextLabel: string
  consent: string
  submit: string
  thanks: string
  error: string
}

/**
 * Formular für die Kundenstimme aus der Mail nach der Lieferung.
 *
 * Bewusst kein Sternesystem: Bei fünf Stücken im Monat sagt „4,6 von 5"
 * nichts. Zwei Sätze über das Stück am eigenen Platz sagen alles.
 */
export function KundenstimmeFormular({
  token,
  name,
  dict,
}: {
  token: string
  name?: string | null
  dict: KundenstimmeDict
}) {
  const [quote, setQuote] = useState('')
  const [author, setAuthor] = useState(name ?? '')
  const [kontext, setKontext] = useState('')
  const [einverstanden, setEinverstanden] = useState(false)
  const [honig, setHonig] = useState('')
  const [stand, setStand] = useState<'ruhe' | 'laeuft' | 'fertig' | 'fehler'>('ruhe')

  async function absenden(e: React.FormEvent) {
    e.preventDefault()
    setStand('laeuft')
    try {
      const res = await fetch('/api/kundenstimme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          quote,
          author,
          context: kontext,
          einverstanden,
          website: honig,
        }),
      })
      setStand(res.ok ? 'fertig' : 'fehler')
    } catch {
      setStand('fehler')
    }
  }

  if (stand === 'fertig') return <p className="text-ink-soft">{dict.thanks}</p>

  const feld = 'border-line w-full border px-4 py-3 text-sm focus:border-ink focus:outline-none'

  return (
    <form onSubmit={absenden} className="mt-8 space-y-4">
      <label className="block">
        <span className="text-ink-soft mb-1 block text-sm">{dict.quoteLabel}</span>
        <textarea
          required
          rows={5}
          maxLength={2000}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          className={feld}
        />
      </label>
      <label className="block">
        <span className="text-ink-soft mb-1 block text-sm">{dict.authorLabel}</span>
        <input
          required
          maxLength={120}
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className={feld}
        />
      </label>
      <label className="block">
        <span className="text-ink-soft mb-1 block text-sm">{dict.contextLabel}</span>
        <input value={kontext} onChange={(e) => setKontext(e.target.value)} className={feld} />
      </label>

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honig}
        onChange={(e) => setHonig(e.target.value)}
        className="hidden"
      />

      <label className="text-ink-soft flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          required
          checked={einverstanden}
          onChange={(e) => setEinverstanden(e.target.checked)}
          className="accent-ink mt-0.5"
        />
        <span>{dict.consent}</span>
      </label>

      {stand === 'fehler' && <p className="text-accent text-sm">{dict.error}</p>}

      <button
        type="submit"
        disabled={stand === 'laeuft'}
        className="bg-ink tracking-nav hover:bg-bronze px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors disabled:opacity-50"
      >
        {dict.submit}
      </button>
    </form>
  )
}
