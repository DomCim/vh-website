'use client'

import { AnimatePresence, motion } from 'motion/react'
import React, { useState } from 'react'

type Labels = {
  requestNow: string
  name: string
  email: string
  phone: string
  message: string
  send: string
  success: string
  error: string
}

/**
 * Anfrage-Formular für „auf Anfrage"-Produkte — klappt direkt auf der
 * Produktseite auf; die Mail kommt mit Produktbezug im Betreff an.
 */
export function ProductInquiryForm({
  productTitle,
  productUrl,
  labels,
}: {
  productTitle: string
  productUrl: string
  labels: Labels
}) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    const data = Object.fromEntries(new FormData(e.currentTarget).entries())
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, productTitle, productUrl }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'border-line focus:border-ink w-full border bg-paper px-4 py-3 text-sm outline-none transition-colors'

  if (status === 'success') {
    return <p className="mt-4 max-w-md text-sm text-green-700">{labels.success}</p>
  }

  return (
    <div className="mt-4 max-w-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors"
      >
        {labels.requestNow}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-4">
              {/* Honigtopf gegen Spam-Bots — für Menschen unsichtbar */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
              <input name="name" required placeholder={labels.name} className={inputClass} />
              <input name="email" type="email" required placeholder={labels.email} className={inputClass} />
              <input name="phone" type="tel" placeholder={labels.phone} className={inputClass} />
              <textarea
                name="message"
                required
                rows={4}
                placeholder={labels.message}
                defaultValue=""
                className={inputClass}
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors disabled:opacity-50"
              >
                {labels.send}
              </button>
              {status === 'error' && <p className="text-accent text-sm">{labels.error}</p>}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
