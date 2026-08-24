'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'

import { auswahlSenden, lesbareGroesse, type Uploadstand } from '../../lib/hochladen'
import { Dateiknopf } from '../office/Dateiknopf'
import { useDateiablage } from '../../lib/buero/dateiablage'
import type { Dictionary } from '../../lib/i18n'

/**
 * Unterlagen an einem Vorgang — im Kundenportal.
 *
 * Der Übergabelink ist für die, die noch kein Konto haben: sieben Tage,
 * Passwort, per Mail. Wer angemeldet ist, braucht das nicht — er sieht seinen
 * Auftrag ohnehin. Hier reicht er nach, was noch fehlt, und holt ab, was
 * bereitliegt.
 *
 * Zugeklappt, bis jemand hineinsieht: Bei einer Shop-Bestellung gibt es keine
 * Unterlagen, und ein leerer Kasten unter jedem Auftrag wäre nur Grundrauschen.
 * Geladen wird erst beim Aufklappen — sonst stellte die Übersicht bei zehn
 * Aufträgen zehn Anfragen, von denen neun niemanden interessieren.
 */

type Datei = {
  id: number | string
  name: string
  groesse: number
  vonUns: boolean
  am: string | null
}

const knopfLeise =
  'border-line hover:border-ink tracking-nav cursor-pointer border px-4 py-2 text-xs font-semibold uppercase transition-colors disabled:opacity-50'

export function Vorgangsunterlagen({
  auftrag,
  angebot,
  labels,
}: {
  auftrag?: number | string
  angebot?: number | string
  labels: Dictionary['handover']
}) {
  const [offen, setOffen] = useState(false)
  const [dateien, setDateien] = useState<Datei[] | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [staende, setStaende] = useState<Uploadstand[]>([])

  const bezug = auftrag ? `auftrag=${auftrag}` : angebot ? `angebot=${angebot}` : ''

  const holen = useCallback(async () => {
    if (!bezug) return
    try {
      const res = await fetch(`/api/konto/datei?${bezug}`)
      setDateien(res.ok ? ((await res.json()).dateien as Datei[]) : [])
    } catch {
      setDateien([])
    }
  }, [bezug])

  useEffect(() => {
    if (offen && dateien === null) void holen()
  }, [offen, dateien, holen])

  /*
   * Ziehen und Einfügen zusätzlich zum Knopf (siehe lib/buero/dateiablage.ts).
   * Erst ab dem Aufklappen — vorher gibt es den Bereich gar nicht, und ein
   * eingefügtes Bild soll nicht in einem zugeklappten Kasten verschwinden.
   */
  const ablageBereich = useRef<HTMLDivElement>(null)
  const ablage = useDateiablage(ablageBereich, (d) => void hochladen(d), offen && !laeuft)

  if (!bezug) return null

  async function hochladen(auswahl: File[]) {
    if (auswahl.length === 0) return
    setLaeuft(true)
    try {
      await auswahlSenden(
        auswahl,
        (d) => `/api/konto/datei?${bezug}&name=${encodeURIComponent(d.name)}`,
        setStaende,
      )
      await holen()
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        className="text-ink-soft hover:text-ink cursor-pointer text-xs underline"
        onClick={() => setOffen((v) => !v)}
      >
        {labels.show}
      </button>

      {offen && (
        <div className="border-line mt-3 border-t pt-3">
          <p className="text-ink-soft mb-3 text-xs">{labels.atJob}</p>

          {dateien === null ? (
            <p className="text-ink-soft text-sm">…</p>
          ) : dateien.length === 0 ? (
            <p className="text-ink-soft text-sm">{labels.empty}</p>
          ) : (
            <ul className="border-line border-t">
              {dateien.map((d) => (
                <li
                  key={d.id}
                  className="border-line flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-ink truncate text-sm">{d.name}</div>
                    <div className="text-ink-soft text-xs">
                      {d.vonUns ? labels.fromUs : labels.fromYou}
                      {d.groesse ? ` · ${lesbareGroesse(d.groesse)}` : ''}
                    </div>
                  </div>
                  <a className={knopfLeise} href={`/api/konto/datei/${d.id}`}>
                    {labels.download}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {staende.length > 0 && (
            <ul className="border-line mt-3 border-t">
              {staende.map((s) => (
                <li key={s.schluessel} className="border-line border-b py-2 last:border-b-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-ink truncate text-sm">{s.name}</span>
                    <span className="text-ink-soft text-xs">
                      {s.stand === 'fertig'
                        ? labels.uploaded
                        : s.stand === 'fehler'
                          ? (s.fehler ?? labels.failed)
                          : s.stand === 'laeuft'
                            ? `${labels.uploading} ${Math.round((s.getan / Math.max(1, s.bytes)) * 100)} %`
                            : lesbareGroesse(s.bytes)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div
            ref={ablageBereich}
            className={`mt-4 border border-dashed p-3 transition-colors ${
              ablage.drueber ? 'border-bronze bg-bronze/5' : 'border-transparent'
            }`}
          >
            <Dateiknopf
              text={labels.choose}
              klasse={knopfLeise}
              mehrere
              gesperrt={laeuft}
              nimm={(dateien) => void hochladen([...dateien])}
            />
            <p className="text-ink-soft mt-3 text-xs leading-relaxed">
              {labels.chooseHint} {labels.kinds}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
