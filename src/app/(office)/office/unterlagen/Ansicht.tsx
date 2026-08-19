'use client'

import React, { useMemo, useState } from 'react'

import { Werkstattdateien, type Werkstattdatei } from '../../../../components/office/Werkstattdateien'
import { useBestand } from '../../../../lib/buero/bestand'

/**
 * Unterlagen — der Weg der Werkstatt zu den Bauzeichnungen.
 *
 * Am Artikel gepflegt werden sie unter Werkstatt → Artikel; das setzt aber
 * das Recht voraus, Preise zu ändern. Wer das Teil baut, braucht die
 * Zeichnung und sonst nichts — deshalb diese Seite: suchen, Variante wählen,
 * herunterladen.
 *
 * Gelesen wird aus dem Bestand im Gerät, die Datei selbst holt der Knopf vom
 * Server. Eine Zeichnung ohne Netz auszuliefern wäre möglich, aber
 * irreführend: Ob die Datei von heute ist, weiß nur der Server.
 */

type Variante = { id?: string | null; title?: string | null }
type Artikel = {
  id: number | string
  title?: string | null
  variants?: Variante[] | null
}

const bezug = (wert: unknown) =>
  typeof wert === 'object' && wert ? String((wert as { id?: number }).id ?? '') : String(wert ?? '')

export function UnterlagenAnsicht() {
  const artikel = useBestand<Artikel>('artikel')
  const dateien = useBestand<Werkstattdatei>('werkstattdateien')

  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState<string | null>(null)
  const [variante, setVariante] = useState<string>('')

  /** Nur Artikel, zu denen es überhaupt etwas gibt — der Rest wäre Rauschen */
  const mitDateien = useMemo(() => {
    const zahl = new Map<string, number>()
    for (const d of dateien) {
      const k = bezug(d.product)
      zahl.set(k, (zahl.get(k) ?? 0) + 1)
    }
    return artikel
      .filter((a) => zahl.has(String(a.id)))
      .map((a) => ({ ...a, anzahl: zahl.get(String(a.id)) ?? 0 }))
      .filter((a) => a.title?.toLowerCase().includes(suche.toLowerCase().trim()))
      .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'de'))
  }, [artikel, dateien, suche])

  const gewaehlt = mitDateien.find((a) => String(a.id) === offen)

  return (
    <>
      <h1>Unterlagen</h1>
      <p className="buero-unterzeile">
        Laserdateien, Fräsprogramme, Zusammenbauzeichnungen und NC-Code — nach Artikel und
        Variante. Gepflegt werden sie am Artikel; hier stehen sie zum Herunterladen.
      </p>

      <label className="buero-feld">
        <span>Artikel suchen</span>
        <input value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Bezeichnung" />
      </label>

      {mitDateien.length === 0 && (
        <div className="buero-leer">
          {dateien.length === 0
            ? 'Noch keine Unterlagen abgelegt. Das passiert am Artikel unter Werkstatt → Artikel.'
            : 'Kein Artikel passt zur Suche.'}
        </div>
      )}

      <div className="buero-liste">
        {mitDateien.map((a) => (
          <button
            key={a.id}
            type="button"
            className="buero-zeile buero-zeile-knopf"
            aria-current={String(a.id) === offen ? 'page' : undefined}
            onClick={() => {
              setOffen(String(a.id) === offen ? null : String(a.id))
              setVariante('')
            }}
          >
            <div className="buero-zeile-haupt">
              <div className="buero-zeile-titel">{a.title}</div>
              <div className="buero-zeile-neben">
                <b>{a.anzahl}</b> {a.anzahl === 1 ? 'Datei' : 'Dateien'}
                {a.variants?.length ? ` · ${a.variants.length} Varianten` : ''}
              </div>
            </div>
            <span className="buero-marker offen">{String(a.id) === offen ? 'offen' : 'ansehen'}</span>
          </button>
        ))}
      </div>

      {gewaehlt && (
        <div className="buero-karte" style={{ marginTop: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>{gewaehlt.title}</h2>

          {(gewaehlt.variants?.length ?? 0) > 0 && (
            <div className="buero-reiter">
              <button
                type="button"
                aria-current={variante === '' ? 'page' : undefined}
                onClick={() => setVariante('')}
              >
                Grundlage
              </button>
              {(gewaehlt.variants ?? []).map((v) => (
                <button
                  key={String(v.id)}
                  type="button"
                  aria-current={variante === String(v.id) ? 'page' : undefined}
                  onClick={() => setVariante(String(v.id))}
                >
                  {v.title}
                </button>
              ))}
            </div>
          )}

          <Werkstattdateien
            produktId={gewaehlt.id}
            variantId={variante}
            variantTitle={
              gewaehlt.variants?.find((v) => String(v.id) === variante)?.title ?? undefined
            }
            darfAendern={false}
          />
        </div>
      )}
    </>
  )
}
