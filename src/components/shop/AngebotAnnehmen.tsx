'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

type Labels = {
  acceptQuote: string
  acceptName: string
  acceptHint: string
  accepting: string
  acceptedNow: string
  acceptError: string
}

/**
 * Ein Angebot im Portal annehmen.
 *
 * Zwei Schritte statt einem: erst der Knopf, dann Name und Bestätigung. Ein
 * einzelner Klick, der eine Beauftragung auslöst, ist zu leicht ausgelöst —
 * und die Zusage soll nachher belegen können, wer sie gegeben hat.
 *
 * Bewusst ohne Häkchen für die Bedingungen: Sie stehen im Angebot, das
 * daneben verlinkt ist. Ein zweites Kästchen erzeugt keine zusätzliche
 * Zustimmung, nur eine zusätzliche Hürde.
 */
export function AngebotAnnehmen({ id, labels }: { id: number | string; labels: Labels }) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [name, setName] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  async function annehmen() {
    setLaeuft(true)
    setFehler(null)
    try {
      const res = await fetch('/api/konto/angebot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name }),
      })
      if (!res.ok) throw new Error()
      setFertig(true)
      router.refresh()
    } catch {
      setFehler(labels.acceptError)
    } finally {
      setLaeuft(false)
    }
  }

  if (fertig) return <p className="text-bronze text-sm">{labels.acceptedNow}</p>

  if (!offen) {
    return (
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-6 py-2 text-xs font-semibold text-white uppercase transition-colors"
      >
        {labels.acceptQuote}
      </button>
    )
  }

  return (
    <div className="border-line w-full border p-4">
      <p className="text-ink-soft mb-3 text-sm">{labels.acceptHint}</p>
      <label className="mb-3 block">
        <span className="text-ink-soft mb-1 block text-xs">{labels.acceptName}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-line focus:border-ink w-full border bg-white px-3 py-2 text-sm outline-none transition-colors"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={laeuft}
          onClick={annehmen}
          className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-6 py-2 text-xs font-semibold text-white uppercase transition-colors disabled:opacity-50"
        >
          {laeuft ? labels.accepting : labels.acceptQuote}
        </button>
        <button
          type="button"
          onClick={() => setOffen(false)}
          className="text-ink-soft hover:text-ink cursor-pointer text-xs underline"
        >
          ×
        </button>
      </div>
      {fehler && <p className="mt-2 text-sm text-red-700">{fehler}</p>}
    </div>
  )
}
