'use client'

import React, { useCallback, useEffect, useState } from 'react'

/**
 * Was ein Scan der Laufmarke zeigt — die Browser-Seite zu /api/m/[code].
 *
 * Die Seite lädt serverseitig nichts (siehe page.tsx); erst diese Komponente
 * fragt die Schnittstelle, und die entscheidet nach Anmeldung: Büro-Konten
 * werden zur Büro-Seite geschickt, angemeldete Betriebe sehen ihren Schritt,
 * alle anderen einen Satz und das PIN-Feld.
 *
 * Die zwei Knöpfe des Betriebs sind absichtlich grob: „angekommen" und
 * „fertig". Wer mit Handschuhen am Hoftor steht, soll nicht tippen müssen —
 * und ein Doppel-Scan ändert nichts, das stellt der Server sicher.
 */

type Labels = {
  title: string
  intro: string
  pinLabel: string
  pinHint: string
  open: string
  opening: string
  denied: string
  tooMany: string
  office: string
  step: string
  due: string
  qty: string
  color: string
  arrived: string
  arrivedAt: string
  done: string
  doneAt: string
  error: string
}

type Sicht =
  | { sicht: 'gast' }
  | { sicht: 'buero' }
  | {
      sicht: 'dienstleister'
      marke: string
      schritt: { was: string; angekommenAm: string | null; fertigGemeldetAm: string | null }
      wunschtermin: string | null
      positionen: {
        beschreibung: string
        menge: number
        farbe: string | null
        bild: string | null
      }[]
    }

export function MarkenAnsicht({
  code,
  locale,
  labels,
}: {
  code: string
  locale: string
  labels: Labels
}) {
  const [sicht, setSicht] = useState<Sicht | null>(null)
  const [pin, setPin] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/m/${encodeURIComponent(code)}`, { cache: 'no-store' })
      const daten = (await r.json()) as Sicht
      if (daten.sicht === 'buero') {
        // Das Büro hat seine eigene Seite — mit Knöpfen und Rechten
        window.location.href = `/office/marke/${encodeURIComponent(code)}`
        return
      }
      setSicht(daten)
    } catch {
      setSicht({ sicht: 'gast' })
    }
  }, [code])

  useEffect(() => {
    void laden()
  }, [laden])

  async function aktion(name: 'anmelden' | 'angekommen' | 'fertig') {
    setLaeuft(true)
    setFehler(null)
    try {
      const r = await fetch(`/api/m/${encodeURIComponent(code)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(name === 'anmelden' ? { aktion: name, pin } : { aktion: name }),
      })
      if (r.status === 429) {
        setFehler(labels.tooMany)
        return
      }
      if (!r.ok) {
        setFehler(name === 'anmelden' ? labels.denied : labels.error)
        return
      }
      setSicht((await r.json()) as Sicht)
      setPin('')
    } catch {
      setFehler(labels.error)
    } finally {
      setLaeuft(false)
    }
  }

  const datum = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : locale === 'en' ? 'en-GB' : 'de-DE', {
          dateStyle: 'medium',
        }).format(new Date(iso))
      : ''

  if (!sicht) return <p className="text-ink-soft">…</p>

  if (sicht.sicht !== 'dienstleister') {
    return (
      <div className="space-y-6">
        <p className="text-ink-soft leading-relaxed">{labels.intro}</p>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void aktion('anmelden')
          }}
        >
          <label className="block">
            <span className="tracking-nav text-ink mb-1 block text-xs font-semibold uppercase">
              {labels.pinLabel}
            </span>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              className="border-line text-ink w-full max-w-xs border bg-transparent px-3 py-2"
            />
          </label>
          <p className="text-ink-soft text-sm">{labels.pinHint}</p>
          {fehler && <p className="text-accent text-sm">{fehler}</p>}
          <button
            type="submit"
            disabled={laeuft || !pin.trim()}
            className="border-ink bg-ink text-on-ink border px-5 py-2 text-sm disabled:opacity-50"
          >
            {laeuft ? labels.opening : labels.open}
          </button>
        </form>
        <p className="text-ink-soft text-sm">
          <a className="underline" href={`/office/marke/${encodeURIComponent(code)}`}>
            {labels.office}
          </a>
        </p>
      </div>
    )
  }

  const s = sicht
  return (
    <div className="space-y-8">
      <div>
        <p className="tracking-nav text-ink mb-1 text-xs font-semibold uppercase">{labels.step}</p>
        <p className="text-ink text-2xl font-semibold">{s.schritt.was}</p>
        {s.wunschtermin && (
          <p className="text-ink-soft mt-1">
            {labels.due} {datum(s.wunschtermin)}
          </p>
        )}
      </div>

      <ul className="space-y-4">
        {s.positionen.map((p, i) => (
          <li key={i} className="border-line flex gap-4 border p-3">
            {p.bild && (
              // Das Bild sagt schneller als jeder Text, was da in der Kiste liegt
              <img
                src={p.bild}
                alt=""
                className="bg-paper-soft h-20 w-24 shrink-0 object-cover"
              />
            )}
            <div className="min-w-0">
              <p className="text-ink font-medium">{p.beschreibung}</p>
              <p className="text-ink-soft text-sm">
                {labels.qty}: {p.menge}
                {p.farbe ? ` · ${labels.color}: ${p.farbe}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {fehler && <p className="text-accent text-sm">{fehler}</p>}

      <div className="space-y-3">
        {s.schritt.angekommenAm ? (
          <p className="text-ink-soft text-sm">
            ✓ {labels.arrivedAt} {datum(s.schritt.angekommenAm)}
          </p>
        ) : (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void aktion('angekommen')}
            className="border-ink text-ink block w-full max-w-md border px-5 py-4 text-left text-lg disabled:opacity-50"
          >
            {labels.arrived}
          </button>
        )}
        {s.schritt.fertigGemeldetAm ? (
          <p className="text-ink-soft text-sm">
            ✓ {labels.doneAt} {datum(s.schritt.fertigGemeldetAm)}
          </p>
        ) : (
          <button
            type="button"
            disabled={laeuft}
            onClick={() => void aktion('fertig')}
            className="border-ink bg-ink text-on-ink block w-full max-w-md border px-5 py-4 text-left text-lg disabled:opacity-50"
          >
            {labels.done}
          </button>
        )}
      </div>
    </div>
  )
}
