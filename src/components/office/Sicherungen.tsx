'use client'

import { useRouter } from 'next/navigation'
import React, { useState } from 'react'

export type SicherungsZeile = { name: string; groesse: number; erstellt: string }

const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`

const zeitpunkt = (v: string) =>
  new Date(v).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

/**
 * Sicherungen von Hand auslösen und verwalten.
 *
 * Der Knopf braucht Geduld: Datenbank ziehen, Bilder packen und alles auf die
 * NAS schieben dauert bei einer Werkstatt voller Fotos ein paar Minuten.
 * Deshalb sagt die Oberfläche, was gerade passiert, statt stumm zu warten.
 */
export function Sicherungen({
  sicherungen,
  nasBereit,
  zielName,
}: {
  sicherungen: SicherungsZeile[]
  nasBereit: boolean
  zielName: string
}) {
  const router = useRouter()
  const [laeuft, setLaeuft] = useState<string | null>(null)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [fehler, setFehler] = useState(false)

  async function rufen(aktion: string, name?: string) {
    setLaeuft(name ? `${aktion}:${name}` : aktion)
    setMeldung(null)
    setFehler(false)
    try {
      const res = await fetch('/api/office/sicherung', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ aktion, name }),
      })
      const j = await res.json()
      if (!res.ok) {
        setFehler(true)
        setMeldung(j.error || 'Das hat nicht geklappt.')
        return
      }
      setFehler(!(j.hochgeladen ?? true))
      setMeldung(j.meldung ?? 'Erledigt.')
      router.refresh()
    } catch {
      setFehler(true)
      setMeldung('Die Sicherung konnte nicht ausgeführt werden.')
    } finally {
      setLaeuft(null)
    }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button
          type="button"
          className="buero-knopf"
          disabled={laeuft !== null}
          onClick={() => rufen('erstellen')}
        >
          {laeuft === 'erstellen' ? 'Sichert … bitte warten' : 'Jetzt sichern'}
        </button>
      </div>

      {meldung && (
        <div className={`buero-hinweis${fehler ? ' warn' : ''}`} style={{ marginBottom: '1rem' }}>
          {meldung}
        </div>
      )}

      <div className="buero-liste">
        {sicherungen.length === 0 ? (
          <div className="buero-leer">
            Noch keine Sicherung vorhanden. Der erste Lauf dauert am längsten.
          </div>
        ) : (
          sicherungen.map((s) => (
            <div key={s.name} className="buero-zeile">
              <div className="buero-zeile-haupt">
                <div className="buero-zeile-titel">{zeitpunkt(s.erstellt)}</div>
                <div className="buero-zeile-neben">
                  {s.name} · {mb(s.groesse)}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <a
                  className="buero-knopf leise schmal"
                  href={`/api/office/sicherung?name=${encodeURIComponent(s.name)}`}
                >
                  Laden
                </a>
                {nasBereit && (
                  <button
                    type="button"
                    className="buero-knopf leise schmal"
                    disabled={laeuft !== null}
                    onClick={() => rufen('hochladen', s.name)}
                  >
                    {laeuft === `hochladen:${s.name}` ? '…' : `Auf ${zielName}`}
                  </button>
                )}
                <button
                  type="button"
                  className="buero-knopf schmal gefahr"
                  disabled={laeuft !== null}
                  onClick={() => {
                    if (confirm(`Sicherung vom ${zeitpunkt(s.erstellt)} wirklich löschen?`)) {
                      rufen('loeschen', s.name)
                    }
                  }}
                >
                  Löschen
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
