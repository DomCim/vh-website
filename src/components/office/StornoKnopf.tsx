'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

/**
 * Eine gestellte Rechnung zurücknehmen.
 *
 * Das Rechnungsformular sagte den richtigen Satz — „für Korrekturen eine
 * Stornorechnung schreiben" — und ließ dann jeden damit allein: Die
 * Gegenrechnung musste von Hand getippt werden, mit jeder Position, jedem
 * Steuersatz und dem Risiko, dass ein Cent abweicht.
 *
 * Hier steht der Knopf dazu. Er legt das Spiegelbild an, verweist aufs
 * Original und setzt es auf „storniert". Verschickt wird danach von Hand, wie
 * jedes andere Kundendokument auch.
 *
 * Bewusst mit Zwischenschritt und Grund: Stornieren ist nicht rückgängig zu
 * machen — die Nummer der Stornorechnung ist dann vergeben, und eine Lücke in
 * der Reihe ist schlimmer als ein überflüssiges Papier. Der Grund steht später
 * auf dem Blatt; „warum kam das Storno?" ist die erste Frage der Kundschaft
 * und die zweite der Buchhaltung.
 */
export function StornoKnopf({ id, nummer }: { id: number | string; nummer: string }) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [grund, setGrund] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  async function stornieren() {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch('/api/office/rechnung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'stornieren', id, grund }),
      })
      const daten = await res.json()
      if (!res.ok) {
        setMeldung(
          {
            entwurf: 'Ein Entwurf hat keine Nummer — der wird verworfen, nicht storniert.',
            'schon-storniert': 'Diese Rechnung ist bereits storniert.',
            'ist-storno': 'Eine Stornorechnung lässt sich nicht selbst stornieren.',
          }[daten.error as string] ?? 'Das hat nicht geklappt.',
        )
        return
      }
      router.push(`/office/rechnungen/${daten.id}`)
      router.refresh()
    } catch {
      setMeldung('Das hat nicht geklappt — dafür braucht es Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  if (!offen) {
    return (
      <button type="button" className="buero-knopf leise schmal" onClick={() => setOffen(true)}>
        Stornieren
      </button>
    )
  }

  return (
    <div className="buero-karte" style={{ width: '100%' }}>
      <p style={{ marginTop: 0 }}>
        <strong>{nummer} stornieren?</strong> Es entsteht eine neue Rechnung mit negativen Beträgen,
        die auf diese hier verweist. Beide Papiere bleiben stehen — rückgängig machen lässt sich das
        nicht.
      </p>
      <label className="buero-feld">
        <span>Grund (steht auf der Stornorechnung)</span>
        <input
          value={grund}
          onChange={(e) => setGrund(e.target.value)}
          placeholder="z.B. falsche Anschrift, Auftrag storniert"
        />
      </label>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        <button type="button" className="buero-knopf" disabled={laeuft} onClick={stornieren}>
          Stornorechnung anlegen
        </button>
        <button
          type="button"
          className="buero-knopf leise"
          disabled={laeuft}
          onClick={() => setOffen(false)}
        >
          Abbrechen
        </button>
      </div>
      {meldung && <p className="buero-hinweis">{meldung}</p>}
    </div>
  )
}
