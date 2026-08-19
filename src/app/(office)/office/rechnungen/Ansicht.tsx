'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { useMemo, useState } from 'react'

import { useBestand } from '../../../../lib/buero/bestand'
import { absenden } from '../../../../lib/buero/warteschlange'
import { datum, euro } from '../../../../lib/format'
import { tageSeit } from '../../../../lib/zahlungsstand'

/** Rechnungen — gerechnet aus dem Bestand im Gerät. */

const STATUS: Record<string, { text: string; art: string }> = {
  entwurf: { text: 'Entwurf', art: '' },
  gestellt: { text: 'Gestellt', art: 'offen' },
  bezahlt: { text: 'Bezahlt', art: 'gut' },
  storniert: { text: 'Storniert', art: 'warn' },
}

type Rechnung = {
  id: number | string
  invoiceNumber?: string | null
  customerName?: string | null
  status?: string | null
  issueDate?: string | null
  dueDate?: string | null
  total?: number | null
  reminders?: unknown[] | null
  stufe?: string | null
}

const STUFE: Record<string, string> = {
  anzahlung: 'Anzahlung',
  zwischen: 'Zwischenrechnung',
  schluss: 'Schlussrechnung',
}

const ueberfaellig = (r: Rechnung) =>
  r.status === 'gestellt' && Boolean(r.dueDate) && new Date(r.dueDate!).getTime() < Date.now()

export function RechnungenAnsicht() {
  const suche = useSearchParams()
  const filter = suche.get('filter') ?? undefined
  const alle = useBestand<Rechnung>('rechnungen')

  const sortiert = useMemo(
    () => [...alle].sort((a, b) => (b.issueDate ?? '').localeCompare(a.issueDate ?? '')),
    [alle],
  )

  const rechnungen = useMemo(() => {
    if (filter === 'ueberfaellig') return sortiert.filter(ueberfaellig)
    if (filter === 'offen') return sortiert.filter((r) => r.status === 'gestellt')
    return sortiert
  }, [sortiert, filter])

  const offen = sortiert.filter((r) => r.status === 'gestellt')
  const offenSumme = Math.round(offen.reduce((s, r) => s + (r.total ?? 0), 0) * 100) / 100
  const spaeteAnzahl = sortiert.filter(ueberfaellig).length

  /*
   * Abhaken direkt aus der Liste.
   *
   * Bei gestufter Zahlung hängen an einem Auftrag drei Rechnungen. Wer sie
   * einzeln aufmachen muss, um „bezahlt" zu setzen, macht es am Ende gar
   * nicht — und dann weiß niemand mehr, was offen ist.
   *
   * Das Zahlungsdatum ist heute. Wer es nachtragen will, weil das Geld
   * gestern kam, tut das in der Rechnung selbst; hier zählt der schnelle Weg.
   * Ohne Netz geht es über dieselbe Warteschlange wie alles andere.
   */
  const [laeuft, setLaeuft] = useState<number | string | null>(null)

  const bezahlt = async (r: Rechnung) => {
    setLaeuft(r.id)
    try {
      await absenden({
        pfad: '/api/office/rechnung',
        bereich: 'rechnungen',
        koerper: { aktion: 'bezahlt', id: r.id, paidDate: new Date().toISOString() },
        vorschau: { ...r, status: 'bezahlt' },
      })
    } finally {
      setLaeuft(null)
    }
  }

  const filterPunkte = [
    { wert: undefined, label: 'Alle' },
    { wert: 'offen', label: 'Offen' },
    { wert: 'ueberfaellig', label: `Überfällig${spaeteAnzahl ? ` (${spaeteAnzahl})` : ''}` },
  ]

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1>Rechnungen</h1>
          <p className="buero-unterzeile">
            {sortiert.length} Rechnungen · {euro(offenSumme)} offen
          </p>
        </div>
        <Link href="/office/rechnungen/neu" className="buero-knopf">
          Rechnung schreiben
        </Link>
      </div>

      <div className="buero-reiter">
        {filterPunkte.map((f) => (
          <Link
            key={f.label}
            href={f.wert ? `/office/rechnungen?filter=${f.wert}` : '/office/rechnungen'}
            aria-current={filter === f.wert ? 'page' : undefined}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="buero-liste" style={{ marginTop: '1rem' }}>
        {rechnungen.length === 0 ? (
          <div className="buero-leer">
            Noch keine Rechnung.
            <br />
            <Link href="/office/rechnungen/neu" style={{ textDecoration: 'underline' }}>
              Erste Rechnung schreiben
            </Link>
          </div>
        ) : (
          rechnungen.map((r) => {
            const s = STATUS[r.status ?? ''] ?? { text: r.status, art: '' }
            const spaet = ueberfaellig(r)
            const gemahnt = (r.reminders ?? []).length
            return (
              <div key={r.id} className="buero-zeile">
                <Link
                  href={`/office/rechnungen/${r.id}`}
                  className="buero-zeile-haupt"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  <div className="buero-zeile-titel">
                    {r.invoiceNumber ?? 'Entwurf'} · {r.customerName ?? 'ohne Kunde'}
                    {r.stufe && STUFE[r.stufe] && (
                      <span className="buero-marker" style={{ marginLeft: '.5rem' }}>
                        {STUFE[r.stufe]}
                      </span>
                    )}
                  </div>
                  <div className="buero-zeile-neben">
                    {r.issueDate ? datum(r.issueDate) : 'noch nicht gestellt'}
                    {r.dueDate ? ` · fällig ${datum(r.dueDate)}` : ''}
                    {spaet && r.dueDate ? ` · seit ${tageSeit(r.dueDate)} Tagen` : ''}
                  </div>
                </Link>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem' }}>
                  {gemahnt > 0 && (
                    <span className="buero-marker offen">
                      {gemahnt === 1 ? 'erinnert' : `${gemahnt}× gemahnt`}
                    </span>
                  )}
                  <span className={`buero-marker ${spaet ? 'warn' : s.art}`}>
                    {spaet ? 'überfällig' : s.text}
                  </span>
                  <span className="buero-betrag">{euro(r.total)}</span>
                  {r.status === 'gestellt' && (
                    <button
                      type="button"
                      className="buero-knopf leise"
                      disabled={laeuft === r.id}
                      onClick={() => void bezahlt(r)}
                    >
                      {laeuft === r.id ? '…' : 'Eingegangen'}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}
