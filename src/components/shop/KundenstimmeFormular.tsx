'use client'

import React, { useState } from 'react'

export type KundenstimmeDict = {
  ratingLabel: string
  ratingHint: string
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
 * **Der Text ist die Hauptsache, die Sterne sind ein Zusatz.** Ursprünglich
 * gab es hier bewusst keine: Bei fünf Stücken im Monat sagt „4,6 von 5"
 * nichts, und zwei Sätze über das Stück am eigenen Platz sagen alles. Für den
 * Menschen, der die Seite liest, gilt das weiterhin.
 *
 * Für Google gilt es nicht. Ohne Zahl gibt es keine Sterne im Suchergebnis,
 * und die entscheiden mit darüber, ob überhaupt jemand klickt. Deshalb der
 * Kompromiss: freiwillig, ohne Vorauswahl, und wer keine vergibt, dessen
 * Stimme steht genauso da.
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
  const [sterne, setSterne] = useState(0)
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
          rating: sterne || undefined,
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
      {/* Sterne zuerst, weil sie schnell gehen — und ohne Vorauswahl, damit
          niemand eine Wertung abgibt, die er gar nicht gemeint hat */}
      <fieldset className="block">
        <legend className="text-ink-soft mb-1 block text-sm">{dict.ratingLabel}</legend>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n}`}
              aria-pressed={sterne === n}
              onClick={() => setSterne(sterne === n ? 0 : n)}
              className={`cursor-pointer px-1 text-2xl leading-none transition-colors ${
                n <= sterne ? 'text-bronze' : 'text-line hover:text-ink-soft'
              }`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="text-ink-soft mt-1 text-xs">{dict.ratingHint}</p>
      </fieldset>
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
