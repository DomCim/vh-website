'use client'

import React, { useMemo } from 'react'

import { useBestand } from '../../lib/buero/bestand'

/**
 * Der Artikel zu einer Position — nur für das Bild.
 *
 * Auf einer Auftragsbestätigung steht sonst eine Textzeile, und in der
 * Werkstatt fragt jemand nach, welches Teil gemeint ist. Ein daumennagelgroßes
 * Bild beantwortet das, bevor die Frage entsteht — im Büro neben der Position
 * und auf Angebot, Auftragsbestätigung, Lieferschein und Rechnung.
 *
 * Die Beschreibung bleibt maßgeblich: Sie steht auf dem Papier, sie ist
 * verhandelt und darf von der Artikelbezeichnung abweichen. Dieser Bezug
 * ändert an keiner Zahl etwas. Aus einer Shop-Bestellung wird er von selbst
 * gesetzt; von Hand geschriebene Positionen dürfen ihn haben oder nicht.
 */

type Artikel = { id: number | string; title?: string | null; images?: unknown[] | null }
type Medium = {
  id: number | string
  url?: string | null
  sizes?: Record<string, { url?: string | null } | undefined> | null
}

const kennung = (wert: unknown) =>
  typeof wert === 'object' && wert ? (wert as { id?: number | string }).id : wert

/** Die kleinste Fassung eines Bildes — für ein 40-Pixel-Feld reicht sie */
export function bildUrl(artikel: Artikel | undefined, medien: Medium[]): string | null {
  const erstes = artikel?.images?.[0]
  if (!erstes) return null
  const id = String(kennung(erstes) ?? '')
  const medium = medien.find((m) => String(m.id) === id)
  if (!medium) return null
  return medium.sizes?.klein?.url || medium.sizes?.thumbnail?.url || medium.url || null
}

export function ArtikelBezug({
  wert,
  aendern,
  gesperrt = false,
}: {
  wert: number | '' | null | undefined
  aendern: (id: number | '') => void
  /** Zu, wenn der Datensatz festgeschrieben ist — etwa eine gestellte Rechnung. */
  gesperrt?: boolean
}) {
  const artikel = useBestand<Artikel>('artikel')
  const medien = useBestand<Medium>('medien')

  const sortiert = useMemo(
    () => [...artikel].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'de')),
    [artikel],
  )
  const gewaehlt = sortiert.find((a) => String(a.id) === String(wert ?? ''))
  const bild = bildUrl(gewaehlt, medien)

  return (
    <label className="buero-feld">
      <span>Artikel (Bild)</span>
      <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
        {/* Der Platz bleibt auch ohne Bild stehen — sonst springt die Zeile */}
        <span
          style={{
            width: 40,
            height: 40,
            flex: '0 0 auto',
            borderRadius: 8,
            border: '1px solid var(--buero-linie)',
            background: 'var(--buero-papier)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {bild ? (
            <img
              src={bild}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <span style={{ fontSize: '.7rem', color: 'var(--buero-tinte-leise)' }}>—</span>
          )}
        </span>
        <select
          value={wert ?? ''}
          disabled={gesperrt}
          onChange={(e) => aendern(Number(e.target.value) || '')}
          style={{ minWidth: 0 }}
        >
          <option value="">— ohne —</option>
          {sortiert.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
      </div>
    </label>
  )
}
