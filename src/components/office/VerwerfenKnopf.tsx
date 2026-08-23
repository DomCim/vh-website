'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import { Rueckmeldung } from './Rueckmeldung'

/**
 * Einen Entwurf endgültig verwerfen — für Angebote und Rechnungen.
 *
 * Der Storno-Weg sagte lange: „Ein Entwurf hat keine Nummer — der wird
 * verworfen, nicht storniert." Nur gab es das Verwerfen nirgends, und der
 * Entwurf stand für immer in der Liste und im Kümmern-Zähler. Hier ist der
 * fehlende Knopf. Er löscht nur, was keine Nummer hat — was eine hat, liegt
 * beim Kunden und wird storniert oder abgelehnt.
 *
 * Direkter Abruf statt Warteschlange: Löschen aus der Warteschlange heraus
 * hieße, dass ein Datensatz im Gerät noch da ist, den der Server längst nicht
 * mehr kennt — die Meldung „braucht Netz" ist das kleinere Übel.
 */
export function VerwerfenKnopf({
  pfad,
  id,
  ziel,
  was,
}: {
  /** Die Schnittstelle, die `aktion: 'verwerfen'` versteht */
  pfad: string
  id: number | string
  /** Wohin nach dem Verwerfen — die Liste, aus der der Entwurf kam */
  ziel: string
  /** „Angebotsentwurf", „Rechnungsentwurf" — steht in der Nachfrage */
  was: string
}) {
  const router = useRouter()
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)

  async function verwerfen() {
    if (!window.confirm(`${was} verwerfen? Das lässt sich nicht rückgängig machen.`)) return
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch(pfad, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktion: 'verwerfen', id }),
      })
      const daten = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMeldung(
          daten.error === 'schon-versendet' || daten.error === 'schon-gestellt'
            ? 'Das ist kein Entwurf mehr — es hat eine Nummer und wird storniert, nicht verworfen.'
            : 'Das hat nicht geklappt.',
        )
        return
      }
      router.push(ziel)
      router.refresh()
    } catch {
      setMeldung('Das hat nicht geklappt — dafür braucht es Netz.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="buero-knopf leise schmal"
        disabled={laeuft}
        onClick={() => void verwerfen()}
      >
        Entwurf verwerfen
      </button>
      <Rueckmeldung text={meldung} />
    </>
  )
}
