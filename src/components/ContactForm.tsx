'use client'

import React, { useState } from 'react'

import type { Locale } from '../lib/i18n'

type Labels = {
  name: string
  email: string
  phone: string
  message: string
  send: string
  success: string
  error: string
}

export function ContactForm({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, locale }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('success')
      form.reset()
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'border-line focus:border-ink w-full border bg-white px-4 py-3 text-sm outline-none transition-colors'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honigtopf gegen Spam-Bots — für Menschen unsichtbar */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <input type="text" name="name" required placeholder={labels.name} className={inputClass} />
      <input type="email" name="email" required placeholder={labels.email} className={inputClass} />
      <input type="tel" name="phone" placeholder={labels.phone} className={inputClass} />
      <textarea
        name="message"
        required
        rows={6}
        placeholder={labels.message}
        className={inputClass}
      />
      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-8 py-3 text-xs font-semibold text-white uppercase transition-colors disabled:opacity-50"
      >
        {labels.send}
      </button>
      {status === 'success' && <p className="text-sm text-green-700">{labels.success}</p>}
      {status === 'error' && <p className="text-accent text-sm">{labels.error}</p>}
    </form>
  )
}
