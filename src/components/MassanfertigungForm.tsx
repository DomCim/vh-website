'use client'

import React, { useRef, useState } from 'react'

import { alsListe, useDateiablage } from '../lib/buero/dateiablage'

import type { Locale } from '../lib/i18n'
import { zahlAusText } from '../lib/zahleingabe'

type Labels = {
  name: string
  email: string
  phone: string
  message: string
  width: string
  depth: string
  height: string
  color: string
  purpose: string
  desiredDate: string
  upload: string
  send: string
  success: string
  error: string
}

export function MassanfertigungForm({ locale, labels }: { locale: Locale; labels: Labels }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [anhaenge, setAnhaenge] = useState<{ id: number; datei: string }[]>([])

  /*
   * Ziehen und Einfügen zusätzlich zum Dialog (siehe lib/buero/dateiablage.ts).
   * Wer eine Maßanfertigung anfragt, hat die Skizze oder das Foto vom Vorbild
   * meist schon offen — dann ist Hineinziehen der kürzere Weg als der Umweg
   * über den Dateidialog.
   */
  const ablageBereich = useRef<HTMLDivElement>(null)
  const ablage = useDateiablage(ablageBereich, (d) => void hochladen(alsListe(d)))

  async function hochladen(dateien: FileList | null) {
    if (!dateien?.length) return
    for (const datei of Array.from(dateien).slice(0, 3)) {
      const daten = new FormData()
      daten.append('datei', datei)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: daten })
        if (!res.ok) continue
        const j = await res.json()
        setAnhaenge((v) => [...v, { id: j.id, datei: j.datei }])
      } catch {
        // Ein fehlgeschlagener Anhang darf die Anfrage nicht blockieren
      }
    }
  }

  async function absenden(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('sending')
    const form = e.currentTarget
    const f = new FormData(form)
    /*
     * Maße dürfen ein Komma haben: „120,5" ist eine plausible Breite. Vorher
     * stand hier `Number(v)` an einem `type="number"`-Feld — je nach Browser
     * kam das Komma gar nicht erst an oder wurde zu NaN, und die Anfrage
     * erreichte die Werkstatt ohne Maß. Gemerkt hätte das niemand: Im
     * Formular sah alles richtig aus.
     */
    const zahl = (name: string) => zahlAusText(String(f.get(name) ?? ''), null) ?? undefined

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.get('name'),
          email: f.get('email'),
          phone: f.get('phone'),
          message: f.get('message'),
          website: f.get('website'),
          locale,
          custom: {
            width: zahl('width'),
            depth: zahl('depth'),
            height: zahl('height'),
            color: f.get('color') || undefined,
            purpose: f.get('purpose') || undefined,
            desiredDate: f.get('desiredDate') || undefined,
          },
          attachmentIds: anhaenge.map((a) => a.id),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('success')
      form.reset()
      setAnhaenge([])
    } catch {
      setStatus('error')
    }
  }

  const inputClass =
    'border-line focus:border-ink w-full border bg-paper px-4 py-3 text-sm outline-none transition-colors'

  if (status === 'success') {
    return <p className="mt-6 text-sm text-green-700">{labels.success}</p>
  }

  return (
    <form onSubmit={absenden} className="mt-8 max-w-xl space-y-4">
      {/* Honigtopf gegen Spam-Bots — für Menschen unsichtbar */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <input
          name="width"
          inputMode="decimal"
          placeholder={labels.width}
          className={inputClass}
        />
        <input
          name="depth"
          inputMode="decimal"
          placeholder={labels.depth}
          className={inputClass}
        />
        <input
          name="height"
          inputMode="decimal"
          placeholder={labels.height}
          className={inputClass}
        />
      </div>
      <input name="color" placeholder={labels.color} className={inputClass} />
      <input name="purpose" placeholder={labels.purpose} className={inputClass} />
      <input name="desiredDate" placeholder={labels.desiredDate} className={inputClass} />

      <div
        ref={ablageBereich}
        className={`border border-dashed p-3 transition-colors ${
          ablage.drueber ? 'border-bronze bg-bronze/5' : 'border-transparent'
        }`}
      >
        <label className="text-ink-soft block text-sm">
          {labels.upload}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => void hochladen(e.target.files)}
            className="mt-2 block w-full text-sm"
          />
        </label>
        {anhaenge.length > 0 && (
          <ul className="text-ink-soft mt-2 text-xs">
            {anhaenge.map((a) => (
              <li key={a.id}>✓ {a.datei}</li>
            ))}
          </ul>
        )}
      </div>

      <input name="name" required placeholder={labels.name} className={inputClass} />
      <input name="email" type="email" required placeholder={labels.email} className={inputClass} />
      <input name="phone" type="tel" placeholder={labels.phone} className={inputClass} />
      <textarea name="message" required rows={5} placeholder={labels.message} className={inputClass} />

      <button
        type="submit"
        disabled={status === 'sending'}
        className="bg-ink tracking-nav hover:bg-bronze cursor-pointer px-8 py-3 text-xs font-semibold text-on-ink uppercase transition-colors disabled:opacity-50"
      >
        {labels.send}
      </button>
      {status === 'error' && <p className="text-accent text-sm">{labels.error}</p>}
    </form>
  )
}
